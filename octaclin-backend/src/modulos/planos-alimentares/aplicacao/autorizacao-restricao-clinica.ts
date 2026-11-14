import { ForbiddenException } from '@nestjs/common';
import { IsNull, type EntityManager } from 'typeorm';
import type { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';

export async function autorizarRestricaoClinica(
  gerenciador: EntityManager, concessoes: ServicoConcessoesPermissao,
  usuario: UsuarioAutenticado, pacienteId: string
): Promise<void> {
  const negar = () => new ForbiddenException('Operação não autorizada.');
  if (!gerenciador.queryRunner?.isTransactionActive || usuario?.papel !== 'Professional') throw negar();
  await concessoes.exigir(usuario.tenantId, usuario.usuarioId, 'restricoes.confirmar', gerenciador);
  const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
    where: { usuarioId: usuario.usuarioId, tenantId: usuario.tenantId, arquivadoEm: IsNull() },
    lock: { mode: 'pessimistic_read' }
  });
  if (!profissional) throw negar();
  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    where: { id: pacienteId, tenantId: usuario.tenantId, profissionalResponsavelId: profissional.id, arquivadoEm: IsNull() },
    lock: { mode: 'pessimistic_write' }
  });
  if (!paciente) throw negar();
}
