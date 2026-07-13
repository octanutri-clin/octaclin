import { Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AtualizarPacienteDto, CriarPacienteDto, PacienteRespostaDto } from './dtos';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

@Injectable()
export class ServicoPacientes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criar(tenantId: string, dados: CriarPacienteDto): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PacienteOrm);
      const paciente = repositorio.create({
        tenantId,
        profissionalResponsavelId: dados.profissionalResponsavelId,
        nomeCriptografado: this.criptografia.criptografar(dados.nome),
        contatoCriptografado: dados.contato ? this.criptografia.criptografar(dados.contato) : undefined,
        dataNascimento: dados.dataNascimento,
        statusAdesao: 'novo',
        scoreRisco: '0'
      });

      return this.mapearResposta(await repositorio.save(paciente));
    });
  }

  async listar(tenantId: string, pagina = 1, limite = 25): Promise<{ itens: PacienteRespostaDto[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [itens, total] = await gerenciador.getRepository(PacienteOrm).findAndCount({
        where: { tenantId, arquivadoEm: IsNull() },
        order: { criadoEm: 'DESC' },
        skip: (paginaNormalizada - 1) * limiteNormalizado,
        take: limiteNormalizado
      });

      return { itens: itens.map((paciente) => this.mapearResposta(paciente)), total };
    });
  }

  async obterPorId(tenantId: string, pacienteId: string): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
      });

      if (!paciente) {
        throw new NotFoundException('Paciente nao encontrado.');
      }

      return this.mapearResposta(paciente);
    });
  }

  async atualizar(tenantId: string, pacienteId: string, dados: AtualizarPacienteDto): Promise<PacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PacienteOrm);
      const paciente = await repositorio.findOne({
        where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
      });

      if (!paciente) {
        throw new NotFoundException('Paciente nao encontrado.');
      }

      if (dados.profissionalResponsavelId) paciente.profissionalResponsavelId = dados.profissionalResponsavelId;
      if (dados.nome) paciente.nomeCriptografado = this.criptografia.criptografar(dados.nome);
      if (dados.contato) paciente.contatoCriptografado = this.criptografia.criptografar(dados.contato);
      if (dados.dataNascimento) paciente.dataNascimento = dados.dataNascimento;
      if (dados.statusAdesao) paciente.statusAdesao = dados.statusAdesao;
      if (dados.scoreRisco !== undefined) paciente.scoreRisco = String(dados.scoreRisco);

      return this.mapearResposta(await repositorio.save(paciente));
    });
  }

  async arquivar(tenantId: string, pacienteId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(PacienteOrm).update(
        { id: pacienteId, tenantId, arquivadoEm: IsNull() },
        { arquivadoEm: new Date(), statusAdesao: 'inativo' }
      );

      if (!resultado.affected) {
        throw new NotFoundException('Paciente nao encontrado.');
      }
    });
  }

  private mapearResposta(paciente: PacienteOrm): PacienteRespostaDto {
    return {
      id: paciente.id,
      tenantId: paciente.tenantId,
      usuarioId: paciente.usuarioId,
      profissionalResponsavelId: paciente.profissionalResponsavelId,
      nome: this.criptografia.descriptografar(paciente.nomeCriptografado),
      contato: paciente.contatoCriptografado
        ? this.criptografia.descriptografar(paciente.contatoCriptografado)
        : undefined,
      dataNascimento: paciente.dataNascimento,
      statusAdesao: paciente.statusAdesao,
      scoreRisco: paciente.scoreRisco,
      ultimoCheckinEm: paciente.ultimoCheckinEm,
      criadoEm: paciente.criadoEm,
      atualizadoEm: paciente.atualizadoEm
    };
  }
}
