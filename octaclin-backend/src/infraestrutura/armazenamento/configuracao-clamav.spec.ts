import { clamavConfigurado, obterConfiguracaoClamav } from './configuracao-clamav';

describe('configuracao-clamav', () => {
  const chaves = ['CLAMAV_HOST', 'CLAMAV_PORTA', 'CLAMAV_TIMEOUT_MS'] as const;
  const originais: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const chave of chaves) originais[chave] = process.env[chave];
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
  });

  describe('clamavConfigurado', () => {
    it('retorna falso quando CLAMAV_HOST nao esta definido', () => {
      delete process.env.CLAMAV_HOST;
      expect(clamavConfigurado()).toBe(false);
    });

    it('retorna falso quando CLAMAV_HOST e apenas espacos', () => {
      process.env.CLAMAV_HOST = '   ';
      expect(clamavConfigurado()).toBe(false);
    });

    it('retorna verdadeiro quando CLAMAV_HOST esta definido', () => {
      process.env.CLAMAV_HOST = 'clamav.interno';
      expect(clamavConfigurado()).toBe(true);
    });
  });

  describe('obterConfiguracaoClamav', () => {
    it('usa host informado e porta/timeout padrao quando nao especificados', () => {
      process.env.CLAMAV_HOST = 'clamav.interno';
      delete process.env.CLAMAV_PORTA;
      delete process.env.CLAMAV_TIMEOUT_MS;

      expect(obterConfiguracaoClamav()).toEqual({ host: 'clamav.interno', porta: 3310, timeoutMs: 5000 });
    });

    it('usa localhost quando CLAMAV_HOST nao esta definido', () => {
      delete process.env.CLAMAV_HOST;
      expect(obterConfiguracaoClamav().host).toBe('localhost');
    });

    it('respeita porta e timeout customizados validos', () => {
      process.env.CLAMAV_HOST = 'clamav.interno';
      process.env.CLAMAV_PORTA = '9310';
      process.env.CLAMAV_TIMEOUT_MS = '2000';

      expect(obterConfiguracaoClamav()).toEqual({ host: 'clamav.interno', porta: 9310, timeoutMs: 2000 });
    });

    it('ignora porta invalida e usa o padrao', () => {
      process.env.CLAMAV_HOST = 'clamav.interno';
      process.env.CLAMAV_PORTA = 'nao-e-numero';

      expect(obterConfiguracaoClamav().porta).toBe(3310);
    });

    it('ignora porta negativa ou zero e usa o padrao', () => {
      process.env.CLAMAV_HOST = 'clamav.interno';
      process.env.CLAMAV_PORTA = '-1';
      expect(obterConfiguracaoClamav().porta).toBe(3310);

      process.env.CLAMAV_PORTA = '0';
      expect(obterConfiguracaoClamav().porta).toBe(3310);
    });

    it('ignora timeout invalido e usa o padrao', () => {
      process.env.CLAMAV_HOST = 'clamav.interno';
      process.env.CLAMAV_TIMEOUT_MS = 'abc';

      expect(obterConfiguracaoClamav().timeoutMs).toBe(5000);
    });
  });
});
