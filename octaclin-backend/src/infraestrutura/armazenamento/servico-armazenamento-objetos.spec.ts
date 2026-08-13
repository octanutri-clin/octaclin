import { BadRequestException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { detectarMimeType, ServicoArmazenamentoObjetos } from './servico-armazenamento-objetos';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://upload.example/assinado') }));

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
