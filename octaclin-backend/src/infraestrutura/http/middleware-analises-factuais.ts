import type { ErrorRequestHandler,RequestHandler,Response } from 'express';
export const LIMITE_CORPO_ANALISES_FACTUAIS=16*1024;
const protegido=(path:string)=>/^\/pacientes\/[^/]+\/planos-alimentares\/analises-factuais(?:\/|$)/i.test(path);
const rejeitar=(res:Response,status:400|413|503)=>res.status(status).json({statusCode:status,message:status===413?'Solicitação acima do limite.':status===503?'Serviço temporariamente indisponível.':'Solicitação inválida.'});
/** Antes do parser global já existente: também protege erros de parsing/guardas. */
export const middlewareAnalisesFactuais:RequestHandler=(req,res,next)=>{
 if(!protegido(req.path))return next();
 res.setHeader('Cache-Control','private, no-store');
 const declarado=Number(req.headers['content-length']);
 if(Number.isFinite(declarado)&&declarado>LIMITE_CORPO_ANALISES_FACTUAIS){rejeitar(res,413);return;}
 next();
};
/** Depois do parser global rawBody: preserva o limite100KiB das demais rotas. */
export const middlewareLimiteAnalisesFactuais:RequestHandler=(req,res,next)=>{
 if(!protegido(req.path))return next();
 const raw=(req as typeof req&{rawBody?:Buffer}).rawBody;
 if(raw&&raw.length>LIMITE_CORPO_ANALISES_FACTUAIS){rejeitar(res,413);return;}
 if(req.body!==undefined&&!Buffer.isBuffer(raw)){rejeitar(res,503);return;}
 next();
};
/** Erros do parser não devem refletir fragmentos de JSON clínico. Demais rotas intactas. */
export const middlewareErroAnalisesFactuais:ErrorRequestHandler=(erro,req,res,next)=>{
 if(!protegido(req.path))return next(erro);
 rejeitar(res,(erro as {status?:number})?.status===413?413:400);
};
