import { ForbiddenException } from '@nestjs/common';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';

const usuario: UsuarioAutenticado = { usuarioId: 'usuario', tenantId: 'tenant', papel: 'Professional', emailHash: '', permissoes: [] };
function preparar() {
  const profissional = { findOne: jest.fn(async () => ({ id: 'profissional' })) };
  const paciente = { findOne: jest.fn(async () => ({ id: 'paciente' })) };
  const g = { queryRunner: { isTransactionActive: true }, getRepository: jest.fn((entidade: unknown) => {
    if (entidade === ProfissionalOrm) return profissional;
    if (entidade === PacienteOrm) return paciente;
    throw new Error('Repositório inesperado');
  }) };
  const concessoes = { exigir: jest.fn(async () => undefined) };
  const executar = (u = usuario) => autorizarRestricaoClinica(g as never, concessoes as never, u, 'paciente');
  return { g, profissional, paciente, concessoes, executar };
}
describe('Autorização da ação clínica de restrição', () => {
  it('exige concessão na mesma transação e filtra paciente pelo tenant e profissional responsável', async () => {
    const c = preparar();
    await expect(c.executar()).resolves.toBeUndefined();
    expect(c.concessoes.exigir).toHaveBeenCalledWith('tenant', 'usuario', 'restricoes.confirmar', c.g);
    expect(c.profissional.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant', usuarioId: 'usuario' }) }));
    expect(c.paciente.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'paciente', tenantId: 'tenant', profissionalResponsavelId: 'profissional' }), lock: { mode: 'pessimistic_write' } }));
  });
  it.each(['SuperAdmin', 'Collaborator', 'Patient', 'Client'] as const)('nega papel %s mesmo com concessão aparente', async papel => {
    const c = preparar();
    await expect(c.executar({ ...usuario, papel })).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.concessoes.exigir).not.toHaveBeenCalled();
  });
  it('nega execução fora de transação ativa', async () => {
    const c = preparar(); c.g.queryRunner.isTransactionActive = false;
    await expect(c.executar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('nega paciente fora da carteira ou tenant', async () => {
    const c = preparar(); c.paciente.findOne.mockResolvedValueOnce(null as never);
    await expect(c.executar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('não consulta paciente se a concessão falhar ou estiver revogada', async () => {
    const c = preparar(); c.concessoes.exigir.mockRejectedValueOnce(new ForbiddenException());
    await expect(c.executar()).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.paciente.findOne).not.toHaveBeenCalled();
  });
  it('nega profissional sem vínculo', async () => {
    const c = preparar(); c.profissional.findOne.mockResolvedValueOnce(null as never);
    await expect(c.executar()).rejects.toBeInstanceOf(ForbiddenException);
  });
});
