import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EntityManager, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import type { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import type { PermissaoOctaClin } from '../dominio/permissoes';
import { ConcessaoPermissaoUsuarioOrm } from '../infraestrutura/concessao-permissao-usuario.orm';

export interface ConcederPermissao {
  usuarioId: string;
  permissao: 'restricoes.confirmar';
  motivo: 'habilitacao_administrativa';
  confirmacaoDoisPassos: boolean;
}
const negar = () => new ForbiddenException('Operação não autorizada.');
const invalido = () => new BadRequestException('Solicitação inválida.');
function confirmar(dados: unknown, chaves: string[]): asserts dados is Record<string, unknown> {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) ||
      Object.keys(dados).some(chave => !chaves.includes(chave)) ||
      (dados as Record<string, unknown>).confirmacaoDoisPassos !== true) throw invalido();
}
function projetar(linha: ConcessaoPermissaoUsuarioOrm) {
  return { id: linha.id, usuarioId: linha.usuarioId, permissao: linha.permissao,
    concedidaEm: linha.concedidaEm, revogadaEm: linha.revogadaEm };
}
async function auditar(g: EntityManager, tenantId: string, atorId: string, id: string, acao: string) {
  await registrarAuditoriaNaTransacao(g, { tenantId, usuarioId: atorId, acao,
    recursoTipo: 'concessao_permissao_usuario', recursoId: id, metadados: {} });
}
/** Mesma transação que muda papel/ativo, após bloquear o usuário. */
export async function revogarConcessoesPorAlteracaoAcesso(
  g: EntityManager, tenantId: string, usuarioId: string, atorId: string
): Promise<void> {
  const repo = g.getRepository(ConcessaoPermissaoUsuarioOrm);
  const ativas = await repo.find({ where: { tenantId, usuarioId, revogadaEm: IsNull() }, order: { id: 'ASC' } });
  for (const linha of ativas) {
    const resultado = await repo.update({ id: linha.id, tenantId, usuarioId, revogadaEm: IsNull() },
      { revogadaPor: atorId, revogadaEm: () => 'clock_timestamp()' });
    if (resultado.affected) await auditar(g, tenantId, atorId, linha.id, 'permissoes_usuario.revogar_por_alteracao_acesso');
  }
}
@Injectable()
export class ServicoConcessoesPermissao {
  constructor(private readonly executor: ExecutorTenant) {}
  /** Na ação protegida, fornecer o gerenciador e manter os locks até o commit.
   * A forma com 3 argumentos confere só o instante, não cria capability durável. */
  async exigir(tenantId: string, usuarioId: string, permissao: PermissaoOctaClin, g?: EntityManager): Promise<void> {
    if (!isUUID(tenantId) || !isUUID(usuarioId) || permissao !== 'restricoes.confirmar') throw negar();
    const conferir = async (gerenciador: EntityManager) => {
      const usuario = await this.usuario(gerenciador, tenantId, usuarioId, 'pessimistic_read');
      if (!usuario?.ativo || usuario.role !== 'Professional') throw negar();
      const concessao = await gerenciador.getRepository(ConcessaoPermissaoUsuarioOrm).findOne({
        where: { tenantId, usuarioId, permissao, revogadaEm: IsNull() }, lock: { mode: 'pessimistic_read' }
      });
      if (!concessao) throw negar();
    };
    if (g) {
      if (!g.queryRunner?.isTransactionActive) throw negar();
      await conferir(g);
    } else await this.executor.executar(tenantId, conferir);
  }
  async conceder(u: UsuarioAutenticado, dados: ConcederPermissao) {
    confirmar(dados, ['usuarioId', 'permissao', 'motivo', 'confirmacaoDoisPassos']);
    if (!isUUID(dados.usuarioId) || dados.permissao !== 'restricoes.confirmar' ||
        dados.motivo !== 'habilitacao_administrativa') throw invalido();
    return this.transacao(u, async g => {
      await this.bloquearUsuarios(g, u, dados.usuarioId);
      const alvo = await this.usuario(g, u.tenantId, dados.usuarioId);
      if (!alvo?.ativo || alvo.role !== 'Professional') throw negar();
      const repo = g.getRepository(ConcessaoPermissaoUsuarioOrm);
      if (await repo.findOne({ where: { tenantId: u.tenantId, usuarioId: dados.usuarioId,
        permissao: dados.permissao, revogadaEm: IsNull() } })) throw new ConflictException('Concessão já ativa.');
      const linha = await repo.save(repo.create({ tenantId: u.tenantId, usuarioId: dados.usuarioId,
        permissao: dados.permissao, concedidaPor: u.usuarioId, motivo: dados.motivo,
        revogadaPor: null, revogadaEm: null }));
      await auditar(g, u.tenantId, u.usuarioId, linha.id, 'permissoes_usuario.conceder');
      return projetar(linha);
    });
  }
  async revogar(u: UsuarioAutenticado, id: string, dados: { confirmacaoDoisPassos: boolean }) {
    confirmar(dados, ['confirmacaoDoisPassos']);
    if (!isUUID(id)) throw invalido();
    return this.transacao(u, async g => {
      const repo = g.getRepository(ConcessaoPermissaoUsuarioOrm);
      const origem = await repo.findOne({ where: { id, tenantId: u.tenantId }, select: { id: true, usuarioId: true } });
      if (!origem) throw negar();
      await this.bloquearUsuarios(g, u, origem.usuarioId);
      const linha = await repo.findOne({ where: { id, tenantId: u.tenantId }, lock: { mode: 'pessimistic_write' } });
      if (!linha) throw negar();
      if (linha.revogadaEm) return projetar(linha);
      await repo.update({ id, tenantId: u.tenantId, revogadaEm: IsNull() },
        { revogadaPor: u.usuarioId, revogadaEm: () => 'clock_timestamp()' });
      await auditar(g, u.tenantId, u.usuarioId, id, 'permissoes_usuario.revogar');
      return projetar(await repo.findOneByOrFail({ id, tenantId: u.tenantId }));
    });
  }
  async listar(u: UsuarioAutenticado, usuarioId: string, pagina = 1, limite = 25) {
    if (!isUUID(usuarioId) || !Number.isInteger(pagina) || pagina < 1 || pagina > 1000 ||
        !Number.isInteger(limite) || limite < 1 || limite > 50) throw invalido();
    return this.transacao(u, async g => {
      await this.bloquearUsuarios(g, u, usuarioId);
      if (!await this.usuario(g, u.tenantId, usuarioId)) throw negar();
      const [linhas, total] = await g.getRepository(ConcessaoPermissaoUsuarioOrm).findAndCount({
        where: { tenantId: u.tenantId, usuarioId }, order: { concedidaEm: 'DESC', id: 'ASC' },
        skip: (pagina - 1) * limite, take: limite
      });
      return { itens: linhas.map(projetar), total, pagina, limite };
    });
  }
  private async usuario(g: EntityManager, tenantId: string, id: string, lock?: 'pessimistic_read' | 'pessimistic_write') {
    return g.getRepository(UsuarioOrm).findOne({ where: { tenantId, id },
      select: { id: true, tenantId: true, role: true, ativo: true }, ...(lock ? { lock: { mode: lock } } : {}) });
  }
  private async autorizar(g: EntityManager, u: UsuarioAutenticado) {
    const ator = await this.usuario(g, u.tenantId, u.usuarioId);
    if (!ator?.ativo || !['Professional', 'SuperAdmin'].includes(ator.role)) throw negar();
  }
  private async bloquearUsuarios(g: EntityManager, u: UsuarioAutenticado, alvoId: string) {
    // Ordem global: usuários ordenados, depois concessão. Evita A→B / B→A.
    for (const id of [...new Set([u.usuarioId, alvoId])].sort()) {
      if (!await this.usuario(g, u.tenantId, id, 'pessimistic_write')) throw negar();
    }
    await this.autorizar(g, u);
  }
  private async transacao<T>(u: UsuarioAutenticado, fn: (g: EntityManager) => Promise<T>): Promise<T> {
    if (!isUUID(u?.tenantId) || !isUUID(u?.usuarioId)) throw negar();
    try {
      return await this.executor.executar(u.tenantId, async g => { await this.autorizar(g, u); return fn(g); });
    } catch (erro) {
      if (['23505', '40P01', '40001'].includes((erro as { code?: string }).code ?? '')) {
        throw new ConflictException('Operação concorrente. Confira o estado e tente novamente.');
      }
      throw erro;
    }
  }
}
