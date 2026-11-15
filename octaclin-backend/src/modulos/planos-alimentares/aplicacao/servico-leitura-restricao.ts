import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { exigirReadCommitted } from './integridade-avaliacao-restricoes';
import { falharRestricao } from './falha-restricao';

/** Leitura clínica individual; ainda não exposta por HTTP na aplicação. */
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
      const linha = await g.getRepository(RestricaoPacienteOrm).findOne({ where: { id: restricaoId, tenantId: usuario.tenantId, pacienteId },
        select: { id: true, revisao: true, origem: true, estado: true, confirmacao: true, conteudoCriptografado: true } });
      if (!linha) throw new ForbiddenException('Operação não autorizada.');
      const base = { tenantId: usuario.tenantId, pacienteId, restricaoId, revisao: linha.revisao };
      const anterior = await g.getRepository(RevisaoRestricaoPacienteOrm).findOne({ where: { tenantId: usuario.tenantId, pacienteId, restricaoId, numero: linha.revisao } });
      if (!anterior || (anterior.evento === 'inativacao') !== (linha.estado === 'inativa') ||
        (anterior.evento === 'rejeicao') !== (linha.confirmacao === 'rejeitada') ||
        (anterior.evento === 'criacao' && (linha.estado !== 'ativa' || linha.confirmacao !== 'pendente')) ||
        (anterior.evento === 'confirmacao' && (linha.estado !== 'ativa' || linha.confirmacao !== 'confirmada')) ||
        (anterior.evento === 'rejeicao' && linha.estado !== 'ativa') ||
        (anterior.evento === 'inativacao' && linha.confirmacao !== 'confirmada') ||
        (anterior.evento === 'reavaliacao' && (linha.estado !== 'em_reavaliacao' || linha.confirmacao !== 'confirmada')) ||
        (anterior.evento === 'reativacao' && (linha.estado !== 'ativa' || linha.confirmacao !== 'confirmada'))) throw new ConflictException('Restrição indisponível.');
      const conteudo = decifrarConteudoRestricao(this.cripto, linha.conteudoCriptografado, { ...base, finalidade: 'restricao' });
      const historico = decifrarConteudoRestricao(this.cripto, anterior.conteudoCriptografado, { ...base, finalidade: 'revisao_restricao' });
      if (JSON.stringify(conteudo) !== JSON.stringify(historico)) throw new ConflictException('Restrição indisponível.');
      await registrarAuditoriaNaTransacao(g, { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
        acao: 'restricoes.consultar', recursoTipo: 'restricao_paciente', recursoId: restricaoId, metadados: {} });
      return { id: linha.id, revisao: linha.revisao, origem: linha.origem, estado: linha.estado, confirmacao: linha.confirmacao, conteudo };
    }); } catch (erro) { return falharRestricao(erro); }
  }
}
