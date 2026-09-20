import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EntityManager, In, IsNull, JsonContains } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AvaliarRegraDto, CriarRegraAutomacaoDto } from './dtos';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { avaliarCondicoes } from '../dominio/avaliador-regras';
import { ContratoAcaoAutomacaoInvalido, criarResultadosAcoes, validarAcoesAutomacao } from '../dominio/acoes-automacao';
import { ehGatilhoInatividade } from '../dominio/recall-inatividade';
import { ContratoGatilhoAutomacaoInvalido, GatilhoAutomacao, validarGatilhoAutomacao } from '../dominio/gatilhos-automacao';

export const FILA_AUTOMACOES = 'automacoes';

@Injectable()
export class ServicoAutomacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    @InjectQueue(FILA_AUTOMACOES) private readonly filaAutomacoes: Queue
  ) {}

  async criarRegra(tenantId: string, dados: CriarRegraAutomacaoDto, usuario: UsuarioAutenticado): Promise<RegraAutomacaoOrm> {
    const gatilho = this.validarGatilho(dados.gatilho);
    const acoes = this.validarAcoes(dados.acoes, ehGatilhoInatividade(gatilho));
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const profissionalId =
        profissionalIdDoUsuario ??
        (await this.validarProfissionalNoTenant(gerenciador, tenantId, dados.profissionalId));
      return gerenciador.getRepository(RegraAutomacaoOrm).save(
        gerenciador.getRepository(RegraAutomacaoOrm).create({
          tenantId,
          profissionalId,
          nome: dados.nome,
          gatilho,
          condicoes: dados.condicoes,
          acoes,
          ativa: false
        })
      );
    });
  }

  async listarRegras(tenantId: string, usuario: UsuarioAutenticado): Promise<RegraAutomacaoOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(RegraAutomacaoOrm).find({
        where: { tenantId, ...(profissionalId ? { profissionalId } : {}) },
        order: { criadoEm: 'DESC' }
      });
    });
  }

  async listarExecucoes(tenantId: string, usuario: UsuarioAutenticado): Promise<ExecucaoRegraOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const regras = profissionalId
        ? await gerenciador.getRepository(RegraAutomacaoOrm).find({
            select: { id: true },
            where: { tenantId, profissionalId }
          })
        : undefined;
      return gerenciador.getRepository(ExecucaoRegraOrm).find({
        where: { tenantId, ...(regras ? { regraId: In(regras.length ? regras.map((regra) => regra.id) : ['00000000-0000-0000-0000-000000000000']) } : {}) },
        order: { criadoEm: 'DESC' },
        take: 50
      });
    });
  }

  async solicitarAvaliacao(tenantId: string, dados: AvaliarRegraDto, usuario: UsuarioAutenticado): Promise<ExecucaoRegraOrm> {
    const execucao = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: dados.regraId, tenantId, ativa: true, ...(profissionalId ? { profissionalId } : {}) }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada ou inativa.');
      await this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);

      return gerenciador.getRepository(ExecucaoRegraOrm).save(
        gerenciador.getRepository(ExecucaoRegraOrm).create({
          tenantId,
          regraId: dados.regraId,
          pacienteId: dados.pacienteId,
          status: 'pendente',
          resultado: { contexto: dados.contexto ?? {} }
        })
      );
    });

    await this.filaAutomacoes.add(
      'avaliar',
      { tenantId, execucaoId: execucao.id, contexto: dados.contexto ?? {} },
      { jobId: `execucao-regra-${execucao.id}`, attempts: 3, backoff: { type: 'exponential', delay: 3000 } }
    );

    return execucao;
  }

  async simularRegra(tenantId: string, dados: AvaliarRegraDto, usuario: UsuarioAutenticado): Promise<ExecucaoRegraOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: dados.regraId, tenantId, ...(profissionalId ? { profissionalId } : {}) }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada.');
      await this.validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);

      const avaliacao = avaliarCondicoes(regra.condicoes, dados.contexto ?? {});
      const acoes = this.validarAcoes(regra.acoes, ehGatilhoInatividade(regra.gatilho));
      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorio.save(repositorio.create({
          tenantId,
          regraId: regra.id,
          pacienteId: dados.pacienteId,
          status: avaliacao.executar ? 'executado' : 'ignorado',
          resultado: {}
        }));
      execucao.resultado = {
        simulacao: true,
        executar: avaliacao.executar,
        motivos: avaliacao.motivos,
        acoesPlanejadas: avaliacao.executar ? acoes : [],
        acoes: avaliacao.executar ? criarResultadosAcoes(execucao.id, acoes, 'simulada') : [],
        contexto: dados.contexto ?? {}
      };
      return repositorio.save(execucao);
    });
  }

  async alterarAtivacao(
    tenantId: string,
    regraId: string,
    ativa: boolean,
    usuario: UsuarioAutenticado
  ): Promise<RegraAutomacaoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorioRegras = gerenciador.getRepository(RegraAutomacaoOrm);
      const regra = await repositorioRegras.findOne({
        where: { id: regraId, tenantId, ...(profissionalId ? { profissionalId } : {}) }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada.');

      if (ativa) {
        const simulacao = await gerenciador.getRepository(ExecucaoRegraOrm).findOne({
          where: { tenantId, regraId, resultado: JsonContains({ simulacao: true }) },
          order: { criadoEm: 'DESC' }
        });
        if (!simulacao) {
          throw new BadRequestException('Simule a regra antes de ativa-la.');
        }
      }

      regra.ativa = ativa;
      return repositorioRegras.save(regra);
    });
  }

  private async validarPacienteNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string | undefined,
    usuario: UsuarioAutenticado
  ): Promise<void> {
    if (!pacienteId) return;
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }

  private async validarProfissionalNoTenant(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalId: string
  ): Promise<string> {
    const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
      select: { id: true },
      where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
    });
    if (!profissional) throw new NotFoundException('Profissional nao encontrado.');
    return profissional.id;
  }

  private validarAcoes(acoes: unknown, permitirTemplateEspecializado = false) {
    try {
      return validarAcoesAutomacao(acoes, { permitirTemplateEspecializado });
    } catch (erro) {
      if (erro instanceof ContratoAcaoAutomacaoInvalido) throw new BadRequestException(erro.message);
      throw erro;
    }
  }

  private validarGatilho(gatilho: unknown): GatilhoAutomacao {
    try {
      return validarGatilhoAutomacao(gatilho);
    } catch (erro) {
      if (erro instanceof ContratoGatilhoAutomacaoInvalido) throw new BadRequestException(erro.message);
      throw erro;
    }
  }
}
