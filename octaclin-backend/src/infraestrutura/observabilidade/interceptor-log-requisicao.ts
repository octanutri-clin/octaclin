import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { obterContextoCorrelacao, RequisicaoComContexto } from './contexto-requisicao';
import { gerarReferenciaRequestId, ServicoTelemetriaOperacional } from './servico-telemetria-operacional';

interface RespostaHttp {
  statusCode?: number;
}

@Injectable()
export class InterceptorLogRequisicao implements NestInterceptor {
  private readonly logger = new Logger(InterceptorLogRequisicao.name);

  constructor(private readonly telemetria?: ServicoTelemetriaOperacional) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const inicio = Date.now();
    const http = contexto.switchToHttp();
    const requisicao = http.getRequest<RequisicaoComContexto>();
    const resposta = http.getResponse<RespostaHttp>();

    return proximo.handle().pipe(
      tap(() => {
        const evento = this.montarEvento('http.request', requisicao, resposta, inicio);
        this.logger.log(evento);
        this.registrarTelemetria(evento);
      }),
      catchError((erro: unknown) => {
        const evento = {
          ...this.montarEvento('http.request.erro', requisicao, resposta, inicio, this.statusErro(erro)),
          erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido'
        };
        this.logger.warn(evento);
        this.registrarTelemetria(evento);
        return throwError(() => erro);
      })
    );
  }

  private montarEvento(
    evento: 'http.request' | 'http.request.erro',
    requisicao: RequisicaoComContexto,
    resposta: RespostaHttp,
    inicio: number,
    statusCode = resposta.statusCode
  ): Record<string, string | number | undefined> {
    const contexto = obterContextoCorrelacao(requisicao);
    requisicao.correlacao = contexto;

    return {
      evento,
      requestId: contexto.requestId,
      requestRef: gerarReferenciaRequestId(contexto.requestId),
      tenantId: contexto.tenantId,
      usuarioId: contexto.usuarioId,
      metodo: contexto.metodo,
      rota: contexto.rota,
      statusCode,
      duracaoMs: Date.now() - inicio
    };
  }

  private statusErro(erro: unknown): number {
    return erro instanceof HttpException ? erro.getStatus() : 500;
  }

  private registrarTelemetria(evento: Record<string, string | number | undefined>): void {
    if (!this.telemetria) return;
    this.telemetria.registrar({
      requestId: String(evento.requestId ?? 'sem-request-id'),
      metodo: String(evento.metodo ?? 'UNKNOWN'),
      rota: String(evento.rota ?? '/desconhecida'),
      statusCode: Number(evento.statusCode ?? 500),
      duracaoMs: Number(evento.duracaoMs ?? 0),
      ...(evento.erroNome ? { erroNome: String(evento.erroNome) } : {})
    });
  }
}
