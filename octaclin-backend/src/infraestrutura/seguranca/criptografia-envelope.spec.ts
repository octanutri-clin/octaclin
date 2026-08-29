import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { CriptografiaDadosSensiveis } from './criptografia-dados-sensiveis';

const ambienteOriginal = process.env;

const CHAVE_A = 'chave-sintetica-pr39-material-suficiente-a';
const CHAVE_B = 'chave-sintetica-pr39-material-suficiente-b';

const VERSAO_V1 = 1;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;

function chaveLegado(material: string): Buffer {
  return createHash('sha256').update(material).digest();
}

/** Reproduz o formato legado `[IV][TAG][CIPHERTEXT]` gravado antes do PR 39. */
function cifrarNoFormatoLegado(material: string, texto: string): Buffer {
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv('aes-256-gcm', chaveLegado(material), iv, { authTagLength: TAMANHO_TAG });
  const conteudo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), conteudo]);
}

interface EnvelopeLido {
  versao: number;
  keyId: string;
  cabecalho: Buffer;
  iv: Buffer;
  tag: Buffer;
  conteudo: Buffer;
}

function lerEnvelope(valor: Buffer): EnvelopeLido {
  const tamanhoKeyId = valor[1];
  const inicioIv = 2 + tamanhoKeyId;
  return {
    versao: valor[0],
    keyId: valor.subarray(2, inicioIv).toString('utf8'),
    cabecalho: valor.subarray(0, inicioIv),
    iv: valor.subarray(inicioIv, inicioIv + TAMANHO_IV),
    tag: valor.subarray(inicioIv + TAMANHO_IV, inicioIv + TAMANHO_IV + TAMANHO_TAG),
    conteudo: valor.subarray(inicioIv + TAMANHO_IV + TAMANHO_TAG)
  };
}

function inverterUltimoBit(origem: Buffer, indice: number): Buffer {
  const copia = Buffer.from(origem);
  copia[indice] = copia[indice] ^ 0x01;
  return copia;
}

describe('CriptografiaDadosSensiveis - envelope versionado', () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.APP_AMBIENTE;
    delete process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR;
    delete process.env.CRIPTOGRAFIA_CHAVE_INDICE_HMAC;
    process.env.CRIPTOGRAFIA_CHAVE_AES_256 = CHAVE_A;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  describe('formato novo', () => {
    it('escreve envelope versionado com key-id e recupera o texto', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const cifrado = criptografia.criptografar('conteudo sintetico de teste');

      const envelope = lerEnvelope(cifrado);
      expect(envelope.versao).toBe(VERSAO_V1);
      expect(envelope.keyId).toMatch(/^[0-9a-f]{8}$/);
      expect(envelope.iv).toHaveLength(TAMANHO_IV);
      expect(envelope.tag).toHaveLength(TAMANHO_TAG);
      expect(criptografia.descriptografar(cifrado)).toBe('conteudo sintetico de teste');
    });

    it('nunca reutiliza o mesmo IV entre duas escritas do mesmo texto', () => {
      const criptografia = new CriptografiaDadosSensiveis();

      const primeiro = lerEnvelope(criptografia.criptografar('mesmo texto'));
      const segundo = lerEnvelope(criptografia.criptografar('mesmo texto'));

      expect(primeiro.iv.equals(segundo.iv)).toBe(false);
    });

    it('nao escreve mais no formato legado', () => {
      const criptografia = new CriptografiaDadosSensiveis();

      expect(criptografia.criptografar('x')[0]).toBe(VERSAO_V1);
    });

    it('preserva string vazia e caracteres multibyte', () => {
      const criptografia = new CriptografiaDadosSensiveis();

      expect(criptografia.descriptografar(criptografia.criptografar(''))).toBe('');
      expect(criptografia.descriptografar(criptografia.criptografar('Ana Júlia — ação'))).toBe('Ana Júlia — ação');
    });
  });

  describe('compatibilidade com o formato legado', () => {
    it('le ciphertext legado gravado antes do envelope versionado', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const legado = cifrarNoFormatoLegado(CHAVE_A, 'registro clinico sintetico');

      expect(criptografia.descriptografar(legado)).toBe('registro clinico sintetico');
    });

    it('rejeita ciphertext legado adulterado no conteudo', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const legado = cifrarNoFormatoLegado(CHAVE_A, 'registro clinico sintetico');

      expect(() => criptografia.descriptografar(inverterUltimoBit(legado, legado.length - 1))).toThrow();
    });

    it('rejeita ciphertext legado adulterado na tag', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const legado = cifrarNoFormatoLegado(CHAVE_A, 'registro clinico sintetico');

      expect(() => criptografia.descriptografar(inverterUltimoBit(legado, TAMANHO_IV))).toThrow();
    });
  });

  describe('autenticacao antes de interpretar o payload', () => {
    it.each([
      ['versao', 0],
      ['key-id', 3],
      ['iv', 11],
      ['tag', 23],
      ['conteudo', -1]
    ])('rejeita adulteracao em %s', (_campo, indice) => {
      const criptografia = new CriptografiaDadosSensiveis();
      const cifrado = criptografia.criptografar('conteudo sintetico');
      const alvo = indice < 0 ? cifrado.length - 1 : indice;

      expect(() => criptografia.descriptografar(inverterUltimoBit(cifrado, alvo))).toThrow();
    });

    it.each([0, 1, 10, 27, 37])('rejeita payload curto/truncado com %s bytes', (tamanho) => {
      const criptografia = new CriptografiaDadosSensiveis();

      expect(() => criptografia.descriptografar(Buffer.alloc(tamanho))).toThrow();
    });

    // O Node aceita tag GCM de 4, 8 e de 12 a 16 bytes quando `authTagLength`
    // nao e informado, e uma tag de 4 bytes e forjavel com ~2^32 tentativas.
    // Estes tamanhos deixariam exatamente uma tag curta no layout legado.
    it.each([
      [16, 4],
      [20, 8],
      [24, 12],
      [26, 14]
    ])('rejeita buffer de %s bytes, que deixaria tag GCM de %s bytes', (tamanho) => {
      const criptografia = new CriptografiaDadosSensiveis();

      expect(() => criptografia.descriptografar(Buffer.alloc(tamanho))).toThrow();
    });

    it('rejeita envelope truncado depois do cabecalho valido', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const cifrado = criptografia.criptografar('conteudo sintetico longo o bastante');

      expect(() => criptografia.descriptografar(cifrado.subarray(0, cifrado.length - 4))).toThrow();
    });

    it('nao expoe conteudo nem material criptografico na mensagem de erro', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const cifrado = criptografia.criptografar('paciente-sintetico-identificavel');
      const adulterado = inverterUltimoBit(cifrado, cifrado.length - 1);

      let mensagem = '';
      try {
        criptografia.descriptografar(adulterado);
      } catch (erro) {
        mensagem = (erro as Error).message;
      }

      expect(mensagem).not.toContain('paciente-sintetico-identificavel');
      expect(mensagem).not.toContain(CHAVE_A);
      expect(mensagem).not.toContain(adulterado.toString('base64'));
      expect(mensagem).not.toContain(adulterado.toString('hex'));
    });
  });

  describe('separacao de finalidade das chaves', () => {
    it('nao cifra com a chave crua sha256 usada pelo formato legado', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const envelope = lerEnvelope(criptografia.criptografar('conteudo sintetico'));

      const decifra = createDecipheriv('aes-256-gcm', chaveLegado(CHAVE_A), envelope.iv, {
        authTagLength: TAMANHO_TAG
      });
      decifra.setAAD(envelope.cabecalho);
      decifra.setAuthTag(envelope.tag);

      expect(() => Buffer.concat([decifra.update(envelope.conteudo), decifra.final()])).toThrow();
    });

    it('cifra com chave derivada por finalidade a partir da chave-base', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const envelope = lerEnvelope(criptografia.criptografar('conteudo sintetico'));

      const chaveCifra = createHmac('sha256', chaveLegado(CHAVE_A))
        .update('octaclin-cifra-aes-256-gcm-v1')
        .digest();
      const decifra = createDecipheriv('aes-256-gcm', chaveCifra, envelope.iv, {
        authTagLength: TAMANHO_TAG
      });
      decifra.setAAD(envelope.cabecalho);
      decifra.setAuthTag(envelope.tag);

      expect(Buffer.concat([decifra.update(envelope.conteudo), decifra.final()]).toString('utf8')).toBe(
        'conteudo sintetico'
      );
    });

    it('mantem o indice HMAC identico ao formato ja gravado quando nao ha chave dedicada', () => {
      const criptografia = new CriptografiaDadosSensiveis();

      const chaveIndiceLegada = createHmac('sha256', chaveLegado(CHAVE_A))
        .update('octaclin-busca-pii-v1')
        .digest();
      const esperado = createHmac('sha256', chaveIndiceLegada)
        .update('tenant-1\0maria')
        .digest('base64url');

      expect(criptografia.gerarHashesConsultaPii('tenant-1', 'maria')).toEqual([esperado]);
    });

    it('permite chave dedicada de indice sem afetar a cifra', () => {
      const criptografia = new CriptografiaDadosSensiveis();
      const semDedicada = criptografia.gerarHashesConsultaPii('tenant-1', 'maria');
      const cifradoSemDedicada = criptografia.criptografar('conteudo sintetico');

      process.env.CRIPTOGRAFIA_CHAVE_INDICE_HMAC = 'chave-sintetica-dedicada-de-indice-hmac-pr39';
      const comDedicada = criptografia.gerarHashesConsultaPii('tenant-1', 'maria');

      expect(comDedicada).not.toEqual(semDedicada);
      expect(criptografia.descriptografar(cifradoSemDedicada)).toBe('conteudo sintetico');
    });
  });

  describe('rotacao de chave', () => {
    it('le com a chave anterior e escreve somente com a chave atual', () => {
      const anterior = new CriptografiaDadosSensiveis();
      const cifradoComA = anterior.criptografar('conteudo sintetico rotacionado');
      const keyIdA = lerEnvelope(cifradoComA).keyId;
      const legadoComA = cifrarNoFormatoLegado(CHAVE_A, 'legado sintetico rotacionado');

      process.env.CRIPTOGRAFIA_CHAVE_AES_256 = CHAVE_B;
      process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR = CHAVE_A;
      const atual = new CriptografiaDadosSensiveis();

      expect(atual.descriptografar(cifradoComA)).toBe('conteudo sintetico rotacionado');
      expect(atual.descriptografar(legadoComA)).toBe('legado sintetico rotacionado');

      const keyIdB = lerEnvelope(atual.criptografar('novo conteudo')).keyId;
      expect(keyIdB).not.toBe(keyIdA);
    });

    it('falha ao ler ciphertext da chave anterior quando ela nao esta declarada', () => {
      const anterior = new CriptografiaDadosSensiveis();
      const cifradoComA = anterior.criptografar('conteudo sintetico rotacionado');

      process.env.CRIPTOGRAFIA_CHAVE_AES_256 = CHAVE_B;
      const atual = new CriptografiaDadosSensiveis();

      expect(() => atual.descriptografar(cifradoComA)).toThrow();
    });
  });

  describe('configuracao falha fechada', () => {
    it.each(['staging', 'producao'])('recusa operar sem chave em %s', (ambiente) => {
      process.env.APP_AMBIENTE = ambiente;
      delete process.env.CRIPTOGRAFIA_CHAVE_AES_256;
      const criptografia = new CriptografiaDadosSensiveis();

      expect(() => criptografia.criptografar('x')).toThrow('CRIPTOGRAFIA_CHAVE_AES_256');
    });

    it('recusa chave com material insuficiente em producao', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.CRIPTOGRAFIA_CHAVE_AES_256 = 'curta-demais';
      const criptografia = new CriptografiaDadosSensiveis();

      expect(() => criptografia.criptografar('x')).toThrow('CRIPTOGRAFIA_CHAVE_AES_256');
    });

    it('recusa chave anterior invalida em producao em vez de ignora-la', () => {
      process.env.APP_AMBIENTE = 'producao';
      process.env.CRIPTOGRAFIA_CHAVE_AES_256 = CHAVE_A;
      process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR = 'curta';
      const criptografia = new CriptografiaDadosSensiveis();

      expect(() => criptografia.criptografar('x')).toThrow('CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR');
    });

    it('usa default sintetico inequivoco apenas fora de staging/producao', () => {
      process.env.APP_AMBIENTE = 'local';
      delete process.env.CRIPTOGRAFIA_CHAVE_AES_256;
      const criptografia = new CriptografiaDadosSensiveis();

      const cifrado = criptografia.criptografar('conteudo local');

      expect(criptografia.descriptografar(cifrado)).toBe('conteudo local');
    });
  });
});
