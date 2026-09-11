import { createServer, Server, Socket } from 'net';
import { MecanismoClamAv } from './mecanismo-clamav';

/**
 * Servidor TCP minimo que imita o suficiente do protocolo clamd para exercer
 * `MecanismoClamAv` de ponta a ponta: nao valida os pedacos do INSTREAM (o
 * cliente ja e testado quanto a forma que envia), so decide quando a
 * transmissao terminou -- os 4 bytes zero finais do INSTREAM -- e entao
 * responde ou se comporta como configurado para o cenario testado.
 */
const conexoesAbertas = new WeakMap<Server, Set<Socket>>();

function iniciarServidorMock(comportamento: {
  resposta?: string;
  atrasoRespostaMs?: number;
  encerrarSemResponder?: boolean;
  ignorarConexao?: boolean;
}): Promise<Server> {
  return new Promise((resolve, reject) => {
    const servidor = createServer((socket) => {
      conexoesAbertas.get(servidor)?.add(socket);
      socket.once('close', () => conexoesAbertas.get(servidor)?.delete(socket));

      if (comportamento.ignorarConexao) return;

      let buffer = Buffer.alloc(0);
      socket.on('data', (pedaco: Buffer) => {
        buffer = Buffer.concat([buffer, pedaco]);

        if (buffer.subarray(0, 6).toString('utf8') === 'zPING\0') {
          socket.write('PONG');
          socket.end();
          return;
        }

        const pedacoZeroFinal = buffer.length >= 4 && buffer.subarray(buffer.length - 4).equals(Buffer.alloc(4));
        if (!pedacoZeroFinal) return;

        if (comportamento.encerrarSemResponder) {
          socket.end();
          return;
        }

        setTimeout(() => {
          socket.write(comportamento.resposta ?? 'stream: OK');
          socket.end();
        }, comportamento.atrasoRespostaMs ?? 0);
      });
    });

    conexoesAbertas.set(servidor, new Set());
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => resolve(servidor));
  });
}

function porta(servidor: Server): number {
  const endereco = servidor.address();
  if (endereco === null || typeof endereco === 'string') throw new Error('endereco de teste invalido');
  return endereco.port;
}

function fechar(servidor: Server): Promise<void> {
  return new Promise((resolve) => {
    for (const socket of conexoesAbertas.get(servidor) ?? []) socket.destroy();
    servidor.close(() => resolve());
  });
}

describe('MecanismoClamAv', () => {
  let servidor: Server | undefined;

  afterEach(async () => {
    if (servidor) await fechar(servidor);
    servidor = undefined;
  });

  it('retorna limpo quando o daemon responde stream: OK', async () => {
    servidor = await iniciarServidorMock({ resposta: 'stream: OK' });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 1000);

    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico sem payload'))).resolves.toBe('limpo');
  });

  it('retorna infectado quando o daemon responde FOUND', async () => {
    servidor = await iniciarServidorMock({ resposta: 'stream: Eicar-Signature FOUND' });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 1000);

    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico'))).resolves.toBe('infectado');
  });

  it('lanca erro quando a resposta do daemon nao e reconhecida', async () => {
    servidor = await iniciarServidorMock({ resposta: 'stream: ERROR inesperado' });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 1000);

    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico'))).rejects.toThrow('Resposta inesperada do ClamAV.');
  });

  it('lanca erro quando o daemon fecha a conexao sem responder', async () => {
    servidor = await iniciarServidorMock({ encerrarSemResponder: true });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 1000);

    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico'))).rejects.toThrow('Resposta inesperada do ClamAV.');
  });

  it('lanca erro por timeout quando o daemon nao responde a tempo', async () => {
    servidor = await iniciarServidorMock({ atrasoRespostaMs: 500 });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 30);

    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico'))).rejects.toThrow('Timeout aguardando resposta do ClamAV.');
  });

  it('lanca erro quando a conexao e recusada (daemon fora do ar)', async () => {
    servidor = await iniciarServidorMock({ resposta: 'stream: OK' });
    const portaFechada = porta(servidor);
    await fechar(servidor);
    servidor = undefined;

    const mecanismo = new MecanismoClamAv('127.0.0.1', portaFechada, 1000);
    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico'))).rejects.toThrow();
  });

  it('lanca erro de timeout quando o daemon aceita a conexao mas nunca responde', async () => {
    servidor = await iniciarServidorMock({ ignorarConexao: true });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 30);

    await expect(mecanismo.escanear(Buffer.from('conteudo sintetico'))).rejects.toThrow('Timeout aguardando resposta do ClamAV.');
  });

  it('divide conteudo maior que o pedaco maximo em varios pedacos e ainda assim escaneia', async () => {
    servidor = await iniciarServidorMock({ resposta: 'stream: OK' });
    const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 2000);
    const conteudoGrande = Buffer.alloc(64 * 1024 + 100, 0x41);

    await expect(mecanismo.escanear(conteudoGrande)).resolves.toBe('limpo');
  });

  describe('ping', () => {
    it('retorna verdadeiro quando o daemon responde PONG', async () => {
      servidor = await iniciarServidorMock({});
      const mecanismo = new MecanismoClamAv('127.0.0.1', porta(servidor), 1000);

      await expect(mecanismo.ping()).resolves.toBe(true);
    });

    it('rejeita quando a conexao e recusada', async () => {
      servidor = await iniciarServidorMock({});
      const portaFechada = porta(servidor);
      await fechar(servidor);
      servidor = undefined;

      const mecanismo = new MecanismoClamAv('127.0.0.1', portaFechada, 1000);
      await expect(mecanismo.ping()).rejects.toThrow();
    });
  });
});
