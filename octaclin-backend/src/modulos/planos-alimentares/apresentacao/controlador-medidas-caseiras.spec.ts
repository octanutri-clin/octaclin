import 'reflect-metadata';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { HEADERS_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import * as contrato from './controlador-medidas-caseiras';
describe('FOOD01 fronteira HTTP', () => {
    const cls = () => (contrato as any).ControladorMedidasCaseiras;
    beforeAll(() => expect(typeof cls()).toBe('function'));
    it('restringe o novo recurso a Professional e mantém os três guardas', () => {
        expect(Reflect.getMetadata(CHAVE_PAPEIS, cls())).toEqual(['Professional']);
        expect(Reflect.getMetadata(GUARDS_METADATA, cls())).toHaveLength(3);
    });
    it.each(['listar', 'criar', 'atualizar'])('permite somente a permissão necessária e no-store em %s', nome => {
        const metodo = cls().prototype[nome];
        expect(Reflect.getMetadata(CHAVE_PERMISSOES, metodo)).toEqual([nome === 'listar' ? 'planos_alimentares.ler' : 'planos_alimentares.gerenciar']);
        expect(Reflect.getMetadata(HEADERS_METADATA, metodo)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    });
    it('resolve tenant pela sessão e encaminha IDs/DTOs ao serviço', async () => {
        const servico = { listar: jest.fn(), criar: jest.fn(), atualizar: jest.fn() };
        const c = new (cls())(servico);
        const u = { tenantId: 'tenant-verificado' };
        await c.listar(u, 'alimento', {});
        await c.criar(u, 'alimento', {});
        await c.atualizar(u, 'alimento', 'medida', {});
        expect(servico.listar).toHaveBeenCalledWith(u.tenantId, 'alimento', u, {});
        expect(servico.criar).toHaveBeenCalledWith(u.tenantId, 'alimento', u, {});
        expect(servico.atualizar).toHaveBeenCalledWith(u.tenantId, 'alimento', 'medida', u, {});
    });
});
describe('FOOD02 fronteira HTTP de medidas custom', () => {
  const cls = () => (contrato as any).ControladorMedidasCaseirasPersonalizadas;
  it('restringe papel e guardas também na rota custom', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, cls())).toEqual(['Professional']);
    expect(Reflect.getMetadata(GUARDS_METADATA, cls())).toHaveLength(3);
  });
  it.each(['listar', 'criar', 'atualizar'])('preserva permissão e no-store em %s', n => {
    const m = cls().prototype[n];
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, m)).toEqual([n === 'listar' ? 'planos_alimentares.ler' : 'planos_alimentares.gerenciar']);
    expect(Reflect.getMetadata(HEADERS_METADATA, m)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
  });
  it('origem custom é fixada pela rota, nunca pelo cliente', async () => {
    const s = { criar: jest.fn() }, u = { tenantId: 'sessao' }, d = { origem: 'catalogo' };
    await new (cls())(s).criar(u, 'id', d);
    expect(s.criar).toHaveBeenCalledWith('sessao', 'id', u, d, 'custom');
  });
});
