import {
  ALGORITMO_JWT,
  duracaoEmSegundos,
  obterAudienciaJwt,
  obterEmissorJwt,
  obterExpiracaoJwt,
  obterSegredoAcesso,
  obterSegredoRenovacao,
  opcoesAssinatura,
  opcoesVerificacao,
  validarSegredosJwt
} from './configuracao-jwt';

const CHAVES = ['APP_AMBIENTE', 'NODE_ENV', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA', 'JWT_EXPIRA_EM', 'JWT_REFRESH_EXPIRA_EM'] as const;

const SEGREDO_A = 'a'.repeat(48);
const SEGREDO_B = 'b'.repeat(48);

describe('configuracao-jwt', () => {
  let snapshot: Map<string, string | undefined>;

  beforeEach(() => {
    snapshot = new Map(CHAVES.map((nome) => [nome, process.env[nome]]));
    for (const nome of CHAVES) delete process.env[nome];
  });

  afterEach(() => {
    for (const [nome, valor] of snapshot) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });

  describe('segredos', () => {
    it('usa segredo efemero distinto por finalidade em ambiente local', () => {
      process.env.APP_AMBIENTE = 'local';

      const acesso = obterSegredoAcesso();
      const renovacao = obterSegredoRenovacao();

      expect(acesso).toHaveLength(64);
      expect(renovacao).toHaveLength(64);
      expect(acesso).not.toBe(renovacao);
      expect(obterSegredoAcesso()).toBe(acesso);
    });

    it('nao aceita ausencia de segredo em staging', () => {
      process.env.APP_AMBIENTE = 'staging';

      expect(() => obterSegredoAcesso()).toThrow('JWT_SEGREDO');
      expect(() => obterSegredoRenovacao()).toThrow('JWT_REFRESH_SEGREDO');
    });

    it('nao aceita ausencia de segredo em producao', () => {
      process.env.APP_AMBIENTE = 'producao';

      expect(() => obterSegredoAcesso()).toThrow('JWT_SEGREDO');
    });

    it('recusa segredo curto em producao', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.JWT_SEGREDO = 'curto-demais';
      process.env.JWT_REFRESH_SEGREDO = SEGREDO_B;

      expect(() => obterSegredoAcesso()).toThrow('32 bytes');
    });

    it('recusa access e refresh compartilhando o mesmo segredo em producao', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.JWT_SEGREDO = SEGREDO_A;
      process.env.JWT_REFRESH_SEGREDO = SEGREDO_A;

      expect(() => validarSegredosJwt()).toThrow('diferente');
    });

    it('nao herda JWT_SEGREDO como segredo de renovacao', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.JWT_SEGREDO = SEGREDO_A;

      expect(() => obterSegredoRenovacao()).toThrow('JWT_REFRESH_SEGREDO');
    });

    it('aceita par valido em producao', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.JWT_SEGREDO = SEGREDO_A;
      process.env.JWT_REFRESH_SEGREDO = SEGREDO_B;

      expect(validarSegredosJwt()).toBeUndefined();
      expect(obterSegredoAcesso()).toBe(SEGREDO_A);
      expect(obterSegredoRenovacao()).toBe(SEGREDO_B);
    });

    it('nao expoe material do segredo na mensagem de erro', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.JWT_SEGREDO = 'segredo-curto-mas-identificavel';
      process.env.JWT_REFRESH_SEGREDO = SEGREDO_B;

      expect(() => obterSegredoAcesso()).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining('identificavel') })
      );
    });
  });

  describe('emissor e audiencia', () => {
    it('usa valores padrao quando o ambiente nao declara', () => {
      expect(obterEmissorJwt()).toBe('octaclin');
      expect(obterAudienciaJwt()).toBe('octaclin-api');
    });

    it('respeita valores declarados', () => {
      process.env.JWT_EMISSOR = 'octaclin-staging';
      process.env.JWT_AUDIENCIA = 'octaclin-api-staging';

      expect(obterEmissorJwt()).toBe('octaclin-staging');
      expect(obterAudienciaJwt()).toBe('octaclin-api-staging');
    });
  });

  describe('opcoes', () => {
    it('assina fixando algoritmo, emissor e audiencia', () => {
      process.env.APP_AMBIENTE = 'local';
      const opcoes = opcoesAssinatura('acesso', 'jti-1');

      expect(opcoes.algorithm).toBe(ALGORITMO_JWT);
      expect(opcoes.issuer).toBe('octaclin');
      expect(opcoes.audience).toBe('octaclin-api');
      expect(opcoes.jwtid).toBe('jti-1');
      expect(opcoes.expiresIn).toBe('15m');
      expect(opcoes.secret).toBe(obterSegredoAcesso());
    });

    it('assina renovacao com o segredo e a expiracao de renovacao', () => {
      process.env.APP_AMBIENTE = 'local';
      const opcoes = opcoesAssinatura('renovacao', 'jti-2');

      expect(opcoes.expiresIn).toBe('30d');
      expect(opcoes.secret).toBe(obterSegredoRenovacao());
    });

    it('verifica restringindo a lista de algoritmos aceitos', () => {
      process.env.APP_AMBIENTE = 'local';
      const opcoes = opcoesVerificacao('acesso');

      expect(opcoes.algorithms).toEqual([ALGORITMO_JWT]);
      expect(opcoes.issuer).toBe('octaclin');
      expect(opcoes.audience).toBe('octaclin-api');
      expect(opcoes.ignoreExpiration).toBe(false);
    });
  });

  describe('duracoes', () => {
    it('rejeita duracao sem unidade reconhecida', () => {
      expect(() => obterExpiracaoJwt('duracao-invalida', '15m')).toThrow('duracao de expiracao JWT');
    });

    it('aceita duracao declarada e cai no padrao quando ausente', () => {
      expect(obterExpiracaoJwt('45m', '15m')).toBe('45m');
      expect(obterExpiracaoJwt(undefined, '15m')).toBe('15m');
      expect(obterExpiracaoJwt('  ', '15m')).toBe('15m');
    });

    it('converte a duracao em segundos reais', () => {
      expect(duracaoEmSegundos('15m')).toBe(900);
      expect(duracaoEmSegundos('30d')).toBe(2592000);
      expect(duracaoEmSegundos('2h')).toBe(7200);
      expect(duracaoEmSegundos('90s')).toBe(90);
      expect(duracaoEmSegundos(120)).toBe(120);
    });

    it('nao devolve duracao fixa quando o ambiente altera a expiracao do access token', () => {
      process.env.JWT_EXPIRA_EM = '5m';
      expect(duracaoEmSegundos(obterExpiracaoJwt(process.env.JWT_EXPIRA_EM, '15m'))).toBe(300);
    });
  });
});
