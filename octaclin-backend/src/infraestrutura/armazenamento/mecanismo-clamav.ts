import { Socket } from 'net';
import type { MecanismoAntimalware, ResultadoEscaneamento } from './servico-antimalware';

/**
 * Cliente nativo do protocolo `INSTREAM`/`PING` do clamd (daemon do ClamAV),
 * sobre `net.Socket` puro -- sem dependencia nova. O protocolo e simples o
 * bastante (poucas dezenas de linhas) e e a superficie que decide se um
 * upload clinico e liberado; preferir uma lib de terceiro aqui trocaria
 * "poucas linhas revisaveis" por "confiar num pacote npm com esse poder",
 * o oposto do que `docs/agents/EXTERNAL_CODE_POLICY.md` pede.
 *
 * Contrato do protocolo (documentado pelo proprio ClamAV):
 * - Comando com prefixo `z` e terminado em NUL, ex.: `zINSTREAM\0`.
 * - INSTREAM: apos o comando, o corpo vai em pedaços prefixados por um
 *   tamanho de 4 bytes big-endian; um pedaço de tamanho zero encerra o
 *   envio. O daemon responde uma linha (`stream: OK` ou
 *   `stream: <assinatura> FOUND`) e fecha a conexao.
 * - PING: comando `zPING\0`, resposta `PONG`.
 */
const TAMANHO_MAXIMO_PEDACO = 64 * 1024;

function lerRespostaAteFim(socket: Socket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let coletado = Buffer.alloc(0);
    let finalizado = false;

    const temporizador = setTimeout(() => {
      finalizar(() => reject(new Error('Timeout aguardando resposta do ClamAV.')));
    }, timeoutMs);

    function finalizar(acao: () => void) {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      socket.removeListener('data', aoReceberDados);
      socket.removeListener('error', aoErro);
      socket.removeListener('end', aoFim);
      socket.removeListener('close', aoFim);
      acao();
    }

    function textoColetado(): string {
      return coletado.toString('utf8').replace(/\0/g, '').trim();
    }

    function aoReceberDados(pedaco: Buffer) {
      coletado = Buffer.concat([coletado, pedaco]);
      if (coletado.includes(0)) finalizar(() => resolve(textoColetado()));
    }

    function aoFim() {
      finalizar(() => resolve(textoColetado()));
    }

    function aoErro(erro: Error) {
      finalizar(() => reject(erro));
    }

    socket.on('data', aoReceberDados);
    socket.once('error', aoErro);
    socket.once('end', aoFim);
    socket.once('close', aoFim);
  });
}

function conectar(host: string, porta: number, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let finalizado = false;

    const temporizador = setTimeout(() => {
      if (finalizado) return;
      finalizado = true;
      socket.destroy();
      reject(new Error('Timeout ao conectar ao ClamAV.'));
    }, timeoutMs);

    socket.once('error', (erro) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      reject(erro);
    });

    socket.connect(porta, host, () => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      resolve(socket);
    });
  });
}

export class MecanismoClamAv implements MecanismoAntimalware {
  constructor(
    private readonly host: string,
    private readonly porta: number,
    private readonly timeoutMs: number
  ) {}

  async escanear(conteudo: Buffer): Promise<ResultadoEscaneamento> {
    const socket = await conectar(this.host, this.porta, this.timeoutMs);
    try {
      const respostaPromessa = lerRespostaAteFim(socket, this.timeoutMs);
      socket.write('zINSTREAM\0');
      for (let inicio = 0; inicio < conteudo.length; inicio += TAMANHO_MAXIMO_PEDACO) {
        const pedaco = conteudo.subarray(inicio, inicio + TAMANHO_MAXIMO_PEDACO);
        const cabecalho = Buffer.alloc(4);
        cabecalho.writeUInt32BE(pedaco.length, 0);
        socket.write(cabecalho);
        socket.write(pedaco);
      }
      socket.write(Buffer.alloc(4)); // pedaço de tamanho zero encerra o stream

      const resposta = await respostaPromessa;
      return this.interpretarRespostaEscaneamento(resposta);
    } finally {
      socket.destroy();
    }
  }

  /** Usado pelo healthcheck (`ServicoSaude`) -- nunca pelo caminho de decisao de upload. */
  async ping(): Promise<boolean> {
    const socket = await conectar(this.host, this.porta, this.timeoutMs);
    try {
      const respostaPromessa = lerRespostaAteFim(socket, this.timeoutMs);
      socket.write('zPING\0');
      const resposta = await respostaPromessa;
      return resposta === 'PONG';
    } finally {
      socket.destroy();
    }
  }

  /**
   * So dois desfechos validos: `stream: OK` e `stream: ... FOUND`. Qualquer
   * outra coisa -- protocolo mudou, corpo truncado, erro do daemon -- lanca,
   * e quem chama (`ServicoAntimalware.garantirConteudoLimpo`) ja trata
   * excecao como rejeicao. Nunca existe uma terceira leitura que libere por
   * omissao.
   */
  private interpretarRespostaEscaneamento(resposta: string): ResultadoEscaneamento {
    if (/\bOK$/.test(resposta)) return 'limpo';
    if (/FOUND$/.test(resposta)) return 'infectado';
    throw new Error('Resposta inesperada do ClamAV.');
  }
}
