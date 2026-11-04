import 'reflect-metadata';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { ControladorReceitasNutricionais } from './controlador-planos-alimentares';

describe('FOOD07 — rotas privadas de consulta e prévia', () => {
  it.each([['consultar', 'consulta'], ['preverPorcionamento', ':receitaId/previa-porcionamento']])('expõe %s como POST read-only privado', (metodo, path) => {
    const handler = (ControladorReceitasNutricionais.prototype as unknown as Record<string, unknown>)[metodo];
    expect(handler).toEqual(expect.any(Function));
    expect(Reflect.getMetadata(PATH_METADATA, handler as object)).toBe(path);
    expect(Reflect.getMetadata(METHOD_METADATA, handler as object)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, handler as object)).toEqual(['planos_alimentares.ler']);
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorReceitasNutricionais)).toEqual(['SuperAdmin', 'Professional']);
    expect(Reflect.getMetadata(GUARDS_METADATA, ControladorReceitasNutricionais)).toEqual([GuardaJwt, GuardaPapeis, GuardaPermissoes]);
    expect(Reflect.getMetadata(HEADERS_METADATA, handler as object)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
  });
});
