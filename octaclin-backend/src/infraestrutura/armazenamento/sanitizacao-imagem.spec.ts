import { extrairDimensoesImagem, removerMetadadosImagem, validarDimensoesImagem } from './sanitizacao-imagem';

function png(largura: number, altura: number, chunksExtra: Array<{ tipo: string; dados: Uint8Array }> = []): Buffer {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrDados = Buffer.alloc(13);
  ihdrDados.writeUInt32BE(largura, 0);
  ihdrDados.writeUInt32BE(altura, 4);
  ihdrDados[8] = 8;
  ihdrDados[9] = 6;

  function chunk(tipo: string, dados: Uint8Array): Buffer {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length, 0);
    return Buffer.concat([tamanho, Buffer.from(tipo, 'ascii'), dados, Buffer.alloc(4)]);
  }

  const partes = [assinatura, chunk('IHDR', ihdrDados)];
  for (const extra of chunksExtra) partes.push(chunk(extra.tipo, extra.dados));
  partes.push(chunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])));
  partes.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(partes);
}

function jpeg(largura: number, altura: number, marcadoresExtra: Array<{ marcador: number; dados: Uint8Array }> = []): Buffer {
  function segmento(marcador: number, dados: Uint8Array): Buffer {
    const tamanho = Buffer.alloc(2);
    tamanho.writeUInt16BE(dados.length + 2, 0);
    return Buffer.concat([Buffer.from([0xff, marcador]), tamanho, dados]);
  }

  const sof0 = Buffer.alloc(6);
  sof0[0] = 8;
  sof0.writeUInt16BE(altura, 1);
  sof0.writeUInt16BE(largura, 3);
  sof0[5] = 1;

  const partes: Buffer[] = [Buffer.from([0xff, 0xd8])];
  for (const extra of marcadoresExtra) partes.push(segmento(extra.marcador, extra.dados));
  partes.push(segmento(0xc0, sof0));
  partes.push(Buffer.from([0xff, 0xda, 0x00, 0x02]));
  partes.push(Buffer.from([0x00, 0x00]));
  partes.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(partes);
}

function webpVp8x(largura: number, altura: number): Buffer {
  const dadosVp8x = Buffer.alloc(10);
  dadosVp8x.writeUIntLE(largura - 1, 4, 3);
  dadosVp8x.writeUIntLE(altura - 1, 7, 3);
  const chunkVp8x = Buffer.concat([Buffer.from('VP8X', 'ascii'), tamanhoLE(dadosVp8x.length), dadosVp8x]);
  const corpo = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunkVp8x]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), tamanhoLE(corpo.length), corpo]);
}

function webpVp8Perdas(largura: number, altura: number): Buffer {
  const dados = Buffer.alloc(10);
  dados[0] = 0x30;
  dados[1] = 0x00;
  dados[2] = 0x00;
  dados[3] = 0x9d;
  dados[4] = 0x01;
  dados[5] = 0x2a;
  dados.writeUInt16LE(largura & 0x3fff, 6);
  dados.writeUInt16LE(altura & 0x3fff, 8);
  const chunkVp8 = Buffer.concat([Buffer.from('VP8 ', 'ascii'), tamanhoLE(dados.length), dados]);
  const corpo = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunkVp8]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), tamanhoLE(corpo.length), corpo]);
}

function webpVp8Semperdas(largura: number, altura: number): Buffer {
  const dados = Buffer.alloc(5);
  dados[0] = 0x2f;
  const empacotado = ((largura - 1) & 0x3fff) | (((altura - 1) & 0x3fff) << 14);
  dados.writeUInt32LE(empacotado >>> 0, 1);
  const chunkVp8l = Buffer.concat([Buffer.from('VP8L', 'ascii'), tamanhoLE(dados.length), dados]);
  const corpo = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunkVp8l]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), tamanhoLE(corpo.length), corpo]);
}

function tamanhoLE(valor: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(valor, 0);
  return buffer;
}

describe('extrairDimensoesImagem', () => {
  it('le largura e altura reais de um PNG a partir do IHDR', () => {
    expect(extrairDimensoesImagem(png(800, 600), 'image/png')).toEqual({ largura: 800, altura: 600 });
  });

  it('le largura e altura reais de um JPEG a partir do marcador SOF0', () => {
    expect(extrairDimensoesImagem(jpeg(1024, 768), 'image/jpeg')).toEqual({ largura: 1024, altura: 768 });
  });

  it('ignora marcadores APPn/COM antes de localizar o SOF real', () => {
    const comFalso = jpeg(320, 240, [{ marcador: 0xe1, dados: Buffer.alloc(20) }]);
    expect(extrairDimensoesImagem(comFalso, 'image/jpeg')).toEqual({ largura: 320, altura: 240 });
  });

  it('le dimensoes de WEBP estendido (VP8X)', () => {
    expect(extrairDimensoesImagem(webpVp8x(500, 400), 'image/webp')).toEqual({ largura: 500, altura: 400 });
  });

  it('le dimensoes de WEBP com perdas (VP8)', () => {
    expect(extrairDimensoesImagem(webpVp8Perdas(64, 48), 'image/webp')).toEqual({ largura: 64, altura: 48 });
  });

  it('le dimensoes de WEBP sem perdas (VP8L)', () => {
    expect(extrairDimensoesImagem(webpVp8Semperdas(100, 50), 'image/webp')).toEqual({ largura: 100, altura: 50 });
  });

  it('rejeita PNG truncado antes do IHDR completo', () => {
    const truncado = png(10, 10).subarray(0, 20);
    expect(() => extrairDimensoesImagem(truncado, 'image/png')).toThrow();
  });

  it('rejeita JPEG sem nenhum marcador SOF (estrutura invalida)', () => {
    const semSof = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xd9])]);
    expect(() => extrairDimensoesImagem(semSof, 'image/jpeg')).toThrow();
  });

  it('rejeita WEBP com assinatura RIFF/WEBP incorreta', () => {
    const invalido = Buffer.from('RIFFXXXXWEBX', 'ascii');
    expect(() => extrairDimensoesImagem(invalido, 'image/webp')).toThrow();
  });

  it('rejeita VP8 com start code adulterado', () => {
    const valido = webpVp8Perdas(64, 48);
    const adulterado = Buffer.from(valido);
    adulterado[12 + 4 + 4 + 3] = 0xff;
    expect(() => extrairDimensoesImagem(adulterado, 'image/webp')).toThrow();
  });

  it('rejeita VP8L com assinatura adulterada', () => {
    const valido = webpVp8Semperdas(100, 50);
    const adulterado = Buffer.from(valido);
    adulterado[12 + 4 + 4] = 0x00;
    expect(() => extrairDimensoesImagem(adulterado, 'image/webp')).toThrow();
  });
});

describe('validarDimensoesImagem', () => {
  it('aceita imagem dentro dos limites', () => {
    expect(() => validarDimensoesImagem(png(1920, 1080), 'image/png')).not.toThrow();
  });

  it('rejeita largura declarada acima do limite (decompression bomb sintetica)', () => {
    expect(() => validarDimensoesImagem(png(50000, 10), 'image/png')).toThrow();
  });

  it('rejeita altura declarada acima do limite', () => {
    expect(() => validarDimensoesImagem(jpeg(10, 50000), 'image/jpeg')).toThrow();
  });

  it('rejeita quantidade total de pixels acima do limite mesmo com largura/altura individualmente aceitas', () => {
    expect(() => validarDimensoesImagem(png(11000, 11000), 'image/png')).toThrow();
  });

  it('rejeita dimensao zero', () => {
    expect(() => validarDimensoesImagem(png(0, 100), 'image/png')).toThrow();
  });
});

describe('removerMetadadosImagem', () => {
  it('remove segmentos APPn/EXIF e COM de um JPEG preservando os pixels', () => {
    const exifFalso = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), Buffer.from('GPS 40.7128,-74.0060 autor=teste')]);
    const original = jpeg(64, 64, [
      { marcador: 0xe1, dados: exifFalso },
      { marcador: 0xfe, dados: Buffer.from('comentario sensivel') }
    ]);

    const limpo = removerMetadadosImagem(original, 'image/jpeg');

    expect(limpo.includes('GPS')).toBe(false);
    expect(limpo.includes('comentario sensivel')).toBe(false);
    expect(extrairDimensoesImagem(limpo, 'image/jpeg')).toEqual({ largura: 64, altura: 64 });
    expect(limpo.length).toBeLessThan(original.length);
  });

  it('mantem um JPEG sem metadados inalterado (idempotente)', () => {
    const original = jpeg(32, 32);
    const limpo = removerMetadadosImagem(original, 'image/jpeg');
    expect(limpo.equals(original)).toBe(true);
  });

  it('remove chunks tEXt/eXIf/tIME de um PNG preservando IHDR/IDAT/IEND', () => {
    const original = png(48, 48, [
      { tipo: 'tEXt', dados: Buffer.from('Author\0Paciente Sintetico') },
      { tipo: 'eXIf', dados: Buffer.from('GPS 40.7128,-74.0060') },
      { tipo: 'tIME', dados: Buffer.alloc(7) }
    ]);

    const limpo = removerMetadadosImagem(original, 'image/png');

    expect(limpo.includes('Paciente Sintetico')).toBe(false);
    expect(limpo.includes('GPS')).toBe(false);
    expect(extrairDimensoesImagem(limpo, 'image/png')).toEqual({ largura: 48, altura: 48 });
  });

  it('remove chunk EXIF de um WEBP estendido e corrige o tamanho RIFF', () => {
    const dadosVp8x = Buffer.alloc(10);
    dadosVp8x.writeUIntLE(99, 4, 3);
    dadosVp8x.writeUIntLE(49, 7, 3);
    const chunkVp8x = Buffer.concat([Buffer.from('VP8X', 'ascii'), tamanhoLE(dadosVp8x.length), dadosVp8x]);
    const exif = Buffer.from('GPS 40.7128,-74.0060');
    const chunkExif = Buffer.concat([Buffer.from('EXIF', 'ascii'), tamanhoLE(exif.length), exif]);
    const corpo = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunkVp8x, chunkExif]);
    const original = Buffer.concat([Buffer.from('RIFF', 'ascii'), tamanhoLE(corpo.length), corpo]);

    const limpo = removerMetadadosImagem(original, 'image/webp');

    expect(limpo.includes('GPS')).toBe(false);
    expect(limpo.readUInt32LE(4)).toBe(limpo.length - 8);
    expect(extrairDimensoesImagem(limpo, 'image/webp')).toEqual({ largura: 100, altura: 50 });
  });
});
