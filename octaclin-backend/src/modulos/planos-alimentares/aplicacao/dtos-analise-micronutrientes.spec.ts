import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { AnaliseMicronutrientesDto, validarAnaliseMicronutrientes } from './dtos-analise-micronutrientes';

// Confirmacoes sinteticas: so as 7 escolhas explicitas do profissional, sem data ou idade.
const confirmacoes = () => ({
  populacaoReferencia: 'feminina', populacaoConfirmada: true, gestacao: 'nao', lactacao: 'nao',
  aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao'
});
const pipe = (v: unknown) => validateSync(plainToInstance(AnaliseMicronutrientesDto, v), { whitelist: true, forbidNonWhitelisted: true });

describe('FOOD06 T3a: opt-in de referencias na analise ao vivo (DTO)', () => {
  it('sem a flag, o contrato e exatamente o de antes (so selecoes)', () => {
    expect(validarAnaliseMicronutrientes({ selecoes: [] })).toEqual({ selecoes: [] });
    expect(pipe({ selecoes: [] })).toHaveLength(0);
  });

  it('com a flag e as 7 confirmacoes, devolve as confirmacoes validadas', () => {
    const r = validarAnaliseMicronutrientes({ selecoes: [], incluirReferencias: true, confirmacoes: confirmacoes() });
    expect(r).toEqual({ selecoes: [], confirmacoes: confirmacoes() });
    expect(pipe({ selecoes: [], incluirReferencias: true, confirmacoes: confirmacoes() })).toHaveLength(0);
  });

  it('incluirReferencias=false equivale a ausente (sem confirmacoes)', () => {
    expect(validarAnaliseMicronutrientes({ selecoes: [], incluirReferencias: false })).toEqual({ selecoes: [] });
  });

  it.each([
    ['flag sem confirmacoes', { selecoes: [], incluirReferencias: true }],
    ['confirmacoes sem flag', { selecoes: [], confirmacoes: confirmacoes() }],
    ['confirmacoes com flag false', { selecoes: [], incluirReferencias: false, confirmacoes: confirmacoes() }],
    ['flag como texto', { selecoes: [], incluirReferencias: 'true', confirmacoes: confirmacoes() }],
    ['nascimento do navegador', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), nascimento: '1990-01-01' } }],
    ['data da analise do navegador', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), dataAnalise: '2026-11-10' } }],
    ['idade do navegador', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), idadeAnos: 40 } }],
    ['elegibilidade do navegador', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), elegivel: true } }],
    ['confirmacao faltando', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), tabagismo: undefined } }],
    ['valor fora do dominio', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), populacaoReferencia: 'outra' } }],
    ['contexto resolvido pronto', { selecoes: [], incluirReferencias: true, contexto: { elegivel: true } }],
    ['tenant no corpo', { selecoes: [], tenantId: 'x' }],
    ['referencias prontas', { selecoes: [], incluirReferencias: true, confirmacoes: confirmacoes(), referencias: [] }],
    ['selecao invalida', { selecoes: [null], incluirReferencias: true, confirmacoes: confirmacoes() }]
  ])('rejeita %s', (_nome, valor) => {
    expect(() => validarAnaliseMicronutrientes(valor)).toThrow();
  });

  it('o pipe HTTP tambem recusa chaves fora do contrato e confirmacoes invalidas', () => {
    for (const v of [
      { selecoes: [], tenantId: 'x' },
      { selecoes: [], incluirReferencias: 'sim' },
      { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), nascimento: '1990-01-01' } },
      { selecoes: [], incluirReferencias: true, confirmacoes: 'tudo-confirmado' }
    ]) expect(pipe(v).length).toBeGreaterThan(0);
  });

  it('recusa prototipo adulterado nas confirmacoes', () => {
    const adulterado = Object.assign(Object.create({ elegivel: true }), confirmacoes());
    expect(() => validarAnaliseMicronutrientes({ selecoes: [], incluirReferencias: true, confirmacoes: adulterado })).toThrow();
    expect(() => validarAnaliseMicronutrientes(JSON.parse('{"selecoes":[],"__proto__":{"incluirReferencias":true}}'))).toThrow();
  });
});

describe('FOOD06 T3a: opt-in pelo pipe HTTP real (transform + whitelist)', () => {
  // Mesmo pipe global da aplicacao; assim o teste cobre a conversao implicita do transform.
  const pipe = criarPipeValidacaoHttp();
  const validar = (corpo: unknown) => Promise.resolve().then(() => pipe.transform(corpo, { type: 'body', metatype: AnaliseMicronutrientesDto }));

  it('aceita o corpo legado e o opt-in completo', async () => {
    await expect(validar({ selecoes: [] })).resolves.toBeDefined();
    await expect(validar({ selecoes: [], incluirReferencias: true, confirmacoes: confirmacoes() })).resolves.toBeDefined();
  });

  it.each([
    ['confirmacoes sem flag', { selecoes: [], confirmacoes: confirmacoes() }],
    ['flag como texto', { selecoes: [], incluirReferencias: 'true', confirmacoes: confirmacoes() }],
    ['flag sem confirmacoes', { selecoes: [], incluirReferencias: true }],
    ['nascimento nas confirmacoes', { selecoes: [], incluirReferencias: true, confirmacoes: { ...confirmacoes(), nascimento: '1990-01-01' } }],
    ['tenant no corpo', { selecoes: [], tenantId: 'x' }]
  ])('recusa %s', async (_nome, corpo) => {
    await expect(validar(corpo)).rejects.toBeInstanceOf(BadRequestException);
  });
});
