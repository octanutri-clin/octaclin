import 'reflect-metadata';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { HEADERS_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { ControladorAlimentosPersonalizados } from './controlador-alimentos-personalizados';
describe('FOOD02 fronteira HTTP', () => {
  it('restringe ao profissional com guardas existentes', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorAlimentosPersonalizados)).toEqual(['Professional']);
    expect(Reflect.getMetadata(GUARDS_METADATA, ControladorAlimentosPersonalizados)).toHaveLength(3);
  });
  it.each(['listar', 'buscar', 'obter', 'criar', 'atualizar'])('exige permissão e no-store em %s', n => {
    const m = (ControladorAlimentosPersonalizados.prototype as any)[n];
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, m)).toEqual([['criar', 'atualizar'].includes(n) ? 'planos_alimentares.gerenciar' : 'planos_alimentares.ler']);
    expect(Reflect.getMetadata(HEADERS_METADATA, m)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
  });
  it('tenant da sessão prevalece sobre qualquer DTO', async () => {
    const s = { criar: jest.fn(async () => ({ id: 'novo' })) };
    const c = new ControladorAlimentosPersonalizados(s as any), u = { tenantId: 'sessao' } as any;
    await c.criar(u, { tenantId: 'forjado' } as any);
    expect(s.criar).toHaveBeenCalledWith('sessao', u, { tenantId: 'forjado' });
  });
});
