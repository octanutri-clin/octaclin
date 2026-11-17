import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { In, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { autorizarPacientePortal, type AcessoPortalPaciente } from './autorizacao-paciente-portal';
import { transicionarSolicitacao, validarPedidoSolicitacao, type PedidoSolicitacao } from '../dominio/solicitacao-restricao-paciente';
import { projetarSolicitacaoPortal, type SolicitacaoPortal } from '../dominio/projecao-portal-solicitacao';
import { projetarResumoPortal, type ResumoPortal } from '../dominio/projecao-portal-restricoes';
import { cifrarCampo, decifrarCampo, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { SolicitacaoRestricaoPacienteOrm } from '../infraestrutura/solicitacao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { exigirReadCommitted } from './integridade-avaliacao-restricoes';
import { falharRestricao } from './falha-restricao';

export interface PacienteAcessivelPortal { pacienteId: string; via: AcessoPortalPaciente; nome: string }
export interface PedidoPortal extends SolicitacaoPortal { podeCancelar: boolean }

const CAMPO_PEDIDO = 'solicitacoes_restricoes_pacientes.conteudo_criptografado';
const CAMPO_EXPLICACAO = 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada';
const LIMITE_PEDIDOS = 100;
/** Máximo de pedidos abertos (enviados ou em análise) por paciente. */
export const LIMITE_PEDIDOS_ABERTOS = 50;
const LIMITE_RESTRICOES = 200;
const DECIDIDOS = ['atendida', 'parcial', 'recusada'];
const CANCELAVEIS = ['criada', 'em_analise'];

function invalido(): never { throw new BadRequestException('Solicitação inválida.'); }
function normalizar(usuario: UsuarioAutenticado, ...ids: unknown[]) {
  if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || ids.some(id => !isUUID(id))) return invalido();
  if (usuario.papel !== 'Patient') throw new ForbiddenException('Operação não autorizada.');
  return { u: { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() }, ids: ids.map(id => (id as string).toLowerCase()) };
}
/** Entrada fechada: só propriedades próprias, enumeráveis e de valor, em objeto simples. */
function entradaFechada(dados: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || ![Object.prototype, null].includes(Object.getPrototypeOf(dados))) return invalido();
  const d = Object.getOwnPropertyDescriptors(dados);
  if (Reflect.ownKeys(d).some(k => typeof k !== 'string' || !permitidas.includes(k)) ||
    Object.values(d).some(x => !x.enumerable || !Object.hasOwn(x, 'value'))) return invalido();
  return Object.fromEntries(Object.entries(d).map(([k, x]) => [k, x.value]));
}

/**
 * FOOD06 P2d-3a/3b: portal de restrições do paciente. O SELETOR lista os pacientes que a conta `Patient` do token pode
 * escolher (o próprio, pela conta, e os representados, por vínculo vigente). Toda leitura ou escrita sobre um paciente
 * escolhido prova o acesso com `autorizarPacientePortal`, sob lock e na transação, nunca com a lista.
 * O pedido (correção ou remoção) nunca altera a restrição; a declaração nova é uma pendência (`ServicoRegistroPendenciaRestricao`).
 */
@Injectable()
export class ServicoPortalRestricoes {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis) {}

  async listarPacientes(usuario: UsuarioAutenticado): Promise<PacienteAcessivelPortal[]> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId)) throw new BadRequestException('Solicitação inválida.');
    if (usuario.papel !== 'Patient') throw new ForbiddenException('Operação não autorizada.');
    const tenantId = usuario.tenantId.toLowerCase(), usuarioId = usuario.usuarioId.toLowerCase();
    try {
      return await this.executor.executar(tenantId, async g => {
        await exigirReadCommitted(g);
        const conta = await g.getRepository(UsuarioOrm).findOne({ where: { id: usuarioId, tenantId }, select: { id: true, role: true, ativo: true },
          lock: { mode: 'pessimistic_read' } });
        if (!conta?.ativo || conta.role !== 'Patient') throw new ForbiddenException('Operação não autorizada.');
        const linhas: Array<{ id: string; via: AcessoPortalPaciente; nome: Buffer }> = await g.query(`select p.id, 'propria' as via, p.nome_criptografado as nome
            from pacientes p where p.tenant_id = $1 and p.usuario_id = $2 and p.arquivado_em is null and p.status_ciclo_vida <> 'DELETED'
          union
          select p.id, 'representante' as via, p.nome_criptografado as nome
            from vinculos_representacao_paciente v join pacientes p on p.tenant_id = v.tenant_id and p.id = v.paciente_id
           where v.tenant_id = $1 and v.representante_usuario_id = $2 and v.revogado_em is null and p.arquivado_em is null and p.status_ciclo_vida <> 'DELETED'
             and p.usuario_id is distinct from $2
          order by via, id limit 101`, [tenantId, usuarioId]);
        const itens = linhas.map(l => {
          if (!isUUID(l.id) || (l.via !== 'propria' && l.via !== 'representante') || !Buffer.isBuffer(l.nome)) throw new InternalServerErrorException('Operação indisponível.');
          return { pacienteId: l.id, via: l.via, nome: this.cripto.descriptografar(l.nome) };
        });
        // `pacientes.usuario_id` não tem unique no banco: mais de um paciente "próprio" falha fechado em vez de listar.
        if (new Set(itens.map(i => i.pacienteId)).size !== itens.length || itens.filter(i => i.via === 'propria').length > 1) throw new ConflictException('Operação indisponível.');
        await registrarAuditoriaNaTransacao(g, { tenantId, usuarioId, acao: 'portal.restricoes.pacientes_listar', recursoTipo: 'usuario',
          recursoId: usuarioId, metadados: {} });
        return itens;
      });
    } catch (erro) { return falharRestricao(erro); }
  }

  private async noPaciente<T>(usuario: UsuarioAutenticado, ids: unknown[], fn: (g: EntityManager, u: UsuarioAutenticado, ids: string[]) => Promise<T>): Promise<T> {
    const n = normalizar(usuario, ...ids);
    try {
      return await this.executor.executar(n.u.tenantId, async g => {
        await exigirReadCommitted(g);
        await autorizarPacientePortal(g, n.u, n.ids[0]);
        return fn(g, n.u, n.ids);
      });
    } catch (erro) { return falharRestricao(erro, true); }
  }

  private projetarPedido(u: UsuarioAutenticado, s: SolicitacaoRestricaoPacienteOrm): PedidoPortal {
    const decidida = DECIDIDOS.includes(s.estado);
    const explicacao = decidida && s.explicacaoPacienteCriptografada
      ? decifrarCampo(this.cripto, CAMPO_EXPLICACAO, s.explicacaoPacienteCriptografada, { tenantId: u.tenantId, pacienteId: s.pacienteId, registroId: s.id, revisao: s.revisao })
      : undefined;
    const portal = projetarSolicitacaoPortal({ id: s.id, tipo: s.tipo, estado: s.estado, criadoEm: s.criadoEm?.toISOString?.(),
      ...(decidida ? { decididoEm: s.decididoEm?.toISOString?.(), explicacaoPaciente: explicacao } : {}) });
    return { ...portal, podeCancelar: s.autorUsuarioId === u.usuarioId && CANCELAVEIS.includes(s.estado) };
  }

  /** Resumo Q11: restrições visíveis ao paciente (allowlist em `projetarResumoPortal`), sem observação nem dado interno. */
  async resumo(usuario: UsuarioAutenticado, pacienteId: string): Promise<ResumoPortal> {
    return this.noPaciente(usuario, [pacienteId], async (g, u, [paciente]) => {
      const linhas = await g.getRepository(RestricaoPacienteOrm).find({
        where: { tenantId: u.tenantId, pacienteId: paciente, estado: In(['ativa', 'em_reavaliacao']), confirmacao: In(['pendente', 'confirmada']) },
        select: { id: true, origem: true, estado: true, confirmacao: true, revisao: true, conteudoCriptografado: true },
        order: { id: 'ASC' }, take: LIMITE_RESTRICOES + 1 });
      if (linhas.length > LIMITE_RESTRICOES) throw new ConflictException('Operação indisponível.');
      const avaliacao = await g.getRepository(AvaliacaoRestricoesPacienteOrm).findOne({ where: { tenantId: u.tenantId, pacienteId: paciente },
        select: { id: true, situacao: true, confirmadoEm: true } });
      const resumo = projetarResumoPortal(linhas.map(l => ({ id: l.id, origem: l.origem, estado: l.estado, confirmacao: l.confirmacao,
        conteudo: decifrarConteudoRestricao(this.cripto, l.conteudoCriptografado, { tenantId: u.tenantId, pacienteId: paciente, restricaoId: l.id,
          revisao: l.revisao, finalidade: 'restricao' }) })), avaliacao?.situacao === 'sem_restricoes_confirmadas' || avaliacao?.situacao === 'restricoes_registradas'
        ? { confirmadoEm: avaliacao.confirmadoEm ?? null } : null);
      await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'portal.restricoes.resumo',
        recursoTipo: 'paciente', recursoId: paciente, metadados: {} });
      return resumo;
    });
  }

  /** Os 100 pedidos mais recentes; `maisAntigos` avisa quando há mais (a lista nunca corta em silêncio). */
  async listarPedidos(usuario: UsuarioAutenticado, pacienteId: string): Promise<{ itens: PedidoPortal[]; maisAntigos: boolean }> {
    return this.noPaciente(usuario, [pacienteId], async (g, u, [paciente]) => {
      const linhas = await g.getRepository(SolicitacaoRestricaoPacienteOrm).find({ where: { tenantId: u.tenantId, pacienteId: paciente },
        order: { criadoEm: 'DESC', id: 'DESC' }, take: LIMITE_PEDIDOS + 1 });
      const itens = { itens: linhas.slice(0, LIMITE_PEDIDOS).map(s => this.projetarPedido(u, s)), maisAntigos: linhas.length > LIMITE_PEDIDOS };
      await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'portal.restricoes.pedidos_listar',
        recursoTipo: 'paciente', recursoId: paciente, metadados: {} });
      return itens;
    });
  }

  /**
   * Pedido de correção ou remoção de uma restrição visível do mesmo paciente. Idempotente por `chaveCriacao` do autor:
   * repetição com o mesmo conteúdo devolve o pedido existente; com conteúdo diferente, conflito.
   */
  async criarPedido(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<PedidoPortal> {
    const entrada = entradaFechada(dados, ['chaveCriacao', 'tipo', 'restricaoId', 'itens']);
    if (!isUUID(entrada.chaveCriacao) || !isUUID(entrada.restricaoId) || (entrada.tipo !== 'correcao' && entrada.tipo !== 'remocao')) return invalido();
    let pedido: PedidoSolicitacao;
    try { pedido = validarPedidoSolicitacao({ itens: entrada.itens }); } catch { return invalido(); }
    const tipo = entrada.tipo as 'correcao' | 'remocao';
    return this.noPaciente(usuario, [pacienteId, entrada.restricaoId, entrada.chaveCriacao], async (g, u, [paciente, restricaoId, chave]) => {
      await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`solicitacao:${u.tenantId}:${u.usuarioId}:${chave}`]);
      const repo = g.getRepository(SolicitacaoRestricaoPacienteOrm);
      const existente = await repo.findOne({ where: { tenantId: u.tenantId, autorUsuarioId: u.usuarioId, chaveCriacao: chave } });
      if (existente) {
        if (existente.pacienteId !== paciente || existente.tipo !== tipo || existente.restricaoId !== restricaoId) throw new ConflictException('Chave já utilizada.');
        const original = decifrarCampo(this.cripto, CAMPO_PEDIDO, existente.conteudoCriptografado, { tenantId: u.tenantId, pacienteId: paciente, registroId: existente.id, revisao: 1 });
        if (JSON.stringify(original) !== JSON.stringify(pedido)) throw new ConflictException('Chave já utilizada.');
        return this.projetarPedido(u, existente);
      }
      // Só restrição que o próprio portal mostra (ativa ou em reavaliação, não rejeitada) e do mesmo paciente.
      const alvo = await g.getRepository(RestricaoPacienteOrm).findOne({ where: { id: restricaoId, tenantId: u.tenantId, pacienteId: paciente,
        estado: In(['ativa', 'em_reavaliacao']), confirmacao: In(['pendente', 'confirmada']) }, select: { id: true } });
      if (!alvo) throw new ForbiddenException('Operação não autorizada.');
      // Teto de pedidos abertos por paciente (serializado pelo lock do paciente tomado na autorização).
      const abertos = await repo.count({ where: { tenantId: u.tenantId, pacienteId: paciente, estado: In(CANCELAVEIS as SolicitacaoRestricaoPacienteOrm['estado'][]) } });
      if (abertos >= LIMITE_PEDIDOS_ABERTOS) throw new ConflictException('Operação indisponível ou concorrente.');
      const id = randomUUID();
      const cifra = cifrarCampo(this.cripto, CAMPO_PEDIDO, pedido, { tenantId: u.tenantId, pacienteId: paciente, registroId: id, revisao: 1 });
      const linhas: Array<{ criado_em: Date }> = await g.query(`insert into solicitacoes_restricoes_pacientes
        (id, tenant_id, paciente_id, restricao_id, tipo, autor_usuario_id, chave_criacao, conteudo_criptografado)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning criado_em`, [id, u.tenantId, paciente, restricaoId, tipo, u.usuarioId, chave, cifra]);
      if (linhas.length !== 1) throw new InternalServerErrorException('Operação indisponível.');
      await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'restricoes.solicitacao_criar',
        recursoTipo: 'solicitacao_restricao_paciente', recursoId: id, metadados: {} });
      return { ...projetarSolicitacaoPortal({ id, tipo, estado: 'criada', criadoEm: linhas[0].criado_em.toISOString() }), podeCancelar: true };
    });
  }

  /** Só o AUTOR cancela, enquanto o pedido está enviado ou em análise. Trava a linha; a transição é a do domínio. */
  async cancelarPedido(usuario: UsuarioAutenticado, pacienteId: string, solicitacaoId: string): Promise<PedidoPortal> {
    return this.noPaciente(usuario, [pacienteId, solicitacaoId], async (g, u, [paciente, id]) => {
      const repo = g.getRepository(SolicitacaoRestricaoPacienteOrm);
      const s = await repo.findOne({ where: { id, tenantId: u.tenantId, pacienteId: paciente }, lock: { mode: 'pessimistic_write' } });
      if (!s || s.autorUsuarioId !== u.usuarioId) throw new ForbiddenException('Operação não autorizada.');
      let proximo: string;
      try { proximo = transicionarSolicitacao({ estado: s.estado, acao: 'cancelar', ator: 'paciente' }).estado; }
      catch { throw new ConflictException('Operação indisponível ou concorrente.'); }
      const r = await repo.update({ id, tenantId: u.tenantId, pacienteId: paciente, revisao: s.revisao, estado: s.estado },
        { estado: proximo as SolicitacaoRestricaoPacienteOrm['estado'], revisao: s.revisao + 1, atualizadoEm: () => 'clock_timestamp()' });
      if (r.affected !== 1) throw new ConflictException('Operação indisponível ou concorrente.');
      await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'restricoes.solicitacao_cancelar',
        recursoTipo: 'solicitacao_restricao_paciente', recursoId: id, metadados: {} });
      return this.projetarPedido(u, { ...s, estado: proximo as SolicitacaoRestricaoPacienteOrm['estado'], revisao: s.revisao + 1 });
    });
  }
}
