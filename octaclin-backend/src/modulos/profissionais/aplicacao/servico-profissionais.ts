import { Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AtualizarProfissionalDto, CriarProfissionalDto, ProfissionalRespostaDto } from './dtos';
import { ProfissionalOrm } from '../infraestrutura/profissional.orm';

@Injectable()
export class ServicoProfissionais {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas
  ) {}

  async criar(tenantId: string, dados: CriarProfissionalDto): Promise<ProfissionalRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const usuario = await gerenciador.getRepository(UsuarioOrm).save(
        gerenciador.getRepository(UsuarioOrm).create({
          tenantId,
          emailHash: this.criptografia.gerarHashBusca(dados.email),
          emailCriptografado: this.criptografia.criptografar(dados.email),
          senhaHash: this.senhas.gerarHash(dados.senhaInicial),
          role: 'Professional',
          ativo: true
        })
      );

      const repositorio = gerenciador.getRepository(ProfissionalOrm);
      const profissional = await repositorio.save(
        repositorio.create({
          tenantId,
          usuarioId: usuario.id,
          nomeCriptografado: this.criptografia.criptografar(dados.nome),
          registroProfissional: dados.registroProfissional,
          especialidade: dados.especialidade
        })
      );

      return this.mapearResposta(profissional);
    });
  }

  async listar(tenantId: string, pagina = 1, limite = 25): Promise<{ itens: ProfissionalRespostaDto[]; total: number }> {
    const paginaNormalizada = Math.max(1, pagina);
    const limiteNormalizado = Math.min(100, Math.max(1, limite));

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [itens, total] = await gerenciador.getRepository(ProfissionalOrm).findAndCount({
        where: { tenantId, arquivadoEm: IsNull() },
        order: { criadoEm: 'DESC' },
        skip: (paginaNormalizada - 1) * limiteNormalizado,
        take: limiteNormalizado
      });

      return { itens: itens.map((profissional) => this.mapearResposta(profissional)), total };
    });
  }

  async obterPorId(tenantId: string, profissionalId: string): Promise<ProfissionalRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
        where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
      });

      if (!profissional) {
        throw new NotFoundException('Profissional nao encontrado.');
      }

      return this.mapearResposta(profissional);
    });
  }

  async atualizar(tenantId: string, profissionalId: string, dados: AtualizarProfissionalDto): Promise<ProfissionalRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalOrm);
      const profissional = await repositorio.findOne({
        where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
      });

      if (!profissional) {
        throw new NotFoundException('Profissional nao encontrado.');
      }

      if (dados.nome) profissional.nomeCriptografado = this.criptografia.criptografar(dados.nome);
      if (dados.registroProfissional !== undefined) profissional.registroProfissional = dados.registroProfissional;
      if (dados.especialidade !== undefined) profissional.especialidade = dados.especialidade;

      return this.mapearResposta(await repositorio.save(profissional));
    });
  }

  async arquivar(tenantId: string, profissionalId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(ProfissionalOrm).update(
        { id: profissionalId, tenantId, arquivadoEm: IsNull() },
        { arquivadoEm: new Date() }
      );

      if (!resultado.affected) {
        throw new NotFoundException('Profissional nao encontrado.');
      }
    });
  }

  private mapearResposta(profissional: ProfissionalOrm): ProfissionalRespostaDto {
    return {
      id: profissional.id,
      tenantId: profissional.tenantId,
      usuarioId: profissional.usuarioId,
      nome: this.criptografia.descriptografar(profissional.nomeCriptografado),
      registroProfissional: profissional.registroProfissional,
      especialidade: profissional.especialidade,
      criadoEm: profissional.criadoEm,
      atualizadoEm: profissional.atualizadoEm
    };
  }
}
