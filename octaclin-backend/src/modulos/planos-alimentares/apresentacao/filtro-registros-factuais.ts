import { ArgumentsHost,Catch,HttpException,type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AnaliseFactualInvalidaError } from '../aplicacao/construtor-analise-factual';
import { ComparacaoVersoesInvalidaError } from '../dominio/comparacao-versoes-factuais';
import { LimitePrecisaoNutricionalError } from '../dominio/micronutrientes';
const MENSAGENS:Record<number,string>={400:'Solicitação inválida.',401:'Sessão necessária.',403:'Operação não autorizada.',404:'Registro ou origem indisponível.',409:'Dados alterados. Confira novamente antes de confirmar.',413:'Solicitação acima do limite.',422:'Dados indisponíveis para esta análise.',429:'Muitas solicitações. Tente novamente em instantes.',500:'Não foi possível concluir a operação.',503:'Serviço temporariamente indisponível.'};
/** Não propaga body/SQL/valores dos erros nem mensagens de validação com campos livres. */
@Catch()
export class FiltroRegistrosFactuais implements ExceptionFilter {
 catch(erro:unknown,host:ArgumentsHost){
  const solicitado=erro instanceof HttpException?erro.getStatus():erro instanceof AnaliseFactualInvalidaError||erro instanceof ComparacaoVersoesInvalidaError||erro instanceof LimitePrecisaoNutricionalError?422:500;
  const status=Object.hasOwn(MENSAGENS,solicitado)?solicitado:500;
  host.switchToHttp().getResponse<Response>().setHeader('Cache-Control','private, no-store').status(status).json({statusCode:status,message:MENSAGENS[status]});
 }
}
