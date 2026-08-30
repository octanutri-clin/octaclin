import { createHash } from 'crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TipoMidiaMobile } from '../../modulos/mobile/dominio/validacao-midia';

const LIMITE_ARQUIVO_BYTES = 25 * 1024 * 1024;
const EXPIRACAO_URL_SEGUNDOS = 300;

const MIME_POR_TIPO: Record<TipoMidiaMobile, ReadonlySet<string>> = {
  imagem: new Set(['image/jpeg', 'image/png', 'image/webp']),
  audio: new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav']),
  video: new Set(['video/mp4', 'video/webm']),
  documento: new Set(['application/pdf'])
};

export function validarUploadSolicitado(tipo: TipoMidiaMobile, mimeType: string, tamanhoBytes: number): void {
  if (!MIME_POR_TIPO[tipo].has(mimeType)) throw new BadRequestException('Tipo de arquivo nao permitido.');
  if (!Number.isSafeInteger(tamanhoBytes) || tamanhoBytes < 1 || tamanhoBytes > LIMITE_ARQUIVO_BYTES) {
    throw new BadRequestException('Arquivo deve ter no maximo 25 MB.');
  }
}

export function detectarMimeType(conteudo: Buffer): string {
  if (conteudo.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (conteudo.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (conteudo.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (conteudo.subarray(0, 4).toString('ascii') === 'RIFF' && conteudo.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (conteudo.subarray(0, 4).toString('ascii') === 'RIFF' && conteudo.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  if (conteudo.subarray(0, 3).toString('ascii') === 'ID3' || (conteudo[0] === 0xff && (conteudo[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (conteudo.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (conteudo.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  if (conteudo.subarray(4, 8).toString('ascii') === 'ftyp') {
    return conteudo.subarray(8, 12).toString('ascii').startsWith('M4A') ? 'audio/mp4' : 'video/mp4';
  }
  throw new BadRequestException('Conteudo do arquivo nao permitido.');
}

@Injectable()
export class ServicoArmazenamentoObjetos {
  private configuracao?: { cliente: S3Client; bucket: string };

  get bucket(): string {
    return this.obterConfiguracao().bucket;
  }

  get usarIfNoneMatch(): boolean {
    return process.env.ARMAZENAMENTO_S3_IF_NONE_MATCH !== 'false';
  }

  async criarUploadAssinado(entrada: {
    chaveObjeto: string;
    mimeType: string;
    tamanhoMaximoBytes: number;
    metadados: Record<string, string>;
  }): Promise<string> {
    const { cliente, bucket } = this.obterConfiguracao();
    const headersMetadados = new Set(Object.keys(entrada.metadados).map((chave) => `x-amz-meta-${chave.toLowerCase()}`));
    const usarIfNoneMatch = this.usarIfNoneMatch;
    const headersAssinados = new Set(['content-type']);
    if (usarIfNoneMatch) headersAssinados.add('if-none-match');
    return getSignedUrl(
      cliente,
      new PutObjectCommand({
        Bucket: bucket,
        Key: entrada.chaveObjeto,
        ContentType: entrada.mimeType,
        ContentLength: entrada.tamanhoMaximoBytes,
        ...(usarIfNoneMatch ? { IfNoneMatch: '*' } : {}),
        Metadata: entrada.metadados
      }),
      {
        expiresIn: EXPIRACAO_URL_SEGUNDOS,
        unhoistableHeaders: headersMetadados,
        signableHeaders: headersAssinados
      }
    );
  }

  async inspecionarObjeto(
    bucket: string,
    chaveObjeto: string,
    tipo: TipoMidiaMobile,
    metadadosEsperados: Record<string, string>
  ): Promise<{ tamanhoBytes: number; mimeType: string; hashConteudo: string; conteudo: Buffer }> {
    const { cliente } = this.obterConfiguracao();
    const cabecalho = await cliente.send(new HeadObjectCommand({ Bucket: bucket, Key: chaveObjeto }));
    const tamanhoBytes = cabecalho.ContentLength ?? 0;
    if (tamanhoBytes < 1 || tamanhoBytes > LIMITE_ARQUIVO_BYTES) throw new BadRequestException('Tamanho real do arquivo nao permitido.');
    for (const [chave, valor] of Object.entries(metadadosEsperados)) {
      if (cabecalho.Metadata?.[chave.toLowerCase()] !== valor) throw new BadRequestException('Objeto nao pertence ao anexo solicitado.');
    }

    const resposta = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: chaveObjeto }));
    if (!resposta.Body) throw new BadRequestException('Objeto enviado sem conteudo.');
    const conteudo = Buffer.from(await resposta.Body.transformToByteArray());
    if (conteudo.length !== tamanhoBytes) throw new BadRequestException('Objeto enviado esta incompleto.');
    const mimeType = detectarMimeType(conteudo);
    if (!MIME_POR_TIPO[tipo].has(mimeType)) throw new BadRequestException('Conteudo nao corresponde ao tipo de anexo.');
    return { tamanhoBytes, mimeType, hashConteudo: createHash('sha256').update(conteudo).digest('hex'), conteudo };
  }

  /**
   * Sobrescreve o conteudo de uma chave que o cliente nunca recebeu URL
   * assinada para escrever (a chave `confirmados/...` so existe apos
   * `promoverObjeto`). Usada para persistir a versao sanitizada de uma
   * imagem (metadado EXIF/GPS removido) no lugar exato que ja foi validado,
   * sem reabrir uma janela de substituicao pelo cliente.
   */
  async substituirObjeto(bucket: string, chaveObjeto: string, conteudo: Buffer, mimeType: string, metadados: Record<string, string>): Promise<void> {
    const { cliente } = this.obterConfiguracao();
    await cliente.send(new PutObjectCommand({ Bucket: bucket, Key: chaveObjeto, Body: conteudo, ContentType: mimeType, Metadata: metadados }));
  }

  async criarDownloadAssinado(bucket: string, chaveObjeto: string): Promise<string> {
    const { cliente } = this.obterConfiguracao();
    return getSignedUrl(cliente, new GetObjectCommand({ Bucket: bucket, Key: chaveObjeto }), { expiresIn: EXPIRACAO_URL_SEGUNDOS });
  }

  async promoverObjeto(bucket: string, chaveOrigem: string, chaveDestino: string): Promise<void> {
    const { cliente } = this.obterConfiguracao();
    const origem = `${bucket}/${chaveOrigem.split('/').map(encodeURIComponent).join('/')}`;
    await cliente.send(new CopyObjectCommand({ Bucket: bucket, Key: chaveDestino, CopySource: origem, MetadataDirective: 'COPY' }));
  }

  async excluirObjeto(bucket: string, chaveObjeto: string): Promise<void> {
    const { cliente } = this.obterConfiguracao();
    await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: chaveObjeto }));
  }

  /**
   * Exclusao com prova: so retorna com sucesso quando um HEAD subsequente
   * confirma que o objeto deixou de existir. `DeleteObjectCommand` sozinho
   * nao e evidencia de exclusao fisica — o S3 responde sucesso mesmo que o
   * objeto nunca tenha existido, e um provedor com falha silenciosa poderia
   * aceitar o DELETE sem remover o dado. Erro de rede/permissao no HEAD de
   * verificacao propaga em vez de ser interpretado como "objeto ausente".
   */
  async excluirObjetoVerificado(bucket: string, chaveObjeto: string): Promise<void> {
    const { cliente } = this.obterConfiguracao();
    await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: chaveObjeto }));
    if (!(await this.objetoAusente(cliente, bucket, chaveObjeto))) {
      throw new Error('Exclusao fisica do objeto nao pode ser confirmada.');
    }
  }

  private async objetoAusente(cliente: S3Client, bucket: string, chaveObjeto: string): Promise<boolean> {
    try {
      await cliente.send(new HeadObjectCommand({ Bucket: bucket, Key: chaveObjeto }));
      return false;
    } catch (erro) {
      const detalhe = erro as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (detalhe?.$metadata?.httpStatusCode === 404 || detalhe?.name === 'NotFound' || detalhe?.name === 'NoSuchKey') return true;
      throw erro;
    }
  }

  private obterConfiguracao(): { cliente: S3Client; bucket: string } {
    if (this.configuracao) return this.configuracao;
    const endpoint = process.env.ARMAZENAMENTO_S3_ENDPOINT;
    const accessKeyId = process.env.ARMAZENAMENTO_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.ARMAZENAMENTO_S3_SECRET_ACCESS_KEY;
    const bucket = process.env.ARMAZENAMENTO_BUCKET_MIDIA;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new ServiceUnavailableException('Armazenamento de anexos nao configurado.');
    }
    this.configuracao = {
      bucket,
      cliente: new S3Client({
        endpoint,
        region: process.env.ARMAZENAMENTO_S3_REGION ?? 'auto',
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: process.env.ARMAZENAMENTO_S3_FORCE_PATH_STYLE === 'true'
      })
    };
    return this.configuracao;
  }
}
