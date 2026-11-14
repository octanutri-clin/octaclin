import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { registrarReconfirmacao } from '../dominio/reconfirmacao-restricao';
import { cifrarCampo, decifrarCampo } from '../infraestrutura/codec-conteudo-restricao';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';
import { ReconfirmacaoRestricoesOrm } from '../infraestrutura/reconfirmacao-restricoes.orm';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { falharRestricao } from './falha-restricao';

/** Incremento não exposto: apenas atestação de pendência mantida, sem renovar avaliação. */
@Injectable()
export class ServicoReconfirmacaoRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis,
    private readonly concessoes: ServicoConcessoesPermissao) {}

  async registrarPendencia(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<unknown> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId) ||
      !dados || typeof dados !== 'object' || Array.isArray(dados) || ![Object.prototype, null].includes(Object.getPrototypeOf(dados))) {
      throw new BadRequestException('Solicitação inválida.');
    }
    const descritores = Object.getOwnPropertyDescriptors(dados);
    if (Reflect.ownKeys(descritores).some(k => typeof k !== 'string' || !['avaliacaoId', 'revisaoAvaliacao', 'chaveIdempotencia', 'meio', 'atestacao'].includes(k)) ||
      Object.values(descritores).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) throw new BadRequestException('Solicitação inválida.');
    const entrada: Record<string, unknown> = Object.create(null);
    for (const [k, d] of Object.entries(descritores)) entrada[k] = d.value;
    if (!isUUID(entrada.avaliacaoId) || !isUUID(entrada.chaveIdempotencia) || !Number.isSafeInteger(entrada.revisaoAvaliacao) ||
      (entrada.revisaoAvaliacao as number) < 1) throw new BadRequestException('Solicitação inválida.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase();
    const avaliacaoId = (entrada.avaliacaoId as string).toLowerCase();
    const chaveIdempotencia = (entrada.chaveIdempotencia as string).toLowerCase();
    const revisaoAvaliacao = entrada.revisaoAvaliacao as number;
    let atestacao: ReturnType<typeof registrarReconfirmacao>;
    try { atestacao = registrarReconfirmacao({ agora: new Date().toISOString(), pacienteId, avaliacaoId, revisaoAvaliacao,
      atestadoPor: usuario.usuarioId, meio: entrada.meio, atestacao: entrada.atestacao, resultado: 'pendencia_mantida' }); }
    catch { throw new BadRequestException('Solicitação inválida.'); }
    try {
      return await this.executor.executar(usuario.tenantId, async g => {
        await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
        await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`reconfirmacao:${usuario.tenantId}:${usuario.usuarioId}:${chaveIdempotencia}`]);
        const repo = g.getRepository(ReconfirmacaoRestricoesOrm);
        const existente = await repo.findOne({ where: { tenantId: usuario.tenantId, atestadoPorUsuarioId: usuario.usuarioId, chaveIdempotencia } });
        if (existente) {
          if (existente.pacienteId !== pacienteId || existente.avaliacaoId !== avaliacaoId || existente.revisaoAvaliacao !== revisaoAvaliacao ||
            existente.meio !== atestacao.meio || existente.restricaoId || existente.venceEm) throw new ConflictException('Chave já utilizada.');
          const valor = decifrarCampo(this.cripto, 'reconfirmacoes_restricoes.resultado_criptografado', existente.resultadoCriptografado,
            { tenantId: usuario.tenantId, pacienteId, registroId: existente.id, revisao: 1 });
          if (JSON.stringify(valor) !== JSON.stringify({ resultado: 'pendencia_mantida' })) throw new ConflictException('Chave já utilizada.');
          return { id: existente.id, resultado: 'pendencia_mantida' };
        }
        const avaliacao = await g.getRepository(AvaliacaoRestricoesPacienteOrm).findOne({ where: { id: avaliacaoId, tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' } });
        if (!avaliacao || avaliacao.revisao !== revisaoAvaliacao) throw new ConflictException('Avaliação alterada ou indisponível.');
        const revisao = await g.getRepository(RevisaoAvaliacaoRestricoesOrm).findOne({ where: { tenantId: usuario.tenantId, pacienteId, avaliacaoId, numero: revisaoAvaliacao } });
        if (!revisao) throw new ConflictException('Avaliação alterada ou indisponível.');
        const id = randomUUID();
        const resultadoCriptografado = cifrarCampo(this.cripto, 'reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'pendencia_mantida' },
          { tenantId: usuario.tenantId, pacienteId, registroId: id, revisao: 1 });
        await repo.insert({ id, tenantId: usuario.tenantId, pacienteId, avaliacaoId, revisaoAvaliacao, atestadoPorUsuarioId: usuario.usuarioId,
          atestadoEm: new Date(), meio: atestacao.meio, resultadoCriptografado, venceEm: null, chaveIdempotencia });
        await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'restricoes.reconfirmacao_pendencia', recursoTipo: 'reconfirmacao_restricoes', recursoId: id, metadados: {} });
        return { id, resultado: 'pendencia_mantida' };
      });
    } catch (erro) { return falharRestricao(erro); }
  }
}
