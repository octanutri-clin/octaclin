import { dataIsoNoTimezoneClinico, obterTimezoneClinico, obterTimezoneClinicoDoTenant } from './timezone-clinico';
import type { EntityManager } from 'typeorm';

describe('timezone-clinico', () => {
  const original = process.env.GOOGLE_CALENDAR_TIMEZONE;

  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_CALENDAR_TIMEZONE;
    else process.env.GOOGLE_CALENDAR_TIMEZONE = original;
  });

  describe('obterTimezoneClinico', () => {
    it('usa America/Sao_Paulo como padrao quando a variavel nao esta configurada', () => {
      delete process.env.GOOGLE_CALENDAR_TIMEZONE;
      expect(obterTimezoneClinico()).toBe('America/Sao_Paulo');
    });

    it('usa a variavel configurada quando e um timezone valido', () => {
      process.env.GOOGLE_CALENDAR_TIMEZONE = 'America/New_York';
      expect(obterTimezoneClinico()).toBe('America/New_York');
    });

    // Fail-closed para o padrao conhecido: um valor invalido nao pode
    // quebrar o calculo de "hoje" em produção.
    it('cai para o padrao quando a variavel configurada e invalida', () => {
      process.env.GOOGLE_CALENDAR_TIMEZONE = 'Nao/Existe';
      expect(obterTimezoneClinico()).toBe('America/Sao_Paulo');
    });
  });

  describe('dataIsoNoTimezoneClinico', () => {
    it('formata a data corrente como YYYY-MM-DD no timezone informado', () => {
      const resultado = dataIsoNoTimezoneClinico('America/Sao_Paulo');
      expect(resultado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
  it('le somente a configuracao do tenant verificado e prioriza seu fuso',async()=>{
    process.env.GOOGLE_CALENDAR_TIMEZONE='America/Sao_Paulo';
    const query=jest.fn(async()=>[{timezone:'America/Rio_Branco'}]);
    expect(await obterTimezoneClinicoDoTenant({query} as unknown as EntityManager,'tenant-sintetico')).toBe('America/Rio_Branco');
    expect(query).toHaveBeenCalledWith(expect.stringContaining("chave='conta_cliente'"),['tenant-sintetico']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('tenant_id=$1'),['tenant-sintetico']);
  });
  it('mantem o resolvedor canonico quando nao ha configuracao da clinica',async()=>{
    process.env.GOOGLE_CALENDAR_TIMEZONE='America/New_York';
    const query=jest.fn(async()=>[]);
    expect(await obterTimezoneClinicoDoTenant({query} as unknown as EntityManager,'tenant-sintetico')).toBe('America/New_York');
  });
});
