import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import type { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import type { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { cifrarConteudoRestricao, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';

export class ServicoConfirmacaoRestricao {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis,
    private readonly concessoes: ServicoConcessoesPermissao) {}
  async confirmar(usuario: UsuarioAutenticado, pacienteId: string, restricaoId: string, revisao: number): Promise<unknown> {
    if (!Number.isSafeInteger(revisao) || revisao < 1) throw new ConflictException('Revisão inválida.');
    return this.executor.executar(usuario.tenantId, async g => {
      await autorizarRestricaoClinica(g, this.concessoes, usuario, pacienteId);
      // Até existir reconciliação transacional da avaliação, rejeitar a
      // combinação inconsistente. Todo escritor futuro deve bloquear o mesmo
      // paciente antes de ler ou alterar a avaliação e suas restrições.
      const avaliacao = await g.getRepository(AvaliacaoRestricoesPacienteOrm).findOne({
        where: { tenantId: usuario.tenantId, pacienteId }, lock: { mode: 'pessimistic_write' }
      });
      if (avaliacao?.situacao === 'sem_restricoes_confirmadas') {
        throw new ConflictException('Avaliação precisa ser reconciliada antes da confirmação.');
      }
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
      const alterado = await repo.update({ ...where, revisao }, { revisao: proxima, confirmacao: 'confirmada', confirmadoPorUsuarioId: usuario.usuarioId, confirmadoEm: new Date(), conteudoCriptografado: atual });
      if (alterado.affected !== 1) throw new ConflictException('Restrição alterada ou indisponível.');
      await historico.insert({ tenantId: usuario.tenantId, pacienteId, restricaoId, numero: proxima, evento: 'confirmacao', autorUsuarioId: usuario.usuarioId, conteudoCriptografado: snapshot });
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'restricoes.confirmar', recursoTipo: 'restricao_paciente', recursoId: restricaoId, metadados: {} });
      return { id: restricaoId, revisao: proxima, confirmacao: 'confirmada' };
    });
  }
}
