import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TipoAtendimentoOrm } from '../infraestrutura/tipo-atendimento.orm';
import { CriarTipoAtendimentoDto, TipoAtendimentoRespostaDto } from './dtos';

/**
 * Catalogo de tipos de atendimento por tenant (PB-18, Fase 276), no molde da
 * biblioteca de condutas (PB-23): sempre do tenant inteiro, sem visibilidade
 * pessoal/clinica. A duracao de cada tipo alimenta `AgendaLinkPublicoOrm`
 * quando um profissional escolhe um tipo ao rotacionar o link publico.
 */
@Injectable()
export class ServicoTiposAtendimento {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listar(tenantId: string, somenteAtivos = false): Promise<TipoAtendimentoRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const tipos = await gerenciador.getRepository(TipoAtendimentoOrm).find({
        where: { tenantId, ...(somenteAtivos ? { ativo: true } : {}) },
        order: { nome: 'ASC' }
      });
      return tipos.map((tipo) => this.mapear(tipo));
    });
  }

  async criar(
    tenantId: string,
    dados: CriarTipoAtendimentoDto,
    usuario: UsuarioAutenticado
  ): Promise<TipoAtendimentoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TipoAtendimentoOrm);
      const tipo = await repositorio.save(
        repositorio.create({ tenantId, nome: dados.nome.trim(), duracaoMinutos: dados.duracaoMinutos, ativo: true })
      );
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'agenda.tipo_atendimento.criar',
        recursoTipo: 'tipo_atendimento',
        recursoId: tipo.id,
        metadados: { nome: tipo.nome, duracaoMinutos: tipo.duracaoMinutos }
      });
      return this.mapear(tipo);
    });
  }

  async arquivar(tenantId: string, tipoId: string, usuario: UsuarioAutenticado): Promise<{ id: string }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const tipo = await this.obterNoEscopo(gerenciador, tenantId, tipoId);
      tipo.ativo = false;
      await gerenciador.getRepository(TipoAtendimentoOrm).save(tipo);
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'agenda.tipo_atendimento.arquivar',
        recursoTipo: 'tipo_atendimento',
        recursoId: tipo.id,
        metadados: {}
      });
      return { id: tipo.id };
    });
  }

  private async obterNoEscopo(gerenciador: EntityManager, tenantId: string, tipoId: string): Promise<TipoAtendimentoOrm> {
    const tipo = await gerenciador
      .getRepository(TipoAtendimentoOrm)
      .findOne({ where: { id: tipoId, tenantId, ativo: true } });
    if (!tipo) throw new NotFoundException('Tipo de atendimento nao encontrado.');
    return tipo;
  }

  private mapear(tipo: TipoAtendimentoOrm): TipoAtendimentoRespostaDto {
    return {
      id: tipo.id,
      nome: tipo.nome,
      duracaoMinutos: tipo.duracaoMinutos,
      ativo: tipo.ativo,
      criadoEm: tipo.criadoEm,
      atualizadoEm: tipo.atualizadoEm
    };
  }
}
