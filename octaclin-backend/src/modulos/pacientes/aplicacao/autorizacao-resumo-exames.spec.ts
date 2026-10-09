import { podeLerResumoExames } from './autorizacao-resumo-exames';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

describe('autorização da leitura de exames no resumo', () => {
  const base = {
    tenantId: 'tenant-1',
    permissoes: ['pacientes.ler'] as UsuarioAutenticado['permissoes']
  };

  it.each(['SuperAdmin', 'Professional', 'Collaborator'] as const)(
    'permite o papel clínico %s no tenant autenticado com pacientes.ler',
    (papel) => {
      expect(podeLerResumoExames('tenant-1', { ...base, papel })).toBe(true);
    }
  );

  it.each([
    ['tenant diferente', 'tenant-2', { ...base, papel: 'SuperAdmin' }],
    ['papel Patient', 'tenant-1', { ...base, papel: 'Patient' }],
    ['papel Client', 'tenant-1', { ...base, papel: 'Client' }],
    ['sem pacientes.ler', 'tenant-1', { ...base, papel: 'Collaborator', permissoes: [] as UsuarioAutenticado['permissoes'] }]
  ])('nega %s antes de consultar exames', (_caso, tenantId, usuario) => {
    expect(podeLerResumoExames(tenantId as string, usuario as Pick<UsuarioAutenticado, 'tenantId' | 'papel' | 'permissoes'>)).toBe(false);
  });
});
