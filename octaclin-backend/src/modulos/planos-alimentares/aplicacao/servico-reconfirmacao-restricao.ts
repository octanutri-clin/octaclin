import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { EntityManager, In } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { registrarReconfirmacao } from '../dominio/reconfirmacao-restricao';
import { cifrarCampo, decifrarCampo, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';
import { ReconfirmacaoRestricoesOrm } from '../infraestrutura/reconfirmacao-restricoes.orm';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { falharRestricao } from './falha-restricao';

function instanteOuNulo(valor: Date | null | undefined): number | null {
  if (valor == null) return null;
  if (!(valor instanceof Date) || !Number.isFinite(valor.getTime())) throw new ConflictException('Avaliação indisponível.');
  return valor.getTime();
}

async function exigirReadCommitted(g: EntityManager): Promise<void> {
  // Snapshot fixo anterior ao lock do paciente não pode ser atualizado após espera.
  const isolamento: Array<{ transaction_isolation?: string }> = await g.query('show transaction_isolation');
  if (isolamento.length !== 1 || isolamento[0].transaction_isolation !== 'read committed') throw new ConflictException('Operação indisponível.');
}

async function exigirHistoricoConsistente(g: EntityManager, tenantId: string, pacienteId: string, avaliacao: AvaliacaoRestricoesPacienteOrm): Promise<void> {
  const revisao = await g.getRepository(RevisaoAvaliacaoRestricoesOrm).findOne({ where: { tenantId, pacienteId, avaliacaoId: avaliacao.id, numero: avaliacao.revisao } });
  if (!revisao || revisao.situacao !== avaliacao.situacao || instanteOuNulo(revisao.venceEm) !== instanteOuNulo(avaliacao.venceEm)) {
    throw new ConflictException('Avaliação alterada ou indisponível.');
  }
  // O driver Date perde microssegundos: compare também os valores exatos no PostgreSQL.
  const consistencia: Array<{ consistente: boolean }> = await g.query(`select
    (r.situacao = a.situacao and r.vence_em is not distinct from a.vence_em) as consistente
    from avaliacoes_restricoes_pacientes a
    join avaliacoes_restricoes_revisoes r on r.tenant_id=a.tenant_id and r.paciente_id=a.paciente_id and r.avaliacao_id=a.id and r.numero=a.revisao
    where a.tenant_id=$1 and a.paciente_id=$2 and a.id=$3 and a.revisao=$4`, [tenantId, pacienteId, avaliacao.id, avaliacao.revisao]);
  if (consistencia.length !== 1 || consistencia[0].consistente !== true) throw new ConflictException('Avaliação alterada ou indisponível.');
}

/** Incremento não exposto: atestações globais referenciadas à revisão existente. */
@Injectable()
export class ServicoReconfirmacaoRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis,
    private readonly concessoes: ServicoConcessoesPermissao) {}

  async garantirAvaliacaoInicial(usuario: UsuarioAutenticado, pacienteId: string): Promise<unknown> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId)) throw new BadRequestException('Solicitação inválida.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase();
    try {
      return await this.executor.executar(usuario.tenantId, async g => {
        await exigirReadCommitted(g);
        await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
        const repo = g.getRepository(AvaliacaoRestricoesPacienteOrm);
        const existente = await repo.findOne({ where: { tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' } });
        if (existente) {
          await exigirHistoricoConsistente(g, usuario.tenantId, pacienteId, existente);
          return { id: existente.id, revisao: existente.revisao, situacao: existente.situacao };
        }
        const id = randomUUID();
        await repo.insert({ id, tenantId: usuario.tenantId, pacienteId, situacao: 'nao_informado', revisao: 1,
          confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null });
        await g.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: usuario.tenantId, pacienteId, avaliacaoId: id,
          numero: 1, situacao: 'nao_informado', autorUsuarioId: usuario.usuarioId, venceEm: null });
        await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
          acao: 'restricoes.avaliacao_iniciada', recursoTipo: 'avaliacao_restricoes', recursoId: id, metadados: {} });
        return { id, revisao: 1, situacao: 'nao_informado' };
      });
    } catch (erro) { return falharRestricao(erro); }
  }

  async registrarPendencia(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<unknown> {
    return this.registrarResultado(usuario, pacienteId, dados, 'pendencia_mantida');
  }

  async registrarAlteracaoInformada(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<unknown> {
    return this.registrarResultado(usuario, pacienteId, dados, 'alteracao_informada');
  }

  async registrarSemAlteracao(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<unknown> {
    return this.registrarResultado(usuario, pacienteId, dados, 'sem_alteracao');
  }

  async registrarAusenciaDeclarada(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<unknown> {
    return this.registrarResultado(usuario, pacienteId, dados, 'sem_restricoes_declaradas');
  }

  private async registrarResultado(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown,
    resultado: 'pendencia_mantida' | 'alteracao_informada' | 'sem_alteracao' | 'sem_restricoes_declaradas'): Promise<unknown> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId) ||
      !dados || typeof dados !== 'object' || Array.isArray(dados) || ![Object.prototype, null].includes(Object.getPrototypeOf(dados))) {
      throw new BadRequestException('Solicitação inválida.');
    }
    const descritores = Object.getOwnPropertyDescriptors(dados);
    if (Reflect.ownKeys(descritores).some(k => typeof k !== 'string' || !['avaliacaoId', 'revisaoAvaliacao', 'chaveIdempotencia', 'meio', 'atestacao', 'confirmacaoExplicitaAusencia'].includes(k)) ||
      Object.values(descritores).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) throw new BadRequestException('Solicitação inválida.');
    const entrada: Record<string, unknown> = Object.create(null);
    for (const [k, d] of Object.entries(descritores)) entrada[k] = d.value;
    if (resultado !== 'sem_restricoes_declaradas' && Object.hasOwn(entrada, 'confirmacaoExplicitaAusencia')) throw new BadRequestException('Solicitação inválida.');
    if (!isUUID(entrada.avaliacaoId) || !isUUID(entrada.chaveIdempotencia) || !Number.isSafeInteger(entrada.revisaoAvaliacao) ||
      (entrada.revisaoAvaliacao as number) < 1) throw new BadRequestException('Solicitação inválida.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase();
    const avaliacaoId = (entrada.avaliacaoId as string).toLowerCase();
    const chaveIdempotencia = (entrada.chaveIdempotencia as string).toLowerCase();
    const revisaoAvaliacao = entrada.revisaoAvaliacao as number;
    let atestacao: ReturnType<typeof registrarReconfirmacao>;
    try { atestacao = registrarReconfirmacao({ agora: new Date().toISOString(), pacienteId, avaliacaoId, revisaoAvaliacao,
      atestadoPor: usuario.usuarioId, meio: entrada.meio, atestacao: entrada.atestacao, resultado,
      ...(resultado === 'sem_restricoes_declaradas' ? { confirmacaoExplicitaAusencia: entrada.confirmacaoExplicitaAusencia } : {}) }); }
    catch { throw new BadRequestException('Solicitação inválida.'); }
    try {
      return await this.executor.executar(usuario.tenantId, async g => {
        await exigirReadCommitted(g);
        await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
        await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`reconfirmacao:${usuario.tenantId}:${usuario.usuarioId}:${chaveIdempotencia}`]);
        const repo = g.getRepository(ReconfirmacaoRestricoesOrm);
        const existente = await repo.findOne({ where: { tenantId: usuario.tenantId, atestadoPorUsuarioId: usuario.usuarioId, chaveIdempotencia } });
        if (existente) {
          if (existente.pacienteId !== pacienteId || existente.avaliacaoId !== avaliacaoId || existente.revisaoAvaliacao !== revisaoAvaliacao ||
            existente.meio !== atestacao.meio || existente.restricaoId || Boolean(existente.venceEm) !== atestacao.renovaAvaliacao) throw new ConflictException('Chave já utilizada.');
          const valor = decifrarCampo(this.cripto, 'reconfirmacoes_restricoes.resultado_criptografado', existente.resultadoCriptografado,
            { tenantId: usuario.tenantId, pacienteId, registroId: existente.id, revisao: 1 });
          if (JSON.stringify(valor) !== JSON.stringify({ resultado })) throw new ConflictException('Chave já utilizada.');
          return { id: existente.id, resultado };
        }
        const avaliacao = await g.getRepository(AvaliacaoRestricoesPacienteOrm).findOne({ where: { id: avaliacaoId, tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' } });
        if (!avaliacao || avaliacao.revisao !== revisaoAvaliacao) throw new ConflictException('Avaliação alterada ou indisponível.');
        await exigirHistoricoConsistente(g, usuario.tenantId, pacienteId, avaliacao);
        if (!['nao_informado', 'sem_restricoes_confirmadas', 'restricoes_registradas'].includes(avaliacao.situacao)) throw new ConflictException('Avaliação indisponível.');
        const atestadoEm = new Date();
        let venceEm: Date | null = null;
        if (resultado === 'sem_alteracao' || resultado === 'sem_restricoes_declaradas') {
          if (resultado === 'sem_alteracao' && avaliacao.situacao === 'nao_informado') throw new ConflictException('Avaliação indisponível.');
          const restricoes = g.getRepository(RestricaoPacienteOrm);
          let confirmadas = 0;
          let deslocamento = 0;
          // O lock do paciente serializa os escritores P2; nunca inferir a natureza da coluna de estado.
          for (;;) {
            const pagina = await restricoes.find({ where: { tenantId: usuario.tenantId, pacienteId,
              estado: In(['ativa', 'em_reavaliacao']), confirmacao: In(['pendente', 'confirmada']) },
              select: { id: true, revisao: true, confirmacao: true, conteudoCriptografado: true },
              order: { id: 'ASC' }, skip: deslocamento, take: 100 });
            for (const linha of pagina) {
              const conteudo = decifrarConteudoRestricao(this.cripto, linha.conteudoCriptografado,
                { tenantId: usuario.tenantId, pacienteId, restricaoId: linha.id, revisao: linha.revisao, finalidade: 'restricao' });
              if (conteudo.natureza === 'preferencia') continue;
              if (linha.confirmacao === 'pendente') throw new ConflictException('Avaliação indisponível.');
              confirmadas += 1;
            }
            if (pagina.length < 100) break;
            deslocamento += pagina.length;
          }
          if ((resultado === 'sem_restricoes_declaradas' && confirmadas > 0) ||
            (resultado === 'sem_alteracao' && avaliacao.situacao === 'sem_restricoes_confirmadas' && confirmadas > 0) ||
            (resultado === 'sem_alteracao' && avaliacao.situacao === 'restricoes_registradas' && confirmadas === 0)) throw new ConflictException('Avaliação indisponível.');
          const validade = registrarReconfirmacao({ agora: atestadoEm.toISOString(), pacienteId, avaliacaoId, revisaoAvaliacao,
            atestadoPor: usuario.usuarioId, meio: entrada.meio, atestacao: entrada.atestacao, resultado,
            ...(resultado === 'sem_restricoes_declaradas' ? { confirmacaoExplicitaAusencia: entrada.confirmacaoExplicitaAusencia } : {}) });
          if (!validade.venceEm) throw new ConflictException('Avaliação indisponível.');
          venceEm = new Date(validade.venceEm);
          const situacao = resultado === 'sem_restricoes_declaradas' ? 'sem_restricoes_confirmadas' : avaliacao.situacao;
          const alterada = await g.getRepository(AvaliacaoRestricoesPacienteOrm).update(
            { id: avaliacaoId, tenantId: usuario.tenantId, pacienteId, revisao: revisaoAvaliacao },
            { situacao, revisao: revisaoAvaliacao + 1, confirmadoPorUsuarioId: usuario.usuarioId,
              confirmadoEm: atestadoEm, venceEm, atualizadoEm: () => 'clock_timestamp()' });
          if (alterada.affected !== 1) throw new ConflictException('Avaliação alterada ou indisponível.');
          await g.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: usuario.tenantId, pacienteId, avaliacaoId,
            numero: revisaoAvaliacao + 1, situacao, autorUsuarioId: usuario.usuarioId, venceEm });
          await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
            acao: 'restricoes.avaliacao_reconfirmada', recursoTipo: 'avaliacao_restricoes', recursoId: avaliacaoId, metadados: {} });
        } else if (avaliacao.situacao !== 'nao_informado') {
          const alterada = await g.getRepository(AvaliacaoRestricoesPacienteOrm).update(
            { id: avaliacaoId, tenantId: usuario.tenantId, pacienteId, revisao: revisaoAvaliacao },
            { situacao: 'nao_informado', revisao: revisaoAvaliacao + 1, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null, atualizadoEm: () => 'clock_timestamp()' });
          if (alterada.affected !== 1) throw new ConflictException('Avaliação alterada ou indisponível.');
          await g.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: usuario.tenantId, pacienteId, avaliacaoId,
            numero: revisaoAvaliacao + 1, situacao: 'nao_informado', autorUsuarioId: usuario.usuarioId, venceEm: null });
          await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
            acao: 'restricoes.avaliacao_invalidada', recursoTipo: 'avaliacao_restricoes', recursoId: avaliacaoId, metadados: {} });
        }
        const id = randomUUID();
        const resultadoCriptografado = cifrarCampo(this.cripto, 'reconfirmacoes_restricoes.resultado_criptografado', { resultado },
          { tenantId: usuario.tenantId, pacienteId, registroId: id, revisao: 1 });
        await repo.insert({ id, tenantId: usuario.tenantId, pacienteId, avaliacaoId, revisaoAvaliacao, atestadoPorUsuarioId: usuario.usuarioId,
          atestadoEm, meio: atestacao.meio, resultadoCriptografado, venceEm, chaveIdempotencia });
        await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
          acao: resultado === 'pendencia_mantida' ? 'restricoes.reconfirmacao_pendencia' : resultado === 'alteracao_informada' ? 'restricoes.reconfirmacao_alteracao' : resultado === 'sem_alteracao' ? 'restricoes.reconfirmacao_sem_alteracao' : 'restricoes.reconfirmacao_ausencia',
          recursoTipo: 'reconfirmacao_restricoes', recursoId: id, metadados: {} });
        return { id, resultado };
      });
    } catch (erro) { return falharRestricao(erro); }
  }
}
