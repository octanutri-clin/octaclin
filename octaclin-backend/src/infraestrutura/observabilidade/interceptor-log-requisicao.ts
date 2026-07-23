import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { obterContextoCorrelacao, RequisicaoComContexto } from './contexto-requisicao';

interface RespostaHttp {
  statusCode?: number;
}

@Injectable()
export class InterceptorLogRequisicao implements NestInterceptor {
  private readonly logger = new Logger(InterceptorLogRequisicao.name);

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const inicio = Date.now();
    const http = contexto.switchToHttp();
    const requisicao = http.getRequest<RequisicaoComContexto>();
    const resposta = http.getResponse<RespostaHttp>();

    return proximo.handle().pipe(
      tap(() => {
        this.logger.log(this.montarEvento('http.request', requisicao, resposta, inicio));
      }),
      catchError((erro: unknown) => {
        this.logger.warn({
          ...this.montarEvento('http.request.erro', requisicao, resposta, inicio),
          erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido'
        });
        return throwError(() => erro);
      })
    );
  }

  private montarEvento(
    evento: 'http.request' | 'http.request.erro',
    requisicao: RequisicaoComContexto,
    resposta: RespostaHttp,
    inicio: number
  ): Record<string, string | number | undefined> {
    const contexto = obterContextoCorrelacao(requisicao);
    requisicao.correlacao = contexto;

    return {
      evento,
      requestId: contexto.requestId,
      tenantId: contexto.tenantId,
      usuarioId: contexto.usuarioId,
      metodo: contexto.metodo,
      rota: contexto.rota,
      statusCode: resposta.statusCode,
      duracaoMs: Date.now() - inicio
    };
  }
}
