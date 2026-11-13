import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarConteudoRestricao } from '../dominio/conteudo-restricao';
import { cifrarConteudoRestricao, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';
import { autorizarPendenciaRestricao } from './autorizacao-pendencia-restricao';
import { falharRestricao } from './falha-restricao';

@Injectable()
export class ServicoRegistroPendenciaRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis) {}
  async registrar(usuario: UsuarioAutenticado, pacienteId: string, dados: unknown): Promise<unknown> {
    if (!usuario || !isUUID(usuario.tenantId) || !isUUID(usuario.usuarioId) || !isUUID(pacienteId)) throw new BadRequestException('Solicitação inválida.');
    usuario = { ...usuario, tenantId: usuario.tenantId.toLowerCase(), usuarioId: usuario.usuarioId.toLowerCase() };
    pacienteId = pacienteId.toLowerCase();
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(dados)) ||
      Reflect.ownKeys(dados).some(k => typeof k !== 'string' || !['chaveCriacao', 'conteudo'].includes(k)) ||
      Object.values(Object.getOwnPropertyDescriptors(dados)).some(d => !d.enumerable || !Object.hasOwn(d, 'value'))) {
      throw new BadRequestException('Solicitação inválida.');
    }
    const entrada = dados as Record<string, unknown>;
    if (!isUUID(entrada.chaveCriacao)) throw new BadRequestException('Solicitação inválida.');
    const chaveCriacao = (entrada.chaveCriacao as string).toLowerCase();
    try {
      return await this.executor.executar(usuario.tenantId, async g => {
      const origem = await autorizarPendenciaRestricao(g, usuario, pacienteId);
      let conteudo: ReturnType<typeof validarConteudoRestricao>;
      try { conteudo = validarConteudoRestricao(entrada.conteudo); } catch { throw new BadRequestException('Solicitação inválida.'); }
      if (conteudo.natureza === 'preferencia') throw new BadRequestException('Preferência indisponível neste fluxo.');
      await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`${usuario.tenantId}:${usuario.usuarioId}:${chaveCriacao}`]);
      const repo = g.getRepository(RestricaoPacienteOrm);
      const historico = g.getRepository(RevisaoRestricaoPacienteOrm);
      const existente = await repo.findOne({ where: { tenantId: usuario.tenantId, autorUsuarioId: usuario.usuarioId, chaveCriacao } });
      if (existente) {
        if (existente.pacienteId !== pacienteId) throw new ConflictException('Chave já utilizada.');
        const criacao = await historico.findOne({ where: { tenantId: usuario.tenantId, pacienteId, restricaoId: existente.id, numero: 1, evento: 'criacao' } });
        if (!criacao) throw new ConflictException('Registro indisponível para repetição.');
        const original = decifrarConteudoRestricao(this.cripto, criacao.conteudoCriptografado,
          { tenantId: usuario.tenantId, pacienteId, restricaoId: existente.id, revisao: 1, finalidade: 'revisao_restricao' });
        if (JSON.stringify(original) !== JSON.stringify(conteudo)) throw new ConflictException('Chave já utilizada.');
        return { id: existente.id, revisao: existente.revisao, confirmacao: existente.confirmacao, estado: existente.estado };
      }
      const avaliacoes = g.getRepository(AvaliacaoRestricoesPacienteOrm);
      const avaliacao = await avaliacoes.findOne({ where: { tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' } });
      const id = randomUUID();
      const vinculo = { tenantId: usuario.tenantId, pacienteId, restricaoId: id, revisao: 1 };
      const cifra = cifrarConteudoRestricao(this.cripto, conteudo, { ...vinculo, finalidade: 'restricao' });
      const snapshot = cifrarConteudoRestricao(this.cripto, conteudo, { ...vinculo, finalidade: 'revisao_restricao' });
      await repo.insert({ id, tenantId: usuario.tenantId, pacienteId, autorUsuarioId: usuario.usuarioId, chaveCriacao,
        origem, estado: 'ativa', confirmacao: 'pendente', revisao: 1, conteudoCriptografado: cifra });
      await historico.insert({ tenantId: usuario.tenantId, pacienteId, restricaoId: id, numero: 1, evento: 'criacao', autorUsuarioId: usuario.usuarioId, conteudoCriptografado: snapshot });
      if (avaliacao?.situacao === 'sem_restricoes_confirmadas') {
        const mudou = await avaliacoes.update({ id: avaliacao.id, tenantId: usuario.tenantId, pacienteId, revisao: avaliacao.revisao },
          { situacao: 'nao_informado', revisao: avaliacao.revisao + 1, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null, atualizadoEm: () => 'clock_timestamp()' });
        if (mudou.affected !== 1) throw new ConflictException('Avaliação alterada; tente novamente.');
        await g.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: usuario.tenantId, pacienteId, avaliacaoId: avaliacao.id,
          numero: avaliacao.revisao + 1, situacao: 'nao_informado', autorUsuarioId: usuario.usuarioId, venceEm: null });
        await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'restricoes.avaliacao_invalidada', recursoTipo: 'avaliacao_restricoes', recursoId: avaliacao.id, metadados: {} });
      }
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'restricoes.registrar_pendencia', recursoTipo: 'restricao_paciente', recursoId: id, metadados: {} });
      return { id, revisao: 1, confirmacao: 'pendente', estado: 'ativa' };
      });
    } catch (erro) {
      return falharRestricao(erro, true);
    }
  }
}
