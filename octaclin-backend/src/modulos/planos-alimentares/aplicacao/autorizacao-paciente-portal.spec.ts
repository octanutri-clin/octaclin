import { ForbiddenException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { VinculoRepresentacaoPacienteOrm } from '../../pacientes/infraestrutura/vinculo-representacao-paciente.orm';
import { autorizarPacientePortal } from './autorizacao-paciente-portal';

const tenant = '11111111-1111-4111-8111-111111111111';
const conta = '22222222-2222-4222-8222-222222222222';
const pacienteId = '33333333-3333-4333-8333-333333333333';
const ator: UsuarioAutenticado = { tenantId: tenant, usuarioId: conta, papel: 'Patient', emailHash: '', permissoes: [] };

function preparar() {
  const ordem: string[] = [];
  const usuario = { findOne: jest.fn(async (): Promise<unknown> => { ordem.push('usuario'); return { id: conta, role: 'Patient', ativo: true }; }) };
  const paciente = { findOne: jest.fn(async (): Promise<unknown> => { ordem.push('paciente'); return { id: pacienteId, usuarioId: 'outra-conta' }; }) };
  const vinculo = { findOne: jest.fn(async (): Promise<unknown> => { ordem.push('vinculo'); return { id: 'v' }; }) };
  const g = { queryRunner: { isTransactionActive: true }, getRepository: jest.fn((e: unknown) => {
    if (e === UsuarioOrm) return usuario; if (e === PacienteOrm) return paciente; if (e === VinculoRepresentacaoPacienteOrm) return vinculo; throw new Error('Repositório inesperado');
  }) };
  return { ordem, usuario, paciente, vinculo, g, chamar: (u = ator, p = pacienteId) => autorizarPacientePortal(g as never, u, p) };
}

describe('autorização do portal do paciente (P2d-3a)', () => {
  it('a conta do próprio paciente acessa sem vínculo', async () => {
    const c = preparar(); c.paciente.findOne.mockResolvedValueOnce({ id: pacienteId, usuarioId: conta });
    await expect(c.chamar()).resolves.toBe('propria'); expect(c.vinculo.findOne).not.toHaveBeenCalled();
  });
  it('representante com vínculo vigente acessa; ordem usuário → paciente → vínculo, com travas', async () => {
    const c = preparar();
    await expect(c.chamar({ ...ator, usuarioId: conta.toUpperCase() }, pacienteId.toUpperCase())).resolves.toBe('representante');
    expect(c.ordem).toEqual(['usuario', 'paciente', 'vinculo']);
    expect(c.usuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: conta, tenantId: tenant }, lock: { mode: 'pessimistic_read' } }));
    expect(c.paciente.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: pacienteId, tenantId: tenant }), lock: { mode: 'pessimistic_write' } }));
    expect(c.vinculo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant, pacienteId,
      representanteUsuarioId: conta, revogadoEm: expect.anything() }), lock: { mode: 'pessimistic_read' } }));
  });
  it.each([
    ['sem vínculo vigente', (c: ReturnType<typeof preparar>) => { c.vinculo.findOne.mockResolvedValueOnce(null); }],
    ['conta inativa', (c: ReturnType<typeof preparar>) => { c.usuario.findOne.mockResolvedValueOnce({ id: conta, role: 'Patient', ativo: false }); }],
    ['papel trocado no banco', (c: ReturnType<typeof preparar>) => { c.usuario.findOne.mockResolvedValueOnce({ id: conta, role: 'Collaborator', ativo: true }); }],
    ['paciente arquivado, inexistente ou de outro tenant', (c: ReturnType<typeof preparar>) => { c.paciente.findOne.mockResolvedValueOnce(null); }],
    ['paciente eliminado por LGPD, mesmo pela própria conta', (c: ReturnType<typeof preparar>) => { c.paciente.findOne.mockResolvedValueOnce({ id: pacienteId, usuarioId: conta, statusCicloVida: 'DELETED' }); }]
  ])('%s: nega', async (_caso, ajustar) => {
    const c = preparar(); ajustar(c);
    await expect(c.chamar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['Professional', 'Collaborator', 'SuperAdmin', 'Client'] as const)('papel %s nunca passa', async papel => {
    const c = preparar(); await expect(c.chamar({ ...ator, papel })).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.g.getRepository).not.toHaveBeenCalled();
  });
  it('fora de transação ou com ids inválidos nega antes do banco', async () => {
    const c = preparar(); c.g.queryRunner.isTransactionActive = false;
    await expect(c.chamar()).rejects.toBeInstanceOf(ForbiddenException);
    const d = preparar(); await expect(d.chamar(ator, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    expect(d.g.getRepository).not.toHaveBeenCalled();
  });
});
