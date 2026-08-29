import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { criarConfiguracaoSslPostgres } from './ssl-postgres';

const ambienteOriginal = process.env;

const PEM_SINTETICO = [
  '-----BEGIN CERTIFICATE-----',
  'TEXTO_SINTETICO_SEM_VALOR_CRIPTOGRAFICO',
  '-----END CERTIFICATE-----'
].join('\n');

function limparAmbienteBanco() {
  delete process.env.APP_AMBIENTE;
  delete process.env.BANCO_SSL;
  delete process.env.BANCO_SSL_CA;
  delete process.env.BANCO_SSL_CA_ARQUIVO;
  delete process.env.BANCO_SSL_SERVERNAME;
  delete process.env.BANCO_SSL_PERMITIR_INSEGURO;
}

describe('criarConfiguracaoSslPostgres', () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    limparAmbienteBanco();
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('nunca desabilita a verificacao da cadeia quando TLS esta ligado', () => {
    process.env.BANCO_SSL = 'true';

    expect(criarConfiguracaoSslPostgres()).toEqual({ rejectUnauthorized: true });
  });

  it('mantem verificacao estrita com sslmode=require na DATABASE_URL', () => {
    expect(criarConfiguracaoSslPostgres('require')).toEqual({ rejectUnauthorized: true });
  });

  it('nao habilita TLS quando nada exige TLS', () => {
    expect(criarConfiguracaoSslPostgres()).toBe(false);
    expect(criarConfiguracaoSslPostgres('disable')).toBe(false);
  });

  it('aceita CA explicita em PEM e nome de servidor para validacao de hostname', () => {
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA = PEM_SINTETICO;
    process.env.BANCO_SSL_SERVERNAME = 'banco.interno.exemplo';

    expect(criarConfiguracaoSslPostgres()).toEqual({
      rejectUnauthorized: true,
      ca: PEM_SINTETICO,
      servername: 'banco.interno.exemplo',
      checkServerIdentity: expect.any(Function)
    });
  });

  it('nao instala checkServerIdentity proprio quando nenhum nome e declarado', () => {
    process.env.BANCO_SSL = 'true';

    expect(criarConfiguracaoSslPostgres()).not.toHaveProperty('checkServerIdentity');
  });

  it('aceita CA explicita a partir de arquivo', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'octaclin-ca-'));
    const caminho = join(pasta, 'ca.pem');
    writeFileSync(caminho, PEM_SINTETICO, 'utf8');

    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA_ARQUIVO = caminho;

    expect(criarConfiguracaoSslPostgres()).toEqual({
      rejectUnauthorized: true,
      ca: PEM_SINTETICO
    });
  });

  it('rejeita CA que nao e um PEM de certificado', () => {
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA = 'conteudo-que-nao-e-pem';

    expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL_CA');
  });

  it('rejeita arquivo de CA inexistente em vez de seguir sem CA', () => {
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA_ARQUIVO = join(tmpdir(), 'octaclin-ca-inexistente.pem');

    expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL_CA_ARQUIVO');
  });

  it('rejeita CA declarada em duas fontes conflitantes', () => {
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA = PEM_SINTETICO;
    process.env.BANCO_SSL_CA_ARQUIVO = '/tmp/qualquer.pem';

    expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL_CA');
  });

  it.each(['TRUE', '1', 'sim', 'yes'])('rejeita BANCO_SSL invalido: %s', (valor) => {
    process.env.BANCO_SSL = valor;

    expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL');
  });

  it('rejeita sslmode desconhecido em vez de tratar como sem TLS', () => {
    expect(() => criarConfiguracaoSslPostgres('requiree')).toThrow('sslmode');
  });

  describe('staging e producao', () => {
    it.each(['staging', 'producao'])('exige TLS em %s', (ambiente) => {
      process.env.APP_AMBIENTE = ambiente;

      expect(() => criarConfiguracaoSslPostgres()).toThrow('TLS');
    });

    it.each(['allow', 'prefer', 'disable'])(
      'recusa sslmode oportunista/permissivo (%s) em producao',
      (modo) => {
        process.env.APP_AMBIENTE = 'producao';

        expect(() => criarConfiguracaoSslPostgres(modo)).toThrow('sslmode');
      }
    );

    it('torna impossivel desligar a verificacao do certificado em producao', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.BANCO_SSL = 'true';
      process.env.BANCO_SSL_PERMITIR_INSEGURO = 'true';

      expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL_PERMITIR_INSEGURO');
    });

    it('torna impossivel desligar a verificacao do certificado em staging', () => {
      process.env.APP_AMBIENTE = 'staging';
      process.env.BANCO_SSL = 'true';
      process.env.BANCO_SSL_PERMITIR_INSEGURO = 'true';

      expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL_PERMITIR_INSEGURO');
    });

    it('aceita TLS estrito com sslmode=verify-full', () => {
      process.env.APP_AMBIENTE = 'producao';

      expect(criarConfiguracaoSslPostgres('verify-full')).toEqual({ rejectUnauthorized: true });
    });
  });

  describe('escape hatch local', () => {
    it('so afrouxa a verificacao com opt-in literal fora de staging/producao', () => {
      process.env.APP_AMBIENTE = 'local';
      process.env.BANCO_SSL = 'true';
      process.env.BANCO_SSL_PERMITIR_INSEGURO = 'true';

      expect(criarConfiguracaoSslPostgres()).toEqual({ rejectUnauthorized: false });
    });

    it.each(['TRUE', '1', 'sim'])('rejeita BANCO_SSL_PERMITIR_INSEGURO invalido: %s', (valor) => {
      process.env.APP_AMBIENTE = 'local';
      process.env.BANCO_SSL = 'true';
      process.env.BANCO_SSL_PERMITIR_INSEGURO = valor;

      expect(() => criarConfiguracaoSslPostgres()).toThrow('BANCO_SSL_PERMITIR_INSEGURO');
    });
  });
});
