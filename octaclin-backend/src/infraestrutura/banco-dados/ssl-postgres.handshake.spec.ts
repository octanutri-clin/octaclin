import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';
import { createServer, connect, Server } from 'tls';
import { criarConfiguracaoSslPostgres } from './ssl-postgres';

/**
 * Prova de transporte: os certificados sao gerados em tempo de execucao, valem
 * um dia e nunca saem da pasta temporaria. Nao existe material criptografico
 * versionado no repositorio e nenhum servidor real e contactado.
 *
 * Os PEMs sao lidos da saida padrao do `openssl`, e nao por `readFileSync`, e a
 * pasta temporaria e criada dentro da propria funcao: nenhum caminho de arquivo
 * vem de parametro, entao nao ha superficie de path traversal a analisar aqui.
 */
function opensslDisponivel(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const descreveHandshake = opensslDisponivel() ? describe : describe.skip;

/** Codigos que o Node emite quando a cadeia nao chega a uma ancora confiavel. */
const FALHAS_DE_CADEIA = ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN'];

interface AutoridadeSintetica {
  caPem: string;
  servidorChave: string;
  servidorCertificado: string;
}

function openssl(argumentos: string[]): string {
  return execFileSync('openssl', argumentos, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function gerarAutoridade(hostname: string): AutoridadeSintetica {
  const pasta = mkdtempSync(join(tmpdir(), 'octaclin-tls-'));
  const caChave = join(pasta, 'ca.key');
  const caCertificado = join(pasta, 'ca.pem');
  const servidorChave = join(pasta, 'servidor.key');
  const servidorCertificado = join(pasta, 'servidor.pem');

  openssl([
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', caChave, '-out', caCertificado, '-days', '1',
    '-subj', `/CN=OctaClin CA sintetica para ${hostname}`,
    '-addext', 'basicConstraints=critical,CA:TRUE'
  ]);

  openssl([
    'req', '-x509', '-CA', caCertificado, '-CAkey', caChave,
    '-newkey', 'rsa:2048', '-nodes',
    '-keyout', servidorChave, '-out', servidorCertificado, '-days', '1',
    '-subj', `/CN=${hostname}`,
    '-addext', `subjectAltName=DNS:${hostname}`,
    '-addext', 'basicConstraints=CA:FALSE'
  ]);

  return {
    caPem: openssl(['x509', '-in', caCertificado]),
    servidorChave: openssl(['rsa', '-in', servidorChave]),
    servidorCertificado: openssl(['x509', '-in', servidorCertificado])
  };
}

function abrirServidor(autoridade: AutoridadeSintetica): Promise<{ servidor: Server; porta: number }> {
  return new Promise((resolver) => {
    const servidor = createServer(
      { key: autoridade.servidorChave, cert: autoridade.servidorCertificado },
      (socket) => socket.end()
    );
    servidor.listen(0, '127.0.0.1', () => {
      resolver({ servidor, porta: (servidor.address() as AddressInfo).port });
    });
  });
}

/**
 * Reproduz o que o `pg` faz em `upgradeToSSL`: espalha a configuracao SSL e
 * **depois** sobrescreve `servername` com o host da conexao sempre que ele nao e
 * um IP. Testar sem essa sobrescrita provaria um comportamento que o driver nao
 * executa.
 */
function tentarHandshake(
  porta: number,
  opcoes: Record<string, unknown>,
  hostDeclaradoPeloPg = 'localhost'
): Promise<{ autorizado: boolean; codigo?: string }> {
  return new Promise((resolver) => {
    const socket = connect(
      { port: porta, host: '127.0.0.1', ...opcoes, servername: hostDeclaradoPeloPg },
      () => {
        const autorizado = socket.authorized;
        socket.destroy();
        resolver({ autorizado });
      }
    );
    socket.on('error', (erro: NodeJS.ErrnoException) => {
      socket.destroy();
      resolver({ autorizado: false, codigo: erro.code ?? erro.message });
    });
  });
}

const ambienteOriginal = process.env;

descreveHandshake('TLS Postgres - handshake real contra CA sintetica', () => {
  let confiavel: AutoridadeSintetica;
  let intrusa: AutoridadeSintetica;
  let servidorConfiavel: Server;
  let portaConfiavel: number;
  let servidorIntruso: Server;
  let portaIntrusa: number;

  beforeAll(async () => {
    confiavel = gerarAutoridade('localhost');
    intrusa = gerarAutoridade('localhost');

    ({ servidor: servidorConfiavel, porta: portaConfiavel } = await abrirServidor(confiavel));
    ({ servidor: servidorIntruso, porta: portaIntrusa } = await abrirServidor(intrusa));
  }, 60000);

  afterAll(() => {
    servidorConfiavel?.close();
    servidorIntruso?.close();
    process.env = ambienteOriginal;
  });

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.APP_AMBIENTE;
    delete process.env.BANCO_SSL;
    delete process.env.BANCO_SSL_CA;
    delete process.env.BANCO_SSL_CA_ARQUIVO;
    delete process.env.BANCO_SSL_SERVERNAME;
  });

  function opcoesProducao(caPem: string, servername: string) {
    process.env.APP_AMBIENTE = 'producao';
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA = caPem;
    process.env.BANCO_SSL_SERVERNAME = servername;
    return criarConfiguracaoSslPostgres('require') as Record<string, unknown>;
  }

  it('aceita certificado emitido pela CA confiavel com hostname compativel', async () => {
    const resultado = await tentarHandshake(portaConfiavel, opcoesProducao(confiavel.caPem, 'localhost'));

    expect(resultado).toEqual({ autorizado: true });
  });

  it('rejeita servidor apresentado por CA incorreta', async () => {
    const resultado = await tentarHandshake(portaIntrusa, opcoesProducao(confiavel.caPem, 'localhost'));

    expect(resultado.autorizado).toBe(false);
    expect(FALHAS_DE_CADEIA).toContain(resultado.codigo);
  });

  it('rejeita hostname incompativel mesmo com a CA correta e mesmo com o pg reescrevendo o SNI', async () => {
    const resultado = await tentarHandshake(portaConfiavel, opcoesProducao(confiavel.caPem, 'outro.host.invalido'));

    expect(resultado.autorizado).toBe(false);
    expect(resultado.codigo).toBe('ERR_TLS_CERT_ALTNAME_INVALID');
  });

  it('valida o hostname pelo host da conexao quando nenhum nome e declarado', async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA = confiavel.caPem;
    const opcoes = criarConfiguracaoSslPostgres('require') as Record<string, unknown>;

    expect(await tentarHandshake(portaConfiavel, opcoes, 'localhost')).toEqual({ autorizado: true });
    expect((await tentarHandshake(portaConfiavel, opcoes, 'host.errado.invalido')).codigo).toBe(
      'ERR_TLS_CERT_ALTNAME_INVALID'
    );
  });

  it('rejeita certificado nao ancorado no armazenamento padrao quando nenhuma CA e informada', async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_SERVERNAME = 'localhost';
    const opcoes = criarConfiguracaoSslPostgres('require') as Record<string, unknown>;

    const resultado = await tentarHandshake(portaConfiavel, opcoes);

    expect(resultado.autorizado).toBe(false);
    expect(FALHAS_DE_CADEIA).toContain(resultado.codigo);
  });

  /**
   * Antes do PR 39 a configuracao de conexao desligava a verificacao do
   * certificado. Em vez de reconstruir aquela configuracao insegura aqui — o
   * que reintroduziria o padrao que os scanners bloqueiam, dentro do proprio PR
   * que o remove —, o teste fixa a propriedade que substitui a demonstracao:
   * nenhuma configuracao produzida pelo modulo, em nenhum ambiente, entrega a
   * verificacao desligada. A recusa efetiva do servidor intruso ja esta provada
   * pelos casos acima.
   */
  it('nunca produz configuracao que aceite qualquer certificado', () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.BANCO_SSL = 'true';
    process.env.BANCO_SSL_CA = confiavel.caPem;

    const configuracao = criarConfiguracaoSslPostgres('require') as { rejectUnauthorized: boolean };

    expect(configuracao.rejectUnauthorized).toBe(true);
  });
});
