import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { In, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { autorizarPendenciaRestricao } from './autorizacao-pendencia-restricao';
import { exigirHistoricoConsistente, exigirReadCommitted } from './integridade-avaliacao-restricoes';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { falharRestricao } from './falha-restricao';

/** O último evento do histórico precisa ser compatível com o estado atual da linha (mesma matriz da leitura individual). */
function eventoCoerente(evento: string | undefined, linha: { estado: string; confirmacao: string }): boolean {
  if (!evento || (evento === 'inativacao') !== (linha.estado === 'inativa') || (evento === 'rejeicao') !== (linha.confirmacao === 'rejeitada')) return false;
  if (evento === 'criacao') return linha.estado === 'ativa' && linha.confirmacao === 'pendente';
  if (evento === 'confirmacao') return linha.estado === 'ativa' && linha.confirmacao === 'confirmada';
  if (evento === 'rejeicao') return linha.estado === 'ativa';
  if (evento === 'inativacao') return linha.confirmacao === 'confirmada';
  if (evento === 'reavaliacao') return linha.estado === 'em_reavaliacao' && linha.confirmacao === 'confirmada';
  if (evento === 'reativacao') return linha.estado === 'ativa' && linha.confirmacao === 'confirmada';
  return true;
}

/** Teto da listagem do profissional e do colaborador (mesmo do resumo do portal): acima disso, 409 em vez de cortar em silêncio. */
const LIMITE_LISTAGEM = 200;

/** Leitura individual: clínica (Professional com concessão) ou de autoria (Collaborator delegado, P2d-2). */
@Injectable()
export class ServicoLeituraRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis,
    private readonly concessoes: ServicoConcessoesPermissao) {}

  async consultar(usuario: UsuarioAutenticado, pacienteId: string, restricaoId: string): Promise<unknown> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId) || !isUUID(restricaoId)) throw new BadRequestException('Solicitação inválida.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase(); restricaoId = restricaoId.toLowerCase();
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      return this.lerVerificada(g, usuario, pacienteId, restricaoId, {}, 'restricoes.consultar');
    }); } catch (erro) { return falharRestricao(erro); }
  }

  /**
   * FOOD06 P2d-2 (Q6): o Collaborator com carteira delegada lê só restrições de SUA autoria, nunca as dos outros
   * nem a decisão clínica além do estado. Mesma verificação de histórico e codec da leitura clínica.
   */
  async consultarAutoria(usuario: UsuarioAutenticado, pacienteId: string, restricaoId: string): Promise<unknown> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId) || !isUUID(restricaoId)) throw new BadRequestException('Solicitação inválida.');
    if (usuario.papel !== 'Collaborator') throw new ForbiddenException('Operação não autorizada.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase(); restricaoId = restricaoId.toLowerCase();
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      if (await autorizarPendenciaRestricao(g, usuario, pacienteId) !== 'colaborador') throw new ForbiddenException('Operação não autorizada.');
      return this.lerVerificada(g, usuario, pacienteId, restricaoId, { autorUsuarioId: usuario.usuarioId }, 'restricoes.consultar_autoria');
    }); } catch (erro) { return falharRestricao(erro); }
  }

  /**
   * FOOD06 P3-0a: lista as restrições do paciente para a equipe. Professional responsável com a concessão
   * `restricoes.confirmar` vê todas (escopo `completo`); sem ela, e o Collaborator delegado, só as que registraram
   * (escopo `autoria`, Q6). A carteira é provada sob lock por `autorizarPendenciaRestricao`. Cada linha é conferida com o
   * histórico e o conteúdo decifrado; qualquer divergência falha fechado. Uma auditoria por listagem, sem conteúdo.
   */
  async listar(usuario: UsuarioAutenticado, pacienteId: string): Promise<{ escopo: 'completo' | 'autoria'; itens: unknown[] }> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId)) throw new BadRequestException('Solicitação inválida.');
    if (usuario.papel !== 'Professional' && usuario.papel !== 'Collaborator') throw new ForbiddenException('Operação não autorizada.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase();
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      const papel = await autorizarPendenciaRestricao(g, usuario, pacienteId);
      if (papel !== (usuario.papel === 'Professional' ? 'profissional' : 'colaborador')) throw new ForbiddenException('Operação não autorizada.');
      let completo = false;
      if (papel === 'profissional') {
        try { await this.concessoes.exigir(usuario.tenantId, usuario.usuarioId, 'restricoes.confirmar', g); completo = true; }
        catch (erro) { if (!(erro instanceof ForbiddenException)) throw erro; }
      }
      const where = { tenantId: usuario.tenantId, pacienteId, ...(completo ? {} : { autorUsuarioId: usuario.usuarioId }) };
      const linhas = await g.getRepository(RestricaoPacienteOrm).find({ where, order: { criadoEm: 'ASC', id: 'ASC' }, take: LIMITE_LISTAGEM + 1,
        select: { id: true, revisao: true, origem: true, estado: true, confirmacao: true, conteudoCriptografado: true, criadoEm: true } });
      if (linhas.length > LIMITE_LISTAGEM) throw new ConflictException('Limite de registros atingido.');
      const historicos = linhas.length === 0 ? [] : await g.getRepository(RevisaoRestricaoPacienteOrm).find({
        where: { tenantId: usuario.tenantId, pacienteId, restricaoId: In(linhas.map(l => l.id)) } });
      const itens = linhas.map(linha => {
        const anterior = historicos.find(h => h.restricaoId === linha.id && h.numero === linha.revisao);
        if (!anterior || !eventoCoerente(anterior.evento, linha)) throw new ConflictException('Restrição indisponível.');
        const base = { tenantId: usuario.tenantId, pacienteId, restricaoId: linha.id, revisao: linha.revisao };
        const conteudo = decifrarConteudoRestricao(this.cripto, linha.conteudoCriptografado, { ...base, finalidade: 'restricao' });
        const historico = decifrarConteudoRestricao(this.cripto, anterior.conteudoCriptografado, { ...base, finalidade: 'revisao_restricao' });
        if (JSON.stringify(conteudo) !== JSON.stringify(historico)) throw new ConflictException('Restrição indisponível.');
        return { id: linha.id, revisao: linha.revisao, origem: linha.origem, estado: linha.estado, confirmacao: linha.confirmacao,
          criadoEm: linha.criadoEm, conteudo };
      });
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.listar', recursoTipo: 'paciente', recursoId: pacienteId, metadados: {} });
      return { escopo: completo ? 'completo' as const : 'autoria' as const, itens };
    }); } catch (erro) { return falharRestricao(erro); }
  }

  /**
   * FOOD06 P3-0a: lê a avaliação global sem criá-la (a criação continua em `avaliacao/inicial`). Só Professional com a
   * concessão. Devolve situação, revisão (para o CAS da reconfirmação) e o vencimento dos 180 dias; nunca quem confirmou.
   */
  async consultarAvaliacao(usuario: UsuarioAutenticado, pacienteId: string): Promise<{ avaliacao: unknown }> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId)) throw new BadRequestException('Solicitação inválida.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase();
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      const avaliacao = await g.getRepository(AvaliacaoRestricoesPacienteOrm).findOne({ where: { tenantId: usuario.tenantId, pacienteId } });
      if (!avaliacao) return { avaliacao: null };
      await exigirHistoricoConsistente(g, usuario.tenantId, pacienteId, avaliacao);
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.avaliacao_consultar', recursoTipo: 'avaliacao_restricoes', recursoId: avaliacao.id, metadados: {} });
      return { avaliacao: { id: avaliacao.id, revisao: avaliacao.revisao, situacao: avaliacao.situacao,
        confirmadoEm: avaliacao.confirmadoEm ? avaliacao.confirmadoEm.toISOString() : null,
        venceEm: avaliacao.venceEm ? avaliacao.venceEm.toISOString() : null } };
    }); } catch (erro) { return falharRestricao(erro); }
  }

  private async lerVerificada(g: EntityManager, usuario: UsuarioAutenticado, pacienteId: string, restricaoId: string,
    filtro: { autorUsuarioId?: string }, acao: string): Promise<unknown> {
      const linha = await g.getRepository(RestricaoPacienteOrm).findOne({ where: { id: restricaoId, tenantId: usuario.tenantId, pacienteId, ...filtro },
        select: { id: true, revisao: true, origem: true, estado: true, confirmacao: true, conteudoCriptografado: true } });
      if (!linha) throw new ForbiddenException('Operação não autorizada.');
      const base = { tenantId: usuario.tenantId, pacienteId, restricaoId, revisao: linha.revisao };
      const anterior = await g.getRepository(RevisaoRestricaoPacienteOrm).findOne({ where: { tenantId: usuario.tenantId, pacienteId, restricaoId, numero: linha.revisao } });
      if (!anterior || !eventoCoerente(anterior.evento, linha)) throw new ConflictException('Restrição indisponível.');
      const conteudo = decifrarConteudoRestricao(this.cripto, linha.conteudoCriptografado, { ...base, finalidade: 'restricao' });
      const historico = decifrarConteudoRestricao(this.cripto, anterior.conteudoCriptografado, { ...base, finalidade: 'revisao_restricao' });
      if (JSON.stringify(conteudo) !== JSON.stringify(historico)) throw new ConflictException('Restrição indisponível.');
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao, recursoTipo: 'restricao_paciente', recursoId: restricaoId, metadados: {} });
      return { id: linha.id, revisao: linha.revisao, origem: linha.origem, estado: linha.estado, confirmacao: linha.confirmacao, conteudo };
  }
}
