import { ForbiddenException } from '@nestjs/common';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import * as delegacoes from '../../profissionais/aplicacao/servico-delegacoes-carteira';
import * as portal from './autorizacao-paciente-portal';
import { autorizarPendenciaRestricao } from './autorizacao-pendencia-restricao';

const tenant = '11111111-1111-4111-8111-111111111111';
const usuarioId = '22222222-2222-4222-8222-222222222222';
const pacienteId = '33333333-3333-4333-8333-333333333333';
const ator: UsuarioAutenticado = { tenantId: tenant, usuarioId, papel: 'Professional', emailHash: '', permissoes: [] };
function preparar() {
  const usuario = { findOne: jest.fn(async () => ({ id: 'usuario', role: 'Professional', ativo: true })) };
  const profissional = { findOne: jest.fn(async () => ({ id: 'profissional' })) };
  const paciente = { findOne: jest.fn(async () => ({ id: pacienteId })), find: jest.fn(async () => [{ id: pacienteId }]) };
  const g = { queryRunner: { isTransactionActive: true }, getRepository: jest.fn((entity: unknown) => {
    if (entity === UsuarioOrm) return usuario; if (entity === ProfissionalOrm) return profissional;
    if (entity === PacienteOrm) return paciente; throw new Error('Repositório inesperado');
  }) };
  return { usuario, profissional, paciente, g, chamar: (u = ator) => autorizarPendenciaRestricao(g as never, u, pacienteId) };
}
describe('autorização para registrar pendência', () => {
  it('permite profissional ativo da carteira sem exigir concessão clínica', async () => {
    const c = preparar(); await expect(c.chamar()).resolves.toBe('profissional');
    expect(c.paciente.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: pacienteId, tenantId: tenant, profissionalResponsavelId: 'profissional' }), lock: { mode: 'pessimistic_write' } }));
  });
  it('recusa profissional de outra carteira e tenant', async () => {
    const c = preparar(); c.paciente.findOne.mockResolvedValueOnce(null as never);
    await expect(c.chamar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('recusa sessão desatualizada ou inativa', async () => {
    const c = preparar(); c.usuario.findOne.mockResolvedValueOnce({ id: 'usuario', role: 'Collaborator', ativo: false });
    await expect(c.chamar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  describe('Patient (P2d-3b)', () => {
    afterEach(() => jest.restoreAllMocks());
    it('própria conta ou representante registra como declaração do paciente, pela prova do portal', async () => {
      const c = preparar(); const prova = jest.spyOn(portal, 'autorizarPacientePortal').mockResolvedValue('representante');
      await expect(c.chamar({ ...ator, papel: 'Patient' })).resolves.toBe('declaracao_paciente');
      expect(prova).toHaveBeenCalledWith(c.g, expect.objectContaining({ papel: 'Patient' }), pacienteId);
      expect(c.usuario.findOne).not.toHaveBeenCalled(); expect(c.paciente.findOne).not.toHaveBeenCalled();
    });
    it('sem acesso ao paciente (prova do portal falha) nega', async () => {
      const c = preparar(); jest.spyOn(portal, 'autorizarPacientePortal').mockRejectedValue(new ForbiddenException('Operação não autorizada.'));
      await expect(c.chamar({ ...ator, papel: 'Patient' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
  describe('Collaborator (P2d-2)', () => {
    afterEach(() => jest.restoreAllMocks());
    it('com delegação vigente do responsável atual registra como colaborador, sem tocar no caminho do profissional', async () => {
      const c = preparar(); const prova = jest.spyOn(delegacoes, 'autorizarColaboradorDelegado').mockResolvedValue(undefined);
      await expect(c.chamar({ ...ator, papel: 'Collaborator' })).resolves.toBe('colaborador');
      expect(prova).toHaveBeenCalledWith(c.g, tenant, usuarioId, pacienteId);
      expect(c.profissional.findOne).not.toHaveBeenCalled(); expect(c.paciente.findOne).not.toHaveBeenCalled();
    });
    it('sem delegação vigente (prova falha) nega', async () => {
      const c = preparar(); jest.spyOn(delegacoes, 'autorizarColaboradorDelegado').mockRejectedValue(new ForbiddenException('Operação não autorizada.'));
      await expect(c.chamar({ ...ator, papel: 'Collaborator' })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('Professional nunca usa o caminho da delegação', async () => {
      const c = preparar(); const prova = jest.spyOn(delegacoes, 'autorizarColaboradorDelegado');
      await expect(c.chamar()).resolves.toBe('profissional'); expect(prova).not.toHaveBeenCalled();
    });
  });
  it.each(['SuperAdmin', 'Client'] as const)('nega papel %s', async papel => {
    const c = preparar(); await expect(c.chamar({ ...ator, papel })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('não trabalha fora de transação', async () => {
    const c = preparar(); c.g.queryRunner.isTransactionActive = false;
    await expect(c.chamar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('nega tenant ou usuário inválido antes de consultar', async () => {
    const c = preparar(); await expect(c.chamar({ ...ator, tenantId: '' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.g.getRepository).not.toHaveBeenCalled();
  });
});
