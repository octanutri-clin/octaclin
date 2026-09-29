import { instalarTemplatesIniciaisNoTenant } from './templates-iniciais';

describe('instalarTemplatesIniciaisNoTenant', () => {
  it('é idempotente por tenant e não altera modelos personalizados', async () => {
    const gravados: Array<Record<string, unknown>> = [{
      id: 'modelo-customizado', tenantId: 'tenant-1', codigoExterno: 'octaclin_inicial_boas_vindas', nome: 'Texto da clínica'
    }];
    const repositorio = {
      find: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
        gravados.filter((template) => template.tenantId === where.tenantId)),
      create: jest.fn((entrada) => entrada),
      save: jest.fn(async (entrada) => {
        const salvo = { id: `modelo-${gravados.length + 1}`, ...entrada };
        gravados.push(salvo);
        return salvo;
      })
    };
    const gerenciador = { getRepository: jest.fn(() => repositorio), query: jest.fn(async () => undefined) };

    expect((await instalarTemplatesIniciaisNoTenant(gerenciador as never, 'tenant-1')).criados).toHaveLength(6);
    expect((await instalarTemplatesIniciaisNoTenant(gerenciador as never, 'tenant-1')).criados).toHaveLength(0);
    expect((await instalarTemplatesIniciaisNoTenant(gerenciador as never, 'tenant-2')).criados).toHaveLength(7);
    expect(gravados.find((template) => template.codigoExterno === 'octaclin_plano_publicado')?.canal).toBe('whatsapp');
    expect(gravados.find((template) => template.codigoExterno === 'octaclin_material_nao_visualizado')?.aprovado).toBe(false);
    expect(gravados.find((template) => template.id === 'modelo-customizado')?.nome).toBe('Texto da clínica');
    expect(repositorio.find).toHaveBeenCalledWith({ where: { tenantId: 'tenant-2' } });
    expect(gerenciador.query).toHaveBeenCalledTimes(3);
  });
});
