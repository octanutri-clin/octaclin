import { readFileSync } from 'fs';
import { PeerCertificate, checkServerIdentity } from 'tls';
import { ambienteExigeFalhaFechada, obterAmbienteExecucao } from '../seguranca/ambiente-execucao';

/**
 * Configuracao TLS da conexao Postgres.
 *
 * Ate o PR 39 o backend desligava a verificacao de certificado sempre que TLS
 * estava ligado: a conexao era cifrada, mas qualquer certificado era aceito, o
 * que permite interceptacao ativa entre o runtime e o banco. Aqui a verificacao
 * de cadeia e de hostname passa a ser obrigatoria em todos os ambientes, sem
 * escape hatch: um banco com certificado proprio se resolve declarando a CA em
 * `BANCO_SSL_CA`, nunca aceitando qualquer certificado.
 */
export type ConfiguracaoSslPostgres =
  | false
  | {
      /** Sempre `true`: nao existe caminho que produza verificacao desligada. */
      rejectUnauthorized: true;
      ca?: string;
      servername?: string;
      checkServerIdentity?: (host: string, certificado: PeerCertificate) => Error | undefined;
    };

const MODOS_SSL_SUPORTADOS = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'] as const;
const MODOS_SSL_EXIGEM_TLS = ['require', 'verify-ca', 'verify-full'];
const MODOS_SSL_PERMISSIVOS = ['disable', 'allow', 'prefer'];

type ModoSsl = (typeof MODOS_SSL_SUPORTADOS)[number];

function booleanoEstrito(nome: string): boolean | undefined {
  const valor = process.env[nome];
  if (valor === undefined || valor.trim() === '') return undefined;
  if (valor === 'true') return true;
  if (valor === 'false') return false;

  throw new Error(`${nome} deve ser "true" ou "false".`);
}

function normalizarModoSsl(sslMode?: string | null): ModoSsl | undefined {
  const valor = sslMode?.trim().toLowerCase();
  if (!valor) return undefined;

  if (!(MODOS_SSL_SUPORTADOS as readonly string[]).includes(valor)) {
    throw new Error(
      `sslmode "${valor}" nao e suportado. Use um de: ${MODOS_SSL_SUPORTADOS.join(', ')}.`
    );
  }
  return valor as ModoSsl;
}

function obterCaConfiada(): string | undefined {
  const inline = process.env.BANCO_SSL_CA?.trim();
  const caminho = process.env.BANCO_SSL_CA_ARQUIVO?.trim();

  if (inline && caminho) {
    throw new Error('BANCO_SSL_CA e BANCO_SSL_CA_ARQUIVO nao podem ser usados juntos.');
  }

  if (inline) {
    if (!inline.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error('BANCO_SSL_CA precisa conter um certificado PEM.');
    }
    return inline;
  }

  if (!caminho) return undefined;

  let conteudo: string;
  try {
    conteudo = readFileSync(caminho, 'utf8');
  } catch {
    // A mensagem nao repete o caminho: ele pode conter estrutura interna.
    throw new Error('BANCO_SSL_CA_ARQUIVO nao pode ser lido.');
  }

  if (!conteudo.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('BANCO_SSL_CA_ARQUIVO precisa apontar para um certificado PEM.');
  }
  return conteudo;
}

export function criarConfiguracaoSslPostgres(sslMode?: string | null): ConfiguracaoSslPostgres {
  const modo = normalizarModoSsl(sslMode);
  const bancoSsl = booleanoEstrito('BANCO_SSL');
  const exigeFalhaFechada = ambienteExigeFalhaFechada();
  const tlsRequerido = bancoSsl === true || (modo !== undefined && MODOS_SSL_EXIGEM_TLS.includes(modo));

  if (exigeFalhaFechada) {
    if (modo !== undefined && MODOS_SSL_PERMISSIVOS.includes(modo)) {
      throw new Error(
        `sslmode "${modo}" e permissivo e nao pode ser usado em ${obterAmbienteExecucao()}. Use require, verify-ca ou verify-full.`
      );
    }
    if (!tlsRequerido) {
      throw new Error(
        `TLS e obrigatorio em ${obterAmbienteExecucao()}. Defina BANCO_SSL=true ou sslmode=require na DATABASE_URL.`
      );
    }
  }

  if (!tlsRequerido) return false;

  const ca = obterCaConfiada();
  const servername = process.env.BANCO_SSL_SERVERNAME?.trim();

  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
    // O driver `pg` sobrescreve `servername` com o host da conexao sempre que
    // ele nao e um IP (`upgradeToSSL` em `pg/lib/connection.js`), entao passar
    // so `servername` seria um no-op silencioso atras de pooler ou proxy. O
    // nome declarado e fixado no `checkServerIdentity`, que o `pg` preserva, e
    // delega para a implementacao do proprio Node — nada de comparacao caseira.
    ...(servername
      ? {
          servername,
          checkServerIdentity: (_host: string, certificado: PeerCertificate) =>
            checkServerIdentity(servername, certificado)
        }
      : {})
  };
}
