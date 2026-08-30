import { BadRequestException } from '@nestjs/common';

/**
 * Validacao e sanitizacao de imagens clinicas (PR 44 da governanca de
 * seguranca). Cobre apenas os tres formatos de imagem aceitos pelo produto
 * (JPEG, PNG, WEBP) — nenhum parser generico ou de formato nao suportado
 * (ICNS, JXL, HEIF, GIF animado etc.) e implementado aqui, ao contrario de
 * bibliotecas de proposito geral que expuseram DoS justamente nesses formatos
 * extras (ver `docs/governance/MODELO_AMEACAS_E_TRIAGEM_SEGURANCA.md` sobre
 * `image-size`). Toda leitura opera sobre um buffer ja limitado a 25 MB pelo
 * chamador; os parsers abaixo sao O(1) (PNG) ou percorrem a estrutura uma
 * unica vez com avanco estritamente crescente (JPEG/WEBP), sem recursao e sem
 * possibilidade de loop infinito.
 */

export interface DimensoesImagem {
  largura: number;
  altura: number;
}

const LARGURA_MAXIMA_PX = 12000;
const ALTURA_MAXIMA_PX = 12000;
const TOTAL_PIXELS_MAXIMO = 100_000_000;

const ERRO_ESTRUTURA_INVALIDA = 'Estrutura da imagem invalida ou nao reconhecida.';

function lerUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function extrairDimensoesPng(conteudo: Buffer): DimensoesImagem {
  // Assinatura (8) + comprimento do IHDR (4) + tipo "IHDR" (4) + largura (4) + altura (4).
  if (conteudo.length < 24 || conteudo.toString('ascii', 12, 16) !== 'IHDR') {
    throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
  }
  return { largura: conteudo.readUInt32BE(16), altura: conteudo.readUInt32BE(20) };
}

function extrairDimensoesJpeg(conteudo: Buffer): DimensoesImagem {
  if (conteudo.length < 4 || conteudo[0] !== 0xff || conteudo[1] !== 0xd8) {
    throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
  }

  const MARCADORES_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  const LIMITE_SEGMENTOS = 2000;
  let offset = 2;
  let segmentos = 0;

  while (offset + 1 < conteudo.length) {
    if (segmentos++ > LIMITE_SEGMENTOS) throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
    if (conteudo[offset] !== 0xff) throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);

    let marcador = conteudo[offset + 1];
    let cursor = offset + 2;
    // Padding 0xFF antes do marcador real e valido no formato JPEG.
    while (marcador === 0xff && cursor < conteudo.length) {
      marcador = conteudo[cursor];
      cursor += 1;
    }
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd9)) {
      offset = cursor;
      continue;
    }
    if (cursor + 1 >= conteudo.length) break;
    const tamanhoSegmento = conteudo.readUInt16BE(cursor);
    if (tamanhoSegmento < 2) throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
    const dadosOffset = cursor + 2;

    if (MARCADORES_SOF.has(marcador)) {
      if (dadosOffset + 5 > conteudo.length) throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
      return { altura: conteudo.readUInt16BE(dadosOffset + 1), largura: conteudo.readUInt16BE(dadosOffset + 3) };
    }
    if (marcador === 0xda) break; // Start of Scan: dados binarios da imagem, sem mais marcadores relevantes antes.

    offset = cursor + tamanhoSegmento;
  }

  throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
}

function extrairDimensoesWebp(conteudo: Buffer): DimensoesImagem {
  if (
    conteudo.length < 20 ||
    conteudo.toString('ascii', 0, 4) !== 'RIFF' ||
    conteudo.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
  }

  const fourCc = conteudo.toString('ascii', 12, 16);
  const dados = conteudo.subarray(20);

  if (fourCc === 'VP8X') {
    if (dados.length < 10) throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
    return { largura: lerUInt24LE(dados, 4) + 1, altura: lerUInt24LE(dados, 7) + 1 };
  }

  if (fourCc === 'VP8 ') {
    if (dados.length < 10 || dados[3] !== 0x9d || dados[4] !== 0x01 || dados[5] !== 0x2a) {
      throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
    }
    return { largura: dados.readUInt16LE(6) & 0x3fff, altura: dados.readUInt16LE(8) & 0x3fff };
  }

  if (fourCc === 'VP8L') {
    if (dados.length < 5 || dados[0] !== 0x2f) throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
    const empacotado = dados.readUInt32LE(1);
    return { largura: (empacotado & 0x3fff) + 1, altura: ((empacotado >>> 14) & 0x3fff) + 1 };
  }

  throw new BadRequestException(ERRO_ESTRUTURA_INVALIDA);
}

/** Le a largura e a altura reais da propria estrutura do arquivo — nunca do metadado declarado pelo cliente. */
export function extrairDimensoesImagem(conteudo: Buffer, mimeType: string): DimensoesImagem {
  if (mimeType === 'image/png') return extrairDimensoesPng(conteudo);
  if (mimeType === 'image/jpeg') return extrairDimensoesJpeg(conteudo);
  if (mimeType === 'image/webp') return extrairDimensoesWebp(conteudo);
  throw new BadRequestException('Tipo de imagem sem validacao de dimensoes disponivel.');
}

/**
 * Defesa contra decompression bomb: falha fechado sempre que a extracao de
 * dimensoes falhar (formato nao reconhecido conta como rejeicao, nunca como
 * "sem checagem") ou quando largura, altura ou o total de pixels excederem o
 * limite absoluto do produto.
 */
export function validarDimensoesImagem(conteudo: Buffer, mimeType: string): DimensoesImagem {
  const dimensoes = extrairDimensoesImagem(conteudo, mimeType);
  if (dimensoes.largura < 1 || dimensoes.altura < 1) {
    throw new BadRequestException('Imagem com dimensoes invalidas.');
  }
  if (dimensoes.largura > LARGURA_MAXIMA_PX || dimensoes.altura > ALTURA_MAXIMA_PX) {
    throw new BadRequestException('Imagem excede a largura ou altura maxima permitida.');
  }
  if (dimensoes.largura * dimensoes.altura > TOTAL_PIXELS_MAXIMO) {
    throw new BadRequestException('Imagem excede a quantidade maxima de pixels permitida.');
  }
  return dimensoes;
}

function removerMetadadosJpeg(conteudo: Buffer): Buffer {
  const partes: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let offset = 2;

  while (offset + 1 < conteudo.length) {
    if (conteudo[offset] !== 0xff) {
      // Estrutura que o parser de dimensoes ja teria rejeitado; preserva o restante sem tentar reinterpretar.
      partes.push(conteudo.subarray(offset));
      return Buffer.concat(partes);
    }

    const marcador = conteudo[offset + 1];
    if (marcador === 0xda) {
      partes.push(conteudo.subarray(offset));
      return Buffer.concat(partes);
    }
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd9)) {
      partes.push(conteudo.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const dadosOffset = offset + 2;
    if (dadosOffset + 1 >= conteudo.length) {
      partes.push(conteudo.subarray(offset));
      return Buffer.concat(partes);
    }
    const tamanhoSegmento = conteudo.readUInt16BE(dadosOffset);
    const fimSegmento = offset + 2 + tamanhoSegmento;
    const ehMetadado = (marcador >= 0xe0 && marcador <= 0xef) || marcador === 0xfe;
    if (!ehMetadado) partes.push(conteudo.subarray(offset, fimSegmento));
    offset = fimSegmento;
  }

  return Buffer.concat(partes);
}

const CHUNKS_METADADO_PNG = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function removerMetadadosPng(conteudo: Buffer): Buffer {
  const partes: Buffer[] = [conteudo.subarray(0, 8)];
  let offset = 8;

  while (offset + 8 <= conteudo.length) {
    const tamanhoDados = conteudo.readUInt32BE(offset);
    const tipo = conteudo.toString('ascii', offset + 4, offset + 8);
    const fimChunk = offset + 12 + tamanhoDados;
    if (fimChunk > conteudo.length) break;
    if (!CHUNKS_METADADO_PNG.has(tipo)) partes.push(conteudo.subarray(offset, fimChunk));
    offset = fimChunk;
    if (tipo === 'IEND') break;
  }

  return Buffer.concat(partes);
}

const CHUNKS_METADADO_WEBP = new Set(['EXIF', 'XMP ']);

function removerMetadadosWebp(conteudo: Buffer): Buffer {
  const corpo: Buffer[] = [];
  let offset = 12;

  while (offset + 8 <= conteudo.length) {
    const fourCc = conteudo.toString('ascii', offset, offset + 4);
    const tamanhoDados = conteudo.readUInt32LE(offset + 4);
    const tamanhoComPadding = tamanhoDados + (tamanhoDados % 2);
    const fimChunk = offset + 8 + tamanhoComPadding;
    if (fimChunk > conteudo.length) break;
    if (!CHUNKS_METADADO_WEBP.has(fourCc)) corpo.push(conteudo.subarray(offset, fimChunk));
    offset = fimChunk;
  }

  const corpoFinal = Buffer.concat(corpo);
  const tamanhoRiff = Buffer.alloc(4);
  tamanhoRiff.writeUInt32LE(4 + corpoFinal.length, 0);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), tamanhoRiff, Buffer.from('WEBP', 'ascii'), corpoFinal]);
}

/**
 * Remove metadado nao essencial (EXIF, GPS, comentarios, texto embutido) sem
 * decodificar nem re-codificar os pixels: cada formato e percorrido pela
 * propria estrutura de segmentos/chunks e os blocos de metadado sao excisados
 * byte a byte, preservando os dados de imagem exatamente como estavam.
 * Idempotente: uma imagem sem metadado volta identica.
 */
export function removerMetadadosImagem(conteudo: Buffer, mimeType: string): Buffer {
  if (mimeType === 'image/jpeg') return removerMetadadosJpeg(conteudo);
  if (mimeType === 'image/png') return removerMetadadosPng(conteudo);
  if (mimeType === 'image/webp') return removerMetadadosWebp(conteudo);
  throw new BadRequestException('Tipo de imagem sem sanitizacao de metadados disponivel.');
}
