import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarTextoProtegido } from '../dominio/conteudo-restricao';
import { validarDesfechoSolicitacao, type DesfechoSolicitacao, type PedidoSolicitacao } from '../dominio/solicitacao-restricao-paciente';
import { cifrarCampo, decifrarCampo } from '../infraestrutura/codec-conteudo-restricao';
import { SolicitacaoRestricaoPacienteOrm } from '../infraestrutura/solicitacao-restricao-paciente.orm';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { exigirReadCommitted } from './integridade-avaliacao-restricoes';
import { falharRestricao } from './falha-restricao';

const LIMITE_LISTA = 100;
const CAMPO_PEDIDO = 'solicitacoes_restricoes_pacientes.conteudo_criptografado';
const CAMPO_EXPLICACAO = 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada';
const CAMPO_JUSTIFICATIVA = 'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada';
const CAMPO_DESFECHO = 'solicitacoes_restricoes_pacientes.desfecho_criptografado';

function invalido(): never { throw new BadRequestException('Solicitação inválida.'); }
function normalizar(usuario: UsuarioAutenticado, ...ids: string[]) {
  if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || ids.some(id => !isUUID(id))) return invalido();
  return { usuario: { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() }, ids: ids.map(id => id.toLowerCase()) };
}
function revisaoValida(revisao: unknown): number {
  return Number.isSafeInteger(revisao) && (revisao as number) >= 1 ? revisao as number : invalido();
}
/** Entrada fechada: só propriedades próprias, enumeráveis e de valor (sem getters), em objeto simples. */
function entradaFechada(dados: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || ![Object.prototype, null].includes(Object.getPrototypeOf(dados))) return invalido();
  const descritores = Object.getOwnPropertyDescriptors(dados);
  if (Reflect.ownKeys(descritores).some(k => typeof k !== 'string' || !permitidas.includes(k)) ||
    Object.values(descritores).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) return invalido();
  return Object.fromEntries(Object.entries(descritores).map(([k, d]) => [k, d.value]));
}

/**
 * FOOD06 P2c: lado do PROFISSIONAL das solicitações do paciente (D7-a). Exige `Professional` com a concessão
 * `restricoes.confirmar` e o paciente na carteira, na mesma transação. A solicitação NUNCA altera a restrição: a
 * decisão só registra o desfecho das operações clínicas já feitas (itens alterados com a revisão resultante, e
 * inalterados). Criar e cancelar pelo paciente dependem do vínculo de representação (P2d).
 */
@Injectable()
export class ServicoSolicitacoesRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis,
    private readonly concessoes: ServicoConcessoesPermissao) {}

  async listar(usuarioEntrada: UsuarioAutenticado, pacienteEntrada: string): Promise<unknown[]> {
    const { usuario, ids: [pacienteId] } = normalizar(usuarioEntrada, pacienteEntrada);
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      const linhas = await g.getRepository(SolicitacaoRestricaoPacienteOrm).find({
        where: { tenantId: usuario.tenantId, pacienteId }, order: { criadoEm: 'DESC', id: 'DESC' }, take: LIMITE_LISTA });
      const vinculo = (s: SolicitacaoRestricaoPacienteOrm, revisao: number) => ({ tenantId: usuario.tenantId, pacienteId, registroId: s.id, revisao });
      const lista = linhas.map(s => {
        const pedido = decifrarCampo(this.cripto, CAMPO_PEDIDO, s.conteudoCriptografado, vinculo(s, 1)) as PedidoSolicitacao;
        const decidida = ['atendida', 'parcial', 'recusada'].includes(s.estado);
        return {
          id: s.id, tipo: s.tipo, estado: s.estado, revisao: s.revisao, ...(s.restricaoId ? { restricaoId: s.restricaoId } : {}),
          criadoEm: s.criadoEm.toISOString(), pedido,
          ...(decidida ? {
            decididoEm: (s.decididoEm as Date).toISOString(),
            explicacaoPaciente: decifrarCampo(this.cripto, CAMPO_EXPLICACAO, s.explicacaoPacienteCriptografada as Buffer, vinculo(s, s.revisao)),
            ...(s.justificativaInternaCriptografada ? { justificativaInterna: decifrarCampo(this.cripto, CAMPO_JUSTIFICATIVA, s.justificativaInternaCriptografada, vinculo(s, s.revisao)) } : {}),
            desfecho: decifrarCampo(this.cripto, CAMPO_DESFECHO, s.desfechoCriptografado as Buffer, vinculo(s, s.revisao))
          } : {})
        };
      });
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.solicitacoes_listar', recursoTipo: 'paciente', recursoId: pacienteId, metadados: {} });
      return lista;
    }); } catch (erro) { return falharRestricao(erro); }
  }

  async iniciarAnalise(usuarioEntrada: UsuarioAutenticado, pacienteEntrada: string, solicitacaoEntrada: string, revisaoEntrada: number): Promise<unknown> {
    const { usuario, ids: [pacienteId, solicitacaoId] } = normalizar(usuarioEntrada, pacienteEntrada, solicitacaoEntrada);
    const revisao = revisaoValida(revisaoEntrada);
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      const repo = g.getRepository(SolicitacaoRestricaoPacienteOrm);
      const where = { id: solicitacaoId, tenantId: usuario.tenantId, pacienteId };
      const s = await repo.findOne({ where, lock: { mode: 'pessimistic_write' } });
      if (!s) throw new ForbiddenException('Operação não autorizada.');
      if (s.revisao !== revisao || s.estado !== 'criada') throw new ConflictException('Solicitação alterada ou indisponível.');
      const mudou = await repo.update({ ...where, revisao, estado: 'criada' }, { estado: 'em_analise', revisao: revisao + 1, atualizadoEm: () => 'clock_timestamp()' });
      if (mudou.affected !== 1) throw new ConflictException('Solicitação alterada ou indisponível.');
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.solicitacao_iniciar_analise', recursoTipo: 'solicitacao_restricao', recursoId: solicitacaoId, metadados: {} });
      return { id: solicitacaoId, revisao: revisao + 1, estado: 'em_analise' };
    }); } catch (erro) { return falharRestricao(erro); }
  }

  async decidir(usuarioEntrada: UsuarioAutenticado, pacienteEntrada: string, solicitacaoEntrada: string, revisaoEntrada: number,
    dados: unknown): Promise<unknown> {
    const { usuario, ids: [pacienteId, solicitacaoId] } = normalizar(usuarioEntrada, pacienteEntrada, solicitacaoEntrada);
    const revisao = revisaoValida(revisaoEntrada);
    const entrada = entradaFechada(dados, ['estadoFinal', 'explicacaoPaciente', 'justificativaInterna', 'alterados', 'inalterados']);
    let desfecho: DesfechoSolicitacao, explicacao: string, justificativa: string | undefined;
    try {
      desfecho = validarDesfechoSolicitacao({ estadoFinal: entrada.estadoFinal, alterados: entrada.alterados, inalterados: entrada.inalterados });
      explicacao = validarTextoProtegido(entrada.explicacaoPaciente);
      justificativa = entrada.justificativaInterna === undefined ? undefined : validarTextoProtegido(entrada.justificativaInterna);
    } catch { return invalido(); }
    const alterados = desfecho.alterados.map(a => ({ ...a, restricaoId: a.restricaoId.toLowerCase() }));
    if (alterados.some(a => !isUUID(a.restricaoId))) return invalido();
    try { return await this.executor.executar(usuario.tenantId, async g => {
      await exigirReadCommitted(g);
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      const repo = g.getRepository(SolicitacaoRestricaoPacienteOrm);
      const where = { id: solicitacaoId, tenantId: usuario.tenantId, pacienteId };
      const s = await repo.findOne({ where, lock: { mode: 'pessimistic_write' } });
      if (!s) throw new ForbiddenException('Operação não autorizada.');
      if (s.revisao !== revisao || s.estado !== 'em_analise') throw new ConflictException('Solicitação alterada ou indisponível.');
      const pedido = decifrarCampo(this.cripto, CAMPO_PEDIDO, s.conteudoCriptografado,
        { tenantId: usuario.tenantId, pacienteId, registroId: solicitacaoId, revisao: 1 }) as PedidoSolicitacao;
      // O desfecho responde a TODOS os itens do pedido, e a nenhum outro.
      const doPedido = pedido.itens.map(i => i.item).sort();
      const respondidos = [...alterados.map(a => a.item), ...desfecho.inalterados].sort();
      if (JSON.stringify(doPedido) !== JSON.stringify(respondidos)) throw new BadRequestException('Solicitação inválida.');
      if (s.tipo !== 'inclusao' && alterados.some(a => a.restricaoId !== s.restricaoId)) throw new BadRequestException('Solicitação inválida.');
      for (const a of alterados) {
        // A alteração foi feita por uma operação clínica DEPOIS do pedido, no mesmo paciente: o desfecho só a referencia.
        const existe = await g.query(`select true as existe from restricoes_pacientes_revisoes r
          join solicitacoes_restricoes_pacientes s on s.tenant_id = r.tenant_id and s.paciente_id = r.paciente_id and s.id = $5
          where r.tenant_id = $1 and r.paciente_id = $2 and r.restricao_id = $3 and r.numero = $4 and r.criado_em > s.criado_em`,
        [usuario.tenantId, pacienteId, a.restricaoId, a.revisaoResultante, solicitacaoId]) as unknown[];
        if (existe.length !== 1) throw new ConflictException('Desfecho sem operação clínica correspondente.');
      }
      const proxima = revisao + 1;
      const vinculo = { tenantId: usuario.tenantId, pacienteId, registroId: solicitacaoId, revisao: proxima };
      const persistido = { estadoFinal: desfecho.estadoFinal, alterados, inalterados: desfecho.inalterados };
      const mudou = await repo.update({ ...where, revisao, estado: 'em_analise' }, {
        estado: desfecho.estadoFinal, revisao: proxima, decididoPorUsuarioId: usuario.usuarioId, decididoEm: () => 'clock_timestamp()',
        explicacaoPacienteCriptografada: cifrarCampo(this.cripto, CAMPO_EXPLICACAO, explicacao, vinculo),
        ...(justificativa !== undefined ? { justificativaInternaCriptografada: cifrarCampo(this.cripto, CAMPO_JUSTIFICATIVA, justificativa, vinculo) } : {}),
        desfechoCriptografado: cifrarCampo(this.cripto, CAMPO_DESFECHO, persistido, vinculo),
        atualizadoEm: () => 'clock_timestamp()'
      } as never);
      if (mudou.affected !== 1) throw new ConflictException('Solicitação alterada ou indisponível.');
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.solicitacao_decidir', recursoTipo: 'solicitacao_restricao', recursoId: solicitacaoId, metadados: {} });
      return { id: solicitacaoId, revisao: proxima, estado: desfecho.estadoFinal };
    }); } catch (erro) { return falharRestricao(erro); }
  }
}
