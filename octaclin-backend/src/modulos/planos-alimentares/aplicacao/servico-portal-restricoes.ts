import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import type { AcessoPortalPaciente } from './autorizacao-paciente-portal';
import { exigirReadCommitted } from './integridade-avaliacao-restricoes';
import { falharRestricao } from './falha-restricao';

export interface PacienteAcessivelPortal { pacienteId: string; via: AcessoPortalPaciente; nome: string }

/**
 * FOOD06 P2d-3a: portal de restrições do paciente. Nesta etapa só o SELETOR: os pacientes que a conta `Patient` do token
 * pode escolher (o próprio, pela conta, e os representados, por vínculo vigente). As rotas que leem ou escrevem
 * restrições de um paciente escolhido (P2d-3b) provam o acesso com `autorizarPacientePortal`, nunca com esta lista.
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
            from pacientes p where p.tenant_id = $1 and p.usuario_id = $2 and p.arquivado_em is null
          union
          select p.id, 'representante' as via, p.nome_criptografado as nome
            from vinculos_representacao_paciente v join pacientes p on p.tenant_id = v.tenant_id and p.id = v.paciente_id
           where v.tenant_id = $1 and v.representante_usuario_id = $2 and v.revogado_em is null and p.arquivado_em is null
             and p.usuario_id is distinct from $2
          order by via, id limit 100`, [tenantId, usuarioId]);
        const itens = linhas.map(l => {
          if (!isUUID(l.id) || (l.via !== 'propria' && l.via !== 'representante') || !Buffer.isBuffer(l.nome)) throw new InternalServerErrorException('Operação indisponível.');
          return { pacienteId: l.id, via: l.via, nome: this.cripto.descriptografar(l.nome) };
        });
        if (new Set(itens.map(i => i.pacienteId)).size !== itens.length) throw new ConflictException('Operação indisponível.');
        await registrarAuditoriaNaTransacao(g, { tenantId, usuarioId, acao: 'portal.restricoes.pacientes_listar', recursoTipo: 'usuario',
          recursoId: usuarioId, metadados: {} });
        return itens;
      });
    } catch (erro) { return falharRestricao(erro); }
  }
}
