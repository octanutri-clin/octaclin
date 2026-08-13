import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

const LIMITE_ROTAS = 100;
const LIMITE_TRACES = 30;
const LIMITE_AMOSTRAS_DURACAO = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_LONGO = /^[A-Za-z0-9_-]{24,}$/;

export interface EventoTelemetriaHttp {
  requestId: string;
  metodo: string;
  rota: string;
  statusCode: number;
  duracaoMs: number;
  erroNome?: string;
}

interface AgregadoRota {
  metodo: string;
  rota: string;
  total: number;
  errosServidor: number;
  duracaoTotalMs: number;
  duracaoMaximaMs: number;
}

export interface SnapshotTelemetriaOperacional {
  processo: {
    iniciadoEm: string;
    uptimeSegundos: number;
  };
  http: {
    total: number;
    sucesso: number;
    errosCliente: number;
    errosServidor: number;
    taxaErro5xx: number;
    duracaoMediaMs: number;
    duracaoP95Ms: number;
    amostrasDuracao: number;
    porRota: Array<{
      metodo: string;
      rota: string;
      total: number;
      errosServidor: number;
      duracaoMediaMs: number;
      duracaoMaximaMs: number;
    }>;
  };
  tracesRecentes: Array<{
    requestId: string;
    horario: string;
    metodo: string;
    rota: string;
    statusCode: number;
    duracaoMs: number;
    resultado: 'sucesso' | 'erro_cliente' | 'erro_servidor';
    erroNome?: string;
  }>;
}

export function normalizarRotaTelemetria(valor: string): string {
  const caminho = (valor.split('?')[0] || '/').slice(0, 500);
  const segmentos = caminho.split('/').map((segmento) => {
    if (!segmento) return segmento;
    let decodificado = segmento;
    try {
      decodificado = decodeURIComponent(segmento);
    } catch {
      return ':valor';
    }
    if (UUID.test(decodificado) || /^\d+$/.test(decodificado)) return ':id';
    if (decodificado.includes('@') || TOKEN_LONGO.test(decodificado)) return ':valor';
    if (/^(?:eyJ|Bearer|token[._-])/i.test(decodificado)) return ':valor';
    return decodificado.replace(/[^A-Za-z0-9._~-]/g, '_').slice(0, 80) || ':valor';
  });
  const normalizada = segmentos.join('/') || '/';
  return normalizada.startsWith('/') ? normalizada : `/${normalizada}`;
}

export function gerarReferenciaRequestId(requestId: string): string {
  return `req_${createHash('sha256').update(requestId).digest('hex').slice(0, 12)}`;
}

@Injectable()
export class ServicoTelemetriaOperacional {
  private readonly iniciadoEm = new Date();
  private readonly rotas = new Map<string, AgregadoRota>();
  private readonly traces: SnapshotTelemetriaOperacional['tracesRecentes'] = [];
  private readonly duracoes: number[] = [];
  private total = 0;
  private sucesso = 0;
  private errosCliente = 0;
  private errosServidor = 0;
  private duracaoTotalMs = 0;

  registrar(evento: EventoTelemetriaHttp): void {
    const rota = normalizarRotaTelemetria(evento.rota);
    const metodo = evento.metodo.toUpperCase().slice(0, 12);
    const statusCode = Number.isInteger(evento.statusCode) ? evento.statusCode : 500;
    const duracaoMs = Math.max(0, Math.round(evento.duracaoMs));
    const resultado = statusCode >= 500 ? 'erro_servidor' : statusCode >= 400 ? 'erro_cliente' : 'sucesso';

    this.total += 1;
    this.duracaoTotalMs += duracaoMs;
    if (resultado === 'erro_servidor') this.errosServidor += 1;
    else if (resultado === 'erro_cliente') this.errosCliente += 1;
    else this.sucesso += 1;

    this.duracoes.push(duracaoMs);
    if (this.duracoes.length > LIMITE_AMOSTRAS_DURACAO) this.duracoes.shift();

    let chave = `${metodo} ${rota}`;
    if (!this.rotas.has(chave) && this.rotas.size >= LIMITE_ROTAS) chave = `${metodo} /:outras`;
    const agregado = this.rotas.get(chave) ?? {
      metodo,
      rota: chave.endsWith('/:outras') ? '/:outras' : rota,
      total: 0,
      errosServidor: 0,
      duracaoTotalMs: 0,
      duracaoMaximaMs: 0
    };
    agregado.total += 1;
    agregado.duracaoTotalMs += duracaoMs;
    agregado.duracaoMaximaMs = Math.max(agregado.duracaoMaximaMs, duracaoMs);
    if (resultado === 'erro_servidor') agregado.errosServidor += 1;
    this.rotas.set(chave, agregado);

    this.traces.unshift({
      requestId: gerarReferenciaRequestId(evento.requestId),
      horario: new Date().toISOString(),
      metodo,
      rota,
      statusCode,
      duracaoMs,
      resultado,
      ...(evento.erroNome ? { erroNome: evento.erroNome.slice(0, 80) } : {})
    });
    if (this.traces.length > LIMITE_TRACES) this.traces.length = LIMITE_TRACES;
  }

  obterSnapshot(): SnapshotTelemetriaOperacional {
    const duracoesOrdenadas = [...this.duracoes].sort((a, b) => a - b);
    const indiceP95 = duracoesOrdenadas.length ? Math.ceil(duracoesOrdenadas.length * 0.95) - 1 : 0;
    const porRota = [...this.rotas.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 25)
      .map((item) => ({
        metodo: item.metodo,
        rota: item.rota,
        total: item.total,
        errosServidor: item.errosServidor,
        duracaoMediaMs: item.total ? Math.round(item.duracaoTotalMs / item.total) : 0,
        duracaoMaximaMs: item.duracaoMaximaMs
      }));

    return {
      processo: {
        iniciadoEm: this.iniciadoEm.toISOString(),
        uptimeSegundos: Math.round(process.uptime())
      },
      http: {
        total: this.total,
        sucesso: this.sucesso,
        errosCliente: this.errosCliente,
        errosServidor: this.errosServidor,
        taxaErro5xx: this.total ? Number((this.errosServidor / this.total).toFixed(4)) : 0,
        duracaoMediaMs: this.total ? Math.round(this.duracaoTotalMs / this.total) : 0,
        duracaoP95Ms: duracoesOrdenadas[indiceP95] ?? 0,
        amostrasDuracao: this.duracoes.length,
        porRota
      },
      tracesRecentes: this.traces.map((trace) => ({ ...trace }))
    };
  }
}
