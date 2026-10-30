import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as dtos from './dtos';

const api = dtos as unknown as {
  CriarMetadadosReceitaDto: new () => object;
  AtualizarMetadadosReceitaDto: new () => object;
  PreverPorcionamentoReceitaDto: new () => object;
};
const opcoes = { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true };
async function erros(tipo: new () => object, entrada: unknown) {
  return validate(plainToInstance(tipo, entrada as object), opcoes);
}
describe('FOOD07 — DTOs aditivos (wiring HTTP somente em T02/T03)', () => {
  beforeEach(() => {
    expect(api.CriarMetadadosReceitaDto).toEqual(expect.any(Function));
    expect(api.AtualizarMetadadosReceitaDto).toEqual(expect.any(Function));
    expect(api.PreverPorcionamentoReceitaDto).toEqual(expect.any(Function));
  });
  it('conserva o cliente legado por omissão e valida criação/alteração parcial distintas', async () => {
    expect(await erros(api.CriarMetadadosReceitaDto, {})).toEqual([]);
    expect(await erros(api.CriarMetadadosReceitaDto, { metadados: { baseQuantidades: 'por_porcao', etiquetas: ['Lanche'] } })).toEqual([]);
    expect(await erros(api.AtualizarMetadadosReceitaDto, { metadados: { rendimentoPorcoes: null, etiquetas: [] } })).toEqual([]);
    expect((await erros(api.CriarMetadadosReceitaDto, { metadados: { rendimentoPorcoes: null } })).length).toBeGreaterThan(0);
  });
  it.each([null, [], 1, 'x', { desconhecido: 1 }, { etiquetas: null }, { baseQuantidades: 'inferir' }, { schemaVersao: 2 }])('rejeita metadata inválida na criação e atualização: %#', async valor => {
    for (const tipo of [api.CriarMetadadosReceitaDto, api.AtualizarMetadadosReceitaDto]) {
      expect((await erros(tipo, { metadados: valor })).length).toBeGreaterThan(0);
    }
  });
  it.each([0.001, 1, 1.5, 2.5, 1000])('aceita prévia sem coerção com %s porções', async porcoesDesejadas => {
    expect(await erros(api.PreverPorcionamentoReceitaDto, { versaoEsperada: 1, porcoesDesejadas })).toEqual([]);
  });
  it.each([undefined, null, '1.5', 0, -1, 1000.001, 1.0001, NaN, Infinity])('rejeita porções inválidas: %#', async porcoesDesejadas => {
    expect((await erros(api.PreverPorcionamentoReceitaDto, { versaoEsperada: 1, porcoesDesejadas })).length).toBeGreaterThan(0);
  });
  it.each([undefined, null, '1', 0, -1, 1.5, 2147483648])('rejeita versão inválida: %#', async versaoEsperada => {
    expect((await erros(api.PreverPorcionamentoReceitaDto, { versaoEsperada, porcoesDesejadas: 1 })).length).toBeGreaterThan(0);
  });
  it('rejeita parâmetros/clientes que tentam fornecer fator, composição ou tenant', async () => {
    for (const extra of [{ tenantId: 'invalido' }, { fator: 1 }, { nutrientesPor100g: {} }, { fingerprint: 'inventado' }]) {
      expect((await erros(api.PreverPorcionamentoReceitaDto, { versaoEsperada: 1, porcoesDesejadas: 1, ...extra })).length).toBeGreaterThan(0);
    }
  });
});
