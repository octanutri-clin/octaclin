import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import type { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import type { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';
import { cifrarCampo, cifrarConteudoRestricao, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { avaliarInativacao, InativacaoInvalidaError } from '../dominio/inativacao-restricao-protegida';
import { validarTextoProtegido } from '../dominio/conteudo-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';

export class ServicoConfirmacaoRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis,
    private readonly concessoes: ServicoConcessoesPermissao) {}
  async inativar(usuario: UsuarioAutenticado, pacienteId: string, restricaoId: string, revisao: number,
    dados: { motivo: string; justificativa: string; confirmacaoEmDoisPassos: boolean }): Promise<unknown> {
    const motivos = ['registro_incorreto', 'informacao_clinica_revisada', 'solicitacao_fundamentada', 'outro'] as const;
    if (!Number.isSafeInteger(revisao) || revisao < 1 || !dados || typeof dados !== 'object' || Array.isArray(dados) ||
      Reflect.ownKeys(dados).some(k => typeof k !== 'string' || !['motivo', 'justificativa', 'confirmacaoEmDoisPassos'].includes(k)) ||
      !motivos.includes(dados.motivo as typeof motivos[number]) || dados.confirmacaoEmDoisPassos !== true) throw new BadRequestException('Solicitação inválida.');
    let justificativa: string;
    try { justificativa = validarTextoProtegido(dados.justificativa); } catch { throw new BadRequestException('Solicitação inválida.'); }
    return this.executor.executar(usuario.tenantId, async g => {
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      const avaliacoes = g.getRepository(AvaliacaoRestricoesPacienteOrm);
      const avaliacao = await avaliacoes.findOne({ where: { tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' } });
      const repo = g.getRepository(RestricaoPacienteOrm);
      const historico = g.getRepository(RevisaoRestricaoPacienteOrm);
      const where = { id: restricaoId, tenantId: usuario.tenantId, pacienteId };
      const linha = await repo.findOne({ where, lock: { mode: 'pessimistic_write' } });
      if (!linha) throw new ForbiddenException('Operação não autorizada.');
      if (linha.revisao !== revisao || linha.confirmacao !== 'confirmada' || linha.estado === 'inativa') throw new ConflictException('Restrição alterada ou indisponível.');
      if (avaliacao?.situacao === 'sem_restricoes_confirmadas') throw new ConflictException('Avaliação inconsistente; confira o estado.');
      const base = { tenantId: usuario.tenantId, pacienteId, restricaoId };
      const conteudo = decifrarConteudoRestricao(this.cripto, linha.conteudoCriptografado, { ...base, revisao, finalidade: 'restricao' });
      let avaliacaoPedido: ReturnType<typeof avaliarInativacao>;
      try {
        avaliacaoPedido = avaliarInativacao({ restricao: { id: restricaoId, revisao, natureza: conteudo.natureza,
          ...(conteudo.subtipoClinico ? { subtipoClinico: conteudo.subtipoClinico } : {}), ...(conteudo.gravidade ? { gravidade: conteudo.gravidade } : {}),
          confirmacao: linha.confirmacao, estado: linha.estado }, motivo: dados.motivo, justificativa,
          confirmacaoEmDoisPassos: dados.confirmacaoEmDoisPassos, impressoesAfetadas: [] });
      } catch (erro) {
        if (erro instanceof InativacaoInvalidaError) throw new BadRequestException('Solicitação inválida.');
        throw erro;
      }
      if (!avaliacaoPedido.permitida) throw new ConflictException('Inativação indisponível.');
      const proxima = revisao + 1;
      const atual = cifrarConteudoRestricao(this.cripto, conteudo, { ...base, revisao: proxima, finalidade: 'restricao' });
      const snapshot = cifrarConteudoRestricao(this.cripto, conteudo, { ...base, revisao: proxima, finalidade: 'revisao_restricao' });
      const motivoCifrado = cifrarCampo(this.cripto, 'restricoes_pacientes_revisoes.justificativa_criptografada', justificativa,
        { tenantId: usuario.tenantId, pacienteId, registroId: restricaoId, revisao: proxima });
      const alterado = await repo.update({ ...where, revisao }, { revisao: proxima, estado: 'inativa', conteudoCriptografado: atual, atualizadoEm: () => 'clock_timestamp()' });
      if (alterado.affected !== 1) throw new ConflictException('Restrição alterada ou indisponível.');
      if (avaliacao?.situacao === 'restricoes_registradas') {
        const filtro = { id: avaliacao.id, tenantId: usuario.tenantId, pacienteId, revisao: avaliacao.revisao };
        const mudou = await avaliacoes.update(filtro, { situacao: 'nao_informado', revisao: avaliacao.revisao + 1,
          confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null, atualizadoEm: () => 'clock_timestamp()' });
        if (mudou.affected !== 1) throw new ConflictException('Avaliação alterada; tente novamente.');
        await g.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: usuario.tenantId, pacienteId,
          avaliacaoId: avaliacao.id, numero: avaliacao.revisao + 1, situacao: 'nao_informado', autorUsuarioId: usuario.usuarioId, venceEm: null });
        await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
          acao: 'restricoes.avaliacao_invalidada', recursoTipo: 'avaliacao_restricoes', recursoId: avaliacao.id, metadados: {} });
      }
      await historico.insert({ tenantId: usuario.tenantId, pacienteId, restricaoId, numero: proxima, evento: 'inativacao',
        motivoInativacao: dados.motivo as typeof motivos[number], confirmacaoDoisPassos: true,
        autorUsuarioId: usuario.usuarioId, conteudoCriptografado: snapshot, justificativaCriptografada: motivoCifrado });
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.inativar', recursoTipo: 'restricao_paciente', recursoId: restricaoId, metadados: {} });
      return { id: restricaoId, revisao: proxima, estado: 'inativa' };
    });
  }
  async confirmar(usuario: UsuarioAutenticado, pacienteId: string, restricaoId: string, revisao: number): Promise<unknown> {
    if (!Number.isSafeInteger(revisao) || revisao < 1) throw new ConflictException('Revisão inválida.');
    return this.executor.executar(usuario.tenantId, async g => {
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      // Todos os escritores de avaliação/restrição devem serializar pelo paciente.
      const avaliacoes = g.getRepository(AvaliacaoRestricoesPacienteOrm);
      const avaliacao = await avaliacoes.findOne({
        where: { tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' }
      });
      const repo = g.getRepository(RestricaoPacienteOrm);
      const historico = g.getRepository(RevisaoRestricaoPacienteOrm);
      const where = { id: restricaoId, tenantId: usuario.tenantId, pacienteId };
      const linha = await repo.findOne({ where, lock: { mode: 'pessimistic_write' } });
      if (!linha) throw new ForbiddenException('Operação não autorizada.');
      if (linha.revisao !== revisao || linha.confirmacao !== 'pendente' || linha.estado !== 'ativa') {
        throw new ConflictException('Restrição alterada ou indisponível.');
      }
      const base = { tenantId: usuario.tenantId, pacienteId, restricaoId };
      const conteudo = decifrarConteudoRestricao(this.cripto, linha.conteudoCriptografado, { ...base, revisao, finalidade: 'restricao' });
      if (conteudo.natureza === 'preferencia') throw new ConflictException('Preferência não requer confirmação clínica.');
      const proxima = revisao + 1;
      const atual = cifrarConteudoRestricao(this.cripto, conteudo, { ...base, revisao: proxima, finalidade: 'restricao' });
      const snapshot = cifrarConteudoRestricao(this.cripto, conteudo, { ...base, revisao: proxima, finalidade: 'revisao_restricao' });
      const alterado = await repo.update({ ...where, revisao }, { revisao: proxima, confirmacao: 'confirmada', confirmadoPorUsuarioId: usuario.usuarioId, confirmadoEm: new Date(), conteudoCriptografado: atual, atualizadoEm: () => 'clock_timestamp()' });
      if (alterado.affected !== 1) throw new ConflictException('Restrição alterada ou indisponível.');
      if (avaliacao?.situacao === 'sem_restricoes_confirmadas') {
        const filtro = { id: avaliacao.id, tenantId: usuario.tenantId, pacienteId, revisao: avaliacao.revisao };
        const mudou = await avaliacoes.update(filtro, { situacao: 'nao_informado', revisao: avaliacao.revisao + 1,
          confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null, atualizadoEm: () => 'clock_timestamp()' });
        if (mudou.affected !== 1) throw new ConflictException('Avaliação alterada; tente novamente.');
        await g.getRepository(RevisaoAvaliacaoRestricoesOrm).insert({ tenantId: usuario.tenantId, pacienteId,
          avaliacaoId: avaliacao.id, numero: avaliacao.revisao + 1, situacao: 'nao_informado', autorUsuarioId: usuario.usuarioId, venceEm: null });
        await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
          acao: 'restricoes.avaliacao_invalidada', recursoTipo: 'avaliacao_restricoes', recursoId: avaliacao.id, metadados: {} });
      }
      await historico.insert({ tenantId: usuario.tenantId, pacienteId, restricaoId, numero: proxima, evento: 'confirmacao', autorUsuarioId: usuario.usuarioId, conteudoCriptografado: snapshot });
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'restricoes.confirmar', recursoTipo: 'restricao_paciente', recursoId: restricaoId, metadados: {} });
      return { id: restricaoId, revisao: proxima, confirmacao: 'confirmada' };
    });
  }
}
