import { BadRequestException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client } from '@aws-sdk/client-s3';
import { detectarMimeType, ServicoArmazenamentoObjetos } from './servico-armazenamento-objetos';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://upload.example/assinado') }));

/**
 * Fake S3 em memoria, ligado a `S3Client.prototype.send`. Nao e MinIO nem
 * Backblaze real, mas implementa o contrato observavel dos cinco comandos que
 * `ServicoArmazenamentoObjetos` usa — inclusive `CopySourceIfMatch` e a
 * semantica de "o objeto copiado e o que estava la no momento da copia", nao
 * um retorno encenado. E o mecanismo equivalente descrito na secao 36 do
 * escopo do PR 44 quando o ambiente nao tem Docker disponivel para subir um
 * S3-compativel real (ver relatorio do PR 44 para a tentativa registrada).
 */
interface ObjetoFakeS3 {
  corpo: Buffer;
  metadata: Record<string, string>;
  contentType?: string;
  etag: string;
}

function criarErroAwsSimulado(nome: string, status: number): Error {
  const erro = new Error(nome) as Error & { name: string; $metadata: { httpStatusCode: number } };
  erro.name = nome;
  erro.$metadata = { httpStatusCode: status };
  return erro;
}

function calcularEtag(corpo: Buffer): string {
  let hash = 0;
  for (const byte of corpo) hash = (hash * 31 + byte) >>> 0;
  return `etag-${hash}-${corpo.length}`;
}

function criarFakeS3() {
  const bucket = new Map<string, ObjetoFakeS3>();

  function chave(bucketNome: string, key: string): string {
    return `${bucketNome}/${key}`;
  }

  function definirObjeto(bucketNome: string, key: string, corpo: Buffer, metadata: Record<string, string> = {}, contentType?: string): void {
    bucket.set(chave(bucketNome, key), { corpo, metadata, contentType, etag: calcularEtag(corpo) });
  }

  function removerObjeto(bucketNome: string, key: string): void {
    bucket.delete(chave(bucketNome, key));
  }

  const send = jest.fn(async (comando: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const nomeComando = comando.constructor.name;
    const entrada = comando.input;

    if (nomeComando === 'PutObjectCommand') {
      const bucketNome = entrada.Bucket as string;
      const key = entrada.Key as string;
      if (entrada.IfNoneMatch === '*' && bucket.has(chave(bucketNome, key))) {
        throw criarErroAwsSimulado('PreconditionFailed', 412);
      }
      const corpo = Buffer.isBuffer(entrada.Body) ? entrada.Body : Buffer.from((entrada.Body as string) ?? '');
      definirObjeto(bucketNome, key, corpo, (entrada.Metadata as Record<string, string>) ?? {}, entrada.ContentType as string);
      return {};
    }

    if (nomeComando === 'HeadObjectCommand') {
      const objeto = bucket.get(chave(entrada.Bucket as string, entrada.Key as string));
      if (!objeto) throw criarErroAwsSimulado('NotFound', 404);
      return { ContentLength: objeto.corpo.length, Metadata: objeto.metadata, ETag: objeto.etag };
    }

    if (nomeComando === 'GetObjectCommand') {
      const objeto = bucket.get(chave(entrada.Bucket as string, entrada.Key as string));
      if (!objeto) throw criarErroAwsSimulado('NoSuchKey', 404);
      return { Body: { transformToByteArray: async () => new Uint8Array(objeto.corpo) }, ETag: objeto.etag };
    }

    if (nomeComando === 'CopyObjectCommand') {
      const bucketNome = entrada.Bucket as string;
      const origemCompleta = decodeURIComponent((entrada.CopySource as string).replace(`${bucketNome}/`, ''));
      const origem = bucket.get(chave(bucketNome, origemCompleta));
      if (!origem) throw criarErroAwsSimulado('NoSuchKey', 404);
      if (entrada.CopySourceIfMatch && entrada.CopySourceIfMatch !== origem.etag) {
        throw criarErroAwsSimulado('PreconditionFailed', 412);
      }
      definirObjeto(bucketNome, entrada.Key as string, Buffer.from(origem.corpo), { ...origem.metadata }, origem.contentType);
      return {};
    }

    if (nomeComando === 'DeleteObjectCommand') {
      removerObjeto(entrada.Bucket as string, entrada.Key as string);
      return {};
    }

    throw new Error(`Comando S3 nao suportado pelo fake de teste: ${nomeComando}`);
  });

  return { send, definirObjeto, removerObjeto, existeObjeto: (b: string, k: string) => bucket.has(chave(b, k)) };
}

function configurarAmbienteS3(): void {
  process.env.ARMAZENAMENTO_S3_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
  process.env.ARMAZENAMENTO_S3_ACCESS_KEY_ID = 'chave-teste';
  process.env.ARMAZENAMENTO_S3_SECRET_ACCESS_KEY = 'segredo-teste';
  process.env.ARMAZENAMENTO_BUCKET_MIDIA = 'bucket-teste';
}

describe('detectarMimeType', () => {
  afterEach(() => {
    delete process.env.ARMAZENAMENTO_S3_IF_NONE_MATCH;
    delete process.env.ARMAZENAMENTO_S3_FORCE_PATH_STYLE;
    jest.clearAllMocks();
  });

  it('aceita path-style explicito para armazenamento S3 local de E2E', async () => {
    process.env.ARMAZENAMENTO_S3_ENDPOINT = 'http://127.0.0.1:9000';
    process.env.ARMAZENAMENTO_S3_ACCESS_KEY_ID = 'chave-teste';
    process.env.ARMAZENAMENTO_S3_SECRET_ACCESS_KEY = 'segredo-teste';
    process.env.ARMAZENAMENTO_BUCKET_MIDIA = 'bucket-teste';
    process.env.ARMAZENAMENTO_S3_FORCE_PATH_STYLE = 'true';

    const servico = new ServicoArmazenamentoObjetos();
    await servico.criarUploadAssinado({
      chaveObjeto: 'pendentes/arquivo.jpg',
      mimeType: 'image/jpeg',
      tamanhoMaximoBytes: 3,
      metadados: {}
    });

    const cliente = jest.mocked(getSignedUrl).mock.calls[0][0] as unknown as {
      config: { forcePathStyle: boolean | (() => Promise<boolean>) };
    };
    const forcePathStyle = cliente.config.forcePathStyle;
    expect(typeof forcePathStyle === 'function' ? await forcePathStyle() : forcePathStyle).toBe(true);
  });

  it('deriva o MIME do conteudo, sem confiar no cabecalho enviado', () => {
    expect(detectarMimeType(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(detectarMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });

  it('rejeita conteudo fora da lista segura', () => {
    expect(() => detectarMimeType(Buffer.from('MZ executavel'))).toThrow(BadRequestException);
  });

  it('assina content-type, escrita condicional e metadados como headers obrigatorios', async () => {
    process.env.ARMAZENAMENTO_S3_ENDPOINT = 'https://conta.r2.cloudflarestorage.com';
    process.env.ARMAZENAMENTO_S3_ACCESS_KEY_ID = 'chave-teste';
    process.env.ARMAZENAMENTO_S3_SECRET_ACCESS_KEY = 'segredo-teste';
    process.env.ARMAZENAMENTO_BUCKET_MIDIA = 'bucket-teste';

    await new ServicoArmazenamentoObjetos().criarUploadAssinado({
      chaveObjeto: 'tenant/paciente/arquivo',
      mimeType: 'application/pdf',
      tamanhoMaximoBytes: 1024,
      metadados: { tenantid: 'tenant-1', envioid: 'envio-1' }
    });

    expect(jest.mocked(getSignedUrl)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: expect.objectContaining({ IfNoneMatch: '*' }) }),
      expect.objectContaining({
        expiresIn: 300,
        signableHeaders: new Set(['content-type', 'if-none-match']),
        unhoistableHeaders: new Set(['x-amz-meta-tenantid', 'x-amz-meta-envioid'])
      })
    );
  });

  it('permite desativar escrita condicional em provedores S3 que nao a suportam', async () => {
    process.env.ARMAZENAMENTO_S3_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
    process.env.ARMAZENAMENTO_S3_ACCESS_KEY_ID = 'chave-teste';
    process.env.ARMAZENAMENTO_S3_SECRET_ACCESS_KEY = 'segredo-teste';
    process.env.ARMAZENAMENTO_BUCKET_MIDIA = 'bucket-teste';
    process.env.ARMAZENAMENTO_S3_IF_NONE_MATCH = 'false';

    await new ServicoArmazenamentoObjetos().criarUploadAssinado({
      chaveObjeto: 'tenant/paciente/arquivo',
      mimeType: 'application/pdf',
      tamanhoMaximoBytes: 1024,
      metadados: { tenantid: 'tenant-1', envioid: 'envio-1' }
    });

    expect(jest.mocked(getSignedUrl)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: expect.not.objectContaining({ IfNoneMatch: expect.anything() }) }),
      expect.objectContaining({ signableHeaders: new Set(['content-type']) })
    );
  });
});

describe('ServicoArmazenamentoObjetos - operacoes reais contra S3 (fake em memoria)', () => {
  let fake: ReturnType<typeof criarFakeS3>;
  let enviar: jest.SpiedFunction<typeof S3Client.prototype.send>;

  beforeEach(() => {
    configurarAmbienteS3();
    fake = criarFakeS3();
    enviar = jest.spyOn(S3Client.prototype, 'send').mockImplementation(fake.send as never);
  });

  afterEach(() => {
    enviar.mockRestore();
    delete process.env.ARMAZENAMENTO_S3_ENDPOINT;
    delete process.env.ARMAZENAMENTO_S3_ACCESS_KEY_ID;
    delete process.env.ARMAZENAMENTO_S3_SECRET_ACCESS_KEY;
    delete process.env.ARMAZENAMENTO_BUCKET_MIDIA;
  });

  describe('inspecionarObjeto', () => {
    it('devolve o conteudo lido junto do tamanho, mime e hash', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      const conteudo = Buffer.from('%PDF-1.7 conteudo sintetico');
      fake.definirObjeto('bucket-teste', 'confirmados/x', conteudo, { arquivoid: 'x' });

      const resultado = await servico.inspecionarObjeto('bucket-teste', 'confirmados/x', 'documento', { arquivoid: 'x' });

      expect(resultado.conteudo.equals(conteudo)).toBe(true);
      expect(resultado.mimeType).toBe('application/pdf');
      expect(resultado.tamanhoBytes).toBe(conteudo.length);
    });
  });

  describe('imutabilidade pos-promocao (TOCTOU)', () => {
    it('a copia promovida preserva os bytes de quando a copia foi executada, imune a escrita posterior na chave pendente', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      const original = Buffer.from('%PDF-1.7 conteudo original validado');
      fake.definirObjeto('bucket-teste', 'pendentes/x', original, { arquivoid: 'x' });

      await servico.promoverObjeto('bucket-teste', 'pendentes/x', 'confirmados/x');

      // Um cliente ainda com a URL de upload assinada em maos escreve por cima
      // da chave pendente depois que a promocao ja ocorreu.
      fake.definirObjeto('bucket-teste', 'pendentes/x', Buffer.from('conteudo trocado apos a copia'), { arquivoid: 'x' });

      const inspecaoDoConfirmado = await servico.inspecionarObjeto('bucket-teste', 'confirmados/x', 'documento', { arquivoid: 'x' });
      expect(inspecaoDoConfirmado.conteudo.equals(original)).toBe(true);
    });
  });

  describe('substituirObjeto', () => {
    it('sobrescreve o conteudo de uma chave que o cliente nunca teve permissao de escrever', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      fake.definirObjeto('bucket-teste', 'confirmados/x', Buffer.from('%PDF-1.7 com metadado'), { arquivoid: 'x' });

      const sanitizado = Buffer.from('%PDF-1.7 sem metadado');
      await servico.substituirObjeto('bucket-teste', 'confirmados/x', sanitizado, 'application/pdf', { arquivoid: 'x' });

      const resultado = await servico.inspecionarObjeto('bucket-teste', 'confirmados/x', 'documento', { arquivoid: 'x' });
      expect(resultado.conteudo.equals(sanitizado)).toBe(true);
    });
  });

  describe('excluirObjetoVerificado', () => {
    it('conclui normalmente quando o objeto deixa de existir apos a exclusao', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      fake.definirObjeto('bucket-teste', 'confirmados/x', Buffer.from('conteudo'), {});

      await expect(servico.excluirObjetoVerificado('bucket-teste', 'confirmados/x')).resolves.toBeUndefined();
      expect(fake.existeObjeto('bucket-teste', 'confirmados/x')).toBe(false);
    });

    it('rejeita quando o HEAD posterior ainda enxerga o objeto (exclusao fisica nao confirmada)', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      fake.definirObjeto('bucket-teste', 'confirmados/x', Buffer.from('conteudo'), {});
      // Simula um provedor que aceita o DELETE mas nao remove de fato o objeto.
      enviar.mockImplementation(async (comando: unknown) => {
        const cmd = comando as { constructor: { name: string } };
        if (cmd.constructor.name === 'DeleteObjectCommand') return {};
        return fake.send(comando as never);
      });

      await expect(servico.excluirObjetoVerificado('bucket-teste', 'confirmados/x')).rejects.toThrow();
    });

    it('e idempotente: excluir um objeto ja ausente nao lanca erro', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      await expect(servico.excluirObjetoVerificado('bucket-teste', 'confirmados/inexistente')).resolves.toBeUndefined();
    });

    it('propaga erro de rede/permissao em vez de assumir exclusao confirmada', async () => {
      const servico = new ServicoArmazenamentoObjetos();
      fake.definirObjeto('bucket-teste', 'confirmados/x', Buffer.from('conteudo'), {});
      enviar.mockImplementation(async (comando: unknown) => {
        const cmd = comando as { constructor: { name: string } };
        if (cmd.constructor.name === 'HeadObjectCommand') throw criarErroAwsSimulado('InternalError', 500);
        return fake.send(comando as never);
      });

      await expect(servico.excluirObjetoVerificado('bucket-teste', 'confirmados/x')).rejects.toThrow();
    });
  });
});
