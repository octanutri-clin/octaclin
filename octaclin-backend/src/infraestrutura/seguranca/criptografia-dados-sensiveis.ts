import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ambienteExigeFalhaFechada } from './ambiente-execucao';

/**
 * Cifra simetrica dos campos sensiveis (PII e conteudo clinico).
 *
 * ## Formatos
 *
 * - **Legado** (gravado ate o PR 39): `[IV(12)][TAG(16)][CIPHERTEXT]`, sem
 *   versao, sem identificacao de chave e sem dado autenticado adicional. Ainda
 *   e lido, nunca mais e escrito.
 * - **v1** (PR 39): `[0x01][len(keyId)][keyId][IV(12)][TAG(16)][CIPHERTEXT]`.
 *   O cabecalho inteiro entra como AAD, entao adulterar versao ou key-id
 *   invalida a tag antes de qualquer interpretacao do payload.
 *
 * ## Chaves
 *
 * `CRIPTOGRAFIA_CHAVE_AES_256` continua sendo a chave-base. A partir dela sao
 * derivadas chaves com finalidade separada: a chave de cifra (`v1`), a chave do
 * indice cego de busca e o key-id publicado no envelope. A derivacao do indice
 * permanece byte a byte identica a anterior, para nao invalidar os hashes ja
 * gravados; trocar o material do indice exige `CRIPTOGRAFIA_CHAVE_INDICE_HMAC`
 * e backfill explicito.
 *
 * `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR` habilita dual-read durante rotacao: a
 * leitura tenta a chave atual e depois a anterior; a escrita usa somente a
 * atual.
 */
const VERSAO_ENVELOPE_V1 = 0x01;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
const TAMANHO_KEY_ID_HEX = 8;
const TAMANHO_MINIMO_CHAVE_BYTES = 32;

const ROTULO_CIFRA = 'octaclin-cifra-aes-256-gcm-v1';
const ROTULO_INDICE = 'octaclin-busca-pii-v1';
const ROTULO_KEY_ID = 'octaclin-key-id-v1';

/**
 * Default sintetico, sem valor de protecao, aceito somente fora de
 * staging/producao. Em staging e producao a ausencia da chave derruba a
 * operacao em vez de cifrar com material publico.
 */
const CHAVE_SINTETICA_LOCAL = 'octaclin-chave-local-desenvolvimento';

const ERRO_CONTEUDO_INVALIDO = 'Conteudo cifrado invalido ou nao autenticado.';

interface MaterialChave {
  keyId: string;
  chaveCifra: Buffer;
  chaveLegado: Buffer;
  chaveIndiceBase: Buffer;
}

interface EnvelopeVersionado {
  keyId: string;
  cabecalho: Buffer;
  iv: Buffer;
  tag: Buffer;
  conteudo: Buffer;
}

@Injectable()
export class CriptografiaDadosSensiveis {
  criptografar(valor: string): Buffer {
    const [atual] = this.obterChaves();
    const cabecalho = this.montarCabecalho(atual.keyId);
    const iv = randomBytes(TAMANHO_IV);

    const cifra = createCipheriv('aes-256-gcm', atual.chaveCifra, iv);
    cifra.setAAD(cabecalho);
    const conteudo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);

    return Buffer.concat([cabecalho, iv, cifra.getAuthTag(), conteudo]);
  }

  descriptografar(valor: Buffer): string {
    if (!Buffer.isBuffer(valor) || valor.length === 0) {
      throw new Error(ERRO_CONTEUDO_INVALIDO);
    }

    const chaves = this.obterChaves();

    const envelope = this.lerEnvelopeVersionado(valor);
    if (envelope) {
      const declaradas = chaves.filter((chave) => chave.keyId === envelope.keyId);
      for (const chave of declaradas.length ? declaradas : chaves) {
        const texto = this.abrirGcm(
          chave.chaveCifra,
          envelope.iv,
          envelope.tag,
          envelope.conteudo,
          envelope.cabecalho
        );
        if (texto !== null) return texto;
      }
    }

    if (valor.length >= TAMANHO_IV + TAMANHO_TAG) {
      for (const chave of chaves) {
        const texto = this.abrirGcm(
          chave.chaveLegado,
          valor.subarray(0, TAMANHO_IV),
          valor.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG),
          valor.subarray(TAMANHO_IV + TAMANHO_TAG)
        );
        if (texto !== null) return texto;
      }
    }

    throw new Error(ERRO_CONTEUDO_INVALIDO);
  }

  gerarHashBusca(valor: string): string {
    return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
  }

  gerarHashesBuscaPii(tenantId: string, valores: Array<string | undefined>): string[] {
    const chaveIndice = this.obterChaveIndice();
    const hashes = new Set<string>();
    for (const valor of valores) {
      for (const token of this.normalizarTermosBusca(valor)) {
        for (let tamanho = 3; tamanho <= Math.min(token.length, 32); tamanho += 1) {
          hashes.add(this.gerarHashIndicePii(chaveIndice, tenantId, token.slice(0, tamanho)));
        }
      }
    }
    return [...hashes].sort();
  }

  gerarHashesConsultaPii(tenantId: string, busca: string): string[] {
    const chaveIndice = this.obterChaveIndice();
    return [...new Set(
      this.normalizarTermosBusca(busca)
        .filter((token) => token.length >= 3)
        .map((token) => this.gerarHashIndicePii(chaveIndice, tenantId, token.slice(0, 32)))
    )].sort();
  }

  private montarCabecalho(keyId: string): Buffer {
    const identificador = Buffer.from(keyId, 'utf8');
    return Buffer.concat([Buffer.from([VERSAO_ENVELOPE_V1, identificador.length]), identificador]);
  }

  /**
   * Valida a estrutura antes de qualquer tentativa de decifrar. Um ciphertext
   * legado cujo primeiro byte seja 0x01 por acaso e descartado aqui pelo
   * formato do key-id ou pelo tamanho minimo; se ainda assim passar, a tag GCM
   * reprova e a leitura cai no caminho legado.
   */
  private lerEnvelopeVersionado(valor: Buffer): EnvelopeVersionado | null {
    if (valor.length < 2 || valor[0] !== VERSAO_ENVELOPE_V1) return null;

    const tamanhoKeyId = valor[1];
    if (tamanhoKeyId !== TAMANHO_KEY_ID_HEX) return null;

    const inicioIv = 2 + tamanhoKeyId;
    if (valor.length < inicioIv + TAMANHO_IV + TAMANHO_TAG) return null;

    const keyId = valor.subarray(2, inicioIv).toString('utf8');
    if (!/^[0-9a-f]+$/.test(keyId)) return null;

    return {
      keyId,
      cabecalho: valor.subarray(0, inicioIv),
      iv: valor.subarray(inicioIv, inicioIv + TAMANHO_IV),
      tag: valor.subarray(inicioIv + TAMANHO_IV, inicioIv + TAMANHO_IV + TAMANHO_TAG),
      conteudo: valor.subarray(inicioIv + TAMANHO_IV + TAMANHO_TAG)
    };
  }

  /**
   * Devolve `null` em vez de propagar o erro do OpenSSL: a mensagem original
   * distingue causas e alimenta oraculo. Quem chama converte em um unico erro
   * generico.
   */
  private abrirGcm(
    chave: Buffer,
    iv: Buffer,
    tag: Buffer,
    conteudo: Buffer,
    aad?: Buffer
  ): string | null {
    if (iv.length !== TAMANHO_IV || tag.length !== TAMANHO_TAG) return null;

    try {
      const decifra = createDecipheriv('aes-256-gcm', chave, iv);
      if (aad) decifra.setAAD(aad);
      decifra.setAuthTag(tag);
      return Buffer.concat([decifra.update(conteudo), decifra.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  private normalizarTermosBusca(valor?: string): string[] {
    if (!valor?.trim()) return [];
    return valor
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private gerarHashIndicePii(chaveIndice: Buffer, tenantId: string, termo: string): string {
    return createHmac('sha256', chaveIndice)
      .update(`${tenantId}\0${termo}`)
      .digest('base64url');
  }

  /**
   * Chave do indice cego. Sem `CRIPTOGRAFIA_CHAVE_INDICE_HMAC` a derivacao e
   * exatamente a anterior ao PR 39, entao os hashes ja gravados continuam
   * validos. Com a variavel definida, o indice passa a usar material proprio e
   * exige backfill (`pnpm backfill:indices-busca`).
   */
  private obterChaveIndice(): Buffer {
    const dedicada = process.env.CRIPTOGRAFIA_CHAVE_INDICE_HMAC?.trim();
    const base = dedicada
      ? createHash('sha256')
          .update(this.exigirMaterial('CRIPTOGRAFIA_CHAVE_INDICE_HMAC', dedicada))
          .digest()
      : this.obterChaves()[0].chaveIndiceBase;

    return createHmac('sha256', base).update(ROTULO_INDICE).digest();
  }

  private obterChaves(): MaterialChave[] {
    const atual = this.derivarMaterial(this.obterChaveBase());

    const anteriorBruto = process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR?.trim();
    if (!anteriorBruto) return [atual];

    const anterior = this.derivarMaterial(
      this.exigirMaterial('CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR', anteriorBruto)
    );
    return anterior.keyId === atual.keyId ? [atual] : [atual, anterior];
  }

  private obterChaveBase(): string {
    const bruto = process.env.CRIPTOGRAFIA_CHAVE_AES_256?.trim();

    if (!bruto) {
      if (ambienteExigeFalhaFechada()) {
        throw new Error('CRIPTOGRAFIA_CHAVE_AES_256 e obrigatoria em staging e producao.');
      }
      return CHAVE_SINTETICA_LOCAL;
    }

    return this.exigirMaterial('CRIPTOGRAFIA_CHAVE_AES_256', bruto);
  }

  /**
   * O tamanho minimo so e cobrado onde ha dado real. Em local/test uma chave
   * curta continua aceita para nao quebrar bancos descartaveis existentes.
   */
  private exigirMaterial(nome: string, valor: string): string {
    if (ambienteExigeFalhaFechada() && Buffer.byteLength(valor, 'utf8') < TAMANHO_MINIMO_CHAVE_BYTES) {
      throw new Error(`${nome} precisa ter pelo menos ${TAMANHO_MINIMO_CHAVE_BYTES} bytes.`);
    }
    return valor;
  }

  private derivarMaterial(chaveBase: string): MaterialChave {
    const chaveLegado = createHash('sha256').update(chaveBase).digest();
    const chaveCifra = createHmac('sha256', chaveLegado).update(ROTULO_CIFRA).digest();
    const keyId = createHmac('sha256', chaveCifra)
      .update(ROTULO_KEY_ID)
      .digest('hex')
      .slice(0, TAMANHO_KEY_ID_HEX);

    return { keyId, chaveCifra, chaveLegado, chaveIndiceBase: chaveLegado };
  }
}
