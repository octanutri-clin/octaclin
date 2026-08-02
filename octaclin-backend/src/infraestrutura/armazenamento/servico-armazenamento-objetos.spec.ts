import { BadRequestException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { detectarMimeType, ServicoArmazenamentoObjetos } from './servico-armazenamento-objetos';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://upload.example/assinado') }));

describe('detectarMimeType', () => {
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
});
