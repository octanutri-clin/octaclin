import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, obterSessaoValidaBff,
  requisitarBackendAutenticado
} from './sessao-bff';
import { origemMutacaoPermitida } from './seguranca-bff';

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RecordInput = Record<string, unknown>;
export type PilotoProjection = 'page-achievements'|'page-circles'|'page-feed'|'page-likes'|'page-privacy'|'page-reports'|'invite'|'mutation';
interface Operation { portal: boolean; method: 'GET'|'POST'|'PATCH'; projection: PilotoProjection; keys: string[]; required: string[]; path: (body: RecordInput) => string | null }

const p = (v: unknown) => typeof v === 'string' && UUID.test(v) ? encodeURIComponent(v) : null;
const cursor = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1024 ? `?cursor=${encodeURIComponent(v)}` : '';
const noCursor = (body: RecordInput) => body.cursor === undefined || (typeof body.cursor === 'string' && body.cursor.length > 0 && body.cursor.length <= 1024);
const cmd = ['acao','chave','versaoEsperada'];
const op = (portal: boolean, method: Operation['method'], projection: PilotoProjection, keys: string[], required: string[], path: Operation['path']): Operation => ({portal,method,projection,keys,required,path});

const operations: Record<string, Operation> = {
  'console-conquistas': op(false,'GET','page-achievements',['acao','pacienteId','cursor'],['acao','pacienteId'],b=>{const id=p(b.pacienteId);return id&&noCursor(b)?`/gamificacao/piloto/pacientes/${id}/conquistas${cursor(b.cursor)}`:null}),
  'console-circulos': op(false,'GET','page-circles',['acao','cursor'],['acao'],b=>noCursor(b)?`/gamificacao/piloto/circulos${cursor(b.cursor)}`:null),
  'console-convite': op(false,'GET','invite',['acao','circuloId','pacienteId'],['acao','circuloId','pacienteId'],b=>{const c=p(b.circuloId),pac=p(b.pacienteId);return c&&pac?`/gamificacao/piloto/circulos/${c}/convites/${pac}`:null}),
  'console-feed': op(false,'GET','page-feed',['acao','circuloId','cursor'],['acao','circuloId'],b=>{const c=p(b.circuloId);return c&&noCursor(b)?`/gamificacao/piloto/circulos/${c}/publicacoes${cursor(b.cursor)}`:null}),
  'console-comentarios': op(false,'GET','page-feed',['acao','circuloId','postId','cursor'],['acao','circuloId','postId'],b=>{const c=p(b.circuloId),post=p(b.postId);return c&&post&&noCursor(b)?`/gamificacao/piloto/circulos/${c}/publicacoes/${post}/comentarios${cursor(b.cursor)}`:null}),
  'console-curtidas': op(false,'GET','page-likes',['acao','circuloId','postId','comentarioId','cursor'],['acao','circuloId','postId'],b=>{const c=p(b.circuloId),post=p(b.postId),comment=b.comentarioId===undefined?null:p(b.comentarioId);return c&&post&&(b.comentarioId===undefined||comment)&&noCursor(b)?`/gamificacao/piloto/circulos/${c}/publicacoes/${post}${comment?`/comentarios/${comment}`:''}/curtidas${cursor(b.cursor)}`:null}),
  'console-denuncias': op(false,'GET','page-reports',['acao','circuloId','cursor'],['acao','circuloId'],b=>{const c=p(b.circuloId);return c&&noCursor(b)?`/gamificacao/piloto/circulos/${c}/denuncias${cursor(b.cursor)}`:null}),
  'console-retirar-post': op(false,'POST','mutation',[...cmd,'circuloId','postId'],[...cmd,'circuloId','postId'],b=>{const c=p(b.circuloId),post=p(b.postId);return c&&post?`/gamificacao/piloto/circulos/${c}/publicacoes/${post}/retirada`:null}),
  'console-retirar-comentario': op(false,'POST','mutation',[...cmd,'circuloId','postId','comentarioId'],[...cmd,'circuloId','postId','comentarioId'],b=>{const c=p(b.circuloId),post=p(b.postId),m=p(b.comentarioId);return c&&post&&m?`/gamificacao/piloto/circulos/${c}/publicacoes/${post}/comentarios/${m}/retirada`:null}),
  'portal-conquistas': op(true,'GET','page-achievements',['acao','cursor'],['acao'],b=>noCursor(b)?`/portal/paciente/gamificacao-piloto/conquistas${cursor(b.cursor)}`:null),
  'portal-circulos': op(true,'GET','page-circles',['acao','cursor'],['acao'],b=>noCursor(b)?`/portal/paciente/gamificacao-piloto/circulos${cursor(b.cursor)}`:null),
  'portal-privacidade-conquistas': op(true,'GET','page-privacy',['acao','cursor'],['acao'],b=>noCursor(b)?`/portal/paciente/gamificacao-piloto/privacidade/conquistas${cursor(b.cursor)}`:null),
  'portal-privacidade-circulos': op(true,'GET','page-privacy',['acao','cursor'],['acao'],b=>noCursor(b)?`/portal/paciente/gamificacao-piloto/privacidade/circulos${cursor(b.cursor)}`:null),
  'portal-feed': op(true,'GET','page-feed',['acao','circuloId','cursor'],['acao','circuloId'],b=>{const c=p(b.circuloId);return c&&noCursor(b)?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes${cursor(b.cursor)}`:null}),
  'portal-comentarios': op(true,'GET','page-feed',['acao','circuloId','postId','cursor'],['acao','circuloId','postId'],b=>{const c=p(b.circuloId),post=p(b.postId);return c&&post&&noCursor(b)?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}/comentarios${cursor(b.cursor)}`:null}),
  'portal-curtidas': op(true,'GET','page-likes',['acao','circuloId','postId','comentarioId','cursor'],['acao','circuloId','postId'],b=>{const c=p(b.circuloId),post=p(b.postId),comment=b.comentarioId===undefined?null:p(b.comentarioId);return c&&post&&(b.comentarioId===undefined||comment)&&noCursor(b)?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}${comment?`/comentarios/${comment}`:''}/curtidas${cursor(b.cursor)}`:null}),
  'conceder-conquista': op(false,'POST','mutation',[...cmd,'pacienteId','titulo','descricao','icone'],[...cmd,'pacienteId','titulo','icone'],b=>{const id=p(b.pacienteId);return id?`/gamificacao/piloto/pacientes/${id}/conquistas`:null}),
  'compartilhar-conquista': op(false,'PATCH','mutation',[...cmd,'pacienteId','conquistaId','compartilhado'],[...cmd,'pacienteId','conquistaId','compartilhado'],b=>{const id=p(b.pacienteId),c=p(b.conquistaId);return id&&c?`/gamificacao/piloto/pacientes/${id}/conquistas/${c}/compartilhamento`:null}),
  'criar-circulo': op(false,'POST','mutation',[...cmd,'nome','objetivo'],[...cmd,'nome','objetivo'],()=>'/gamificacao/piloto/circulos'),
  'convidar': op(false,'POST','mutation',[...cmd,'circuloId','pacienteId'],[...cmd,'circuloId','pacienteId'],b=>{const c=p(b.circuloId),id=p(b.pacienteId);return c&&id?`/gamificacao/piloto/circulos/${c}/convites/${id}`:null}),
  'revogar-convite': op(false,'POST','mutation',[...cmd,'circuloId','pacienteId'],[...cmd,'circuloId','pacienteId'],b=>{const c=p(b.circuloId),id=p(b.pacienteId);return c&&id?`/gamificacao/piloto/circulos/${c}/convites/${id}/revogacao`:null}),
  'encerrar-circulo': op(false,'POST','mutation',[...cmd,'circuloId'],[...cmd,'circuloId'],b=>{const c=p(b.circuloId);return c?`/gamificacao/piloto/circulos/${c}/encerramento`:null}),
  'decidir-denuncia': op(false,'POST','mutation',[...cmd,'circuloId','denunciaId','retirar','justificativa'],[...cmd,'circuloId','denunciaId','retirar','justificativa'],b=>{const c=p(b.circuloId),d=p(b.denunciaId);return c&&d?`/gamificacao/piloto/circulos/${c}/denuncias/${d}/decisao`:null}),
  'consentir-conquista': op(true,'POST','mutation',[...cmd,'conquistaId','aceitar','geracao','termoVersao'],[...cmd,'conquistaId','aceitar','geracao','termoVersao'],b=>{const c=p(b.conquistaId);return c?`/portal/paciente/gamificacao-piloto/conquistas/${c}/consentimento`:null}),
  'aceitar-circulo': op(true,'POST','mutation',[...cmd,'circuloId','geracao','termoVersao','nomeExibicao'],[...cmd,'circuloId','geracao','termoVersao','nomeExibicao'],b=>{const c=p(b.circuloId);return c?`/portal/paciente/gamificacao-piloto/circulos/${c}/aceite`:null}),
  'sair-circulo': op(true,'POST','mutation',[...cmd,'circuloId'],[...cmd,'circuloId'],b=>{const c=p(b.circuloId);return c?`/portal/paciente/gamificacao-piloto/circulos/${c}/saida`:null}),
  'publicar': op(true,'POST','mutation',[...cmd,'circuloId','texto'],[...cmd,'circuloId','texto'],b=>{const c=p(b.circuloId);return c?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes`:null}),
  'comentar': op(true,'POST','mutation',[...cmd,'circuloId','postId','texto'],[...cmd,'circuloId','postId','texto'],b=>{const c=p(b.circuloId),post=p(b.postId);return c&&post?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}/comentarios`:null}),
  'curtir': op(true,'POST','mutation',[...cmd,'circuloId','postId','comentarioId','curti'],[...cmd,'circuloId','postId','curti'],b=>{const c=p(b.circuloId),post=p(b.postId),m=b.comentarioId===undefined?null:p(b.comentarioId);return c&&post&&(b.comentarioId===undefined||m)?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}${m?`/comentarios/${m}`:''}/curtidas`:null}),
  'denunciar': op(true,'POST','mutation',[...cmd,'circuloId','postId','comentarioId','motivo'],[...cmd,'circuloId','postId','motivo'],b=>{const c=p(b.circuloId),post=p(b.postId),m=b.comentarioId===undefined?null:p(b.comentarioId);return c&&post&&(b.comentarioId===undefined||m)?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}${m?`/comentarios/${m}`:''}/denuncias`:null}),
  'editar-post': op(true,'PATCH','mutation',[...cmd,'circuloId','postId','texto'],[...cmd,'circuloId','postId','texto'],b=>{const c=p(b.circuloId),post=p(b.postId);return c&&post?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}`:null}),
  'retirar-post': op(true,'POST','mutation',[...cmd,'circuloId','postId'],[...cmd,'circuloId','postId'],b=>{const c=p(b.circuloId),post=p(b.postId);return c&&post?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}/retirada`:null}),
  'editar-comentario': op(true,'PATCH','mutation',[...cmd,'circuloId','postId','comentarioId','texto'],[...cmd,'circuloId','postId','comentarioId','texto'],b=>{const c=p(b.circuloId),post=p(b.postId),m=p(b.comentarioId);return c&&post&&m?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}/comentarios/${m}`:null}),
  'retirar-comentario': op(true,'POST','mutation',[...cmd,'circuloId','postId','comentarioId'],[...cmd,'circuloId','postId','comentarioId'],b=>{const c=p(b.circuloId),post=p(b.postId),m=p(b.comentarioId);return c&&post&&m?`/portal/paciente/gamificacao-piloto/circulos/${c}/publicacoes/${post}/comentarios/${m}/retirada`:null})
};

const outputFields: Record<PilotoProjection, readonly string[]> = {
  'page-achievements':['itens','temMais','proximoCursor'], 'page-circles':['itens','temMais','proximoCursor'],
  'page-feed':['itens','temMais','proximoCursor'], 'page-likes':['itens','temMais','proximoCursor'],
  'page-privacy':['itens','temMais','proximoCursor'], 'page-reports':['itens','temMais','proximoCursor'],
  invite:['id','estado','versao','geracao','expiraEm'],
  mutation:['id','versao','estado','compartilhado','geracao','aceito','consentimentoVersao','curti']
};
const itemFields: Record<string, readonly string[]> = {
  'page-achievements':['id','titulo','descricao','icone','criadoEm','origem','versao','compartilhado','geracao','aceito','termoVersao','consentimentoVersao'],
  'page-circles':['id','nome','objetivo','estado','versao','destinatarios','participacao','participacaoVersao','geracao','conviteExpiraEm','termoVersao'],
  'page-feed':['id','texto','autor','criadoEm','versao','proprio','reacoes'], 'page-likes':['nome'],
  'page-privacy':['id','geracao','consentimentoVersao','termoVersao','aceito','versao','estado'],
  'page-reports':['id','postId','comentarioId','versao','estado','criadoEm','eliminarEm','evidencia']
};

function pick(source: RecordInput, keys: readonly string[]) { return Object.fromEntries(keys.filter(key => Object.hasOwn(source,key)).map(key=>[key,source[key]])); }
const numberFields=new Set(['versao','geracao','consentimentoVersao','participacaoVersao','versaoConteudo','total']);
const booleanFields=new Set(['compartilhado','aceito','proprio','curti']);
function scalarFieldsValid(source:RecordInput) {
  return Object.entries(source).every(([key,value])=>{
    if(key==='reacoes'||key==='evidencia'||key==='destinatarios')return true;
    if(value===null)return ['conviteExpiraEm','expiraEm','participacao','participacaoVersao','geracao'].includes(key);
    if(numberFields.has(key))return Number.isSafeInteger(value)&&Number(value)>=0;
    if(booleanFields.has(key))return typeof value==='boolean';
    return typeof value==='string'&&value.length<=8192;
  });
}
export function projectPilotoResponse(value: unknown, shape: PilotoProjection): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source=value as RecordInput;
  if (shape.startsWith('page-')) {
    if (!Array.isArray(source.itens) || source.itens.length>50 || typeof source.temMais!=='boolean' || (source.proximoCursor!==undefined&&(typeof source.proximoCursor!=='string'||source.proximoCursor.length>1024))) return null;
    const itens:RecordInput[]=[];
    for(const item of source.itens){
      if(!item||typeof item!=='object'||Array.isArray(item))return null;
      const result=pick(item as RecordInput,itemFields[shape]);
      if(!scalarFieldsValid(result))return null;
      for(const [field,keys] of [['reacoes',['total','curti']],['evidencia',['texto','autor','criadoEm','motivo','versaoConteudo']],['destinatarios',['clinica','profissional']]] as const){
        if(!Object.hasOwn(result,field))continue;
        const nested=result[field];if(!nested||typeof nested!=='object'||Array.isArray(nested))return null;
        const safe=pick(nested as RecordInput,keys);if(!scalarFieldsValid(safe))return null;
        if(field==='destinatarios'&&(!safe.clinica||!safe.profissional))return null;
        result[field]=safe;
      }
      itens.push(result);
    }
    return {itens,temMais:source.temMais,...(typeof source.proximoCursor==='string'?{proximoCursor:source.proximoCursor}:{})};
  }
  const result=pick(source,outputFields[shape]);return scalarFieldsValid(result)?result:null;
}
function json(status:number,body:unknown){return NextResponse.json(body,{status,headers:HEADERS});}
function errorText(){return 'Não foi possível concluir esta ação. Confira os dados e tente novamente.';}

async function readLimitedBody(request: NextRequest, limit: number): Promise<{ text: string } | null> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) return null;
  const reader = request.body?.getReader();
  if (!reader) return { text: '' };
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
}

function validate(body: RecordInput, operation: Operation) {
  if (Object.keys(body).some(key=>!operation.keys.includes(key)) || operation.required.some(key=>!Object.hasOwn(body,key))) return false;
  if (operation.method==='GET') return true;
  if (typeof body.chave!=='string'||!UUID.test(body.chave)||!Number.isInteger(body.versaoEsperada)||Number(body.versaoEsperada)<0) return false;
  if ('titulo'in body && (typeof body.titulo!=='string'||body.titulo.trim().length<1||body.titulo.length>120)) return false;
  if ('descricao'in body && body.descricao!==undefined && (typeof body.descricao!=='string'||body.descricao.length>1000)) return false;
  if ('icone'in body && !['award','heart','book','calendar','check'].includes(String(body.icone))) return false;
  if ('nome'in body && (typeof body.nome!=='string'||body.nome.trim().length<1||body.nome.length>160)) return false;
  if ('objetivo'in body && (typeof body.objetivo!=='string'||body.objetivo.trim().length<1||body.objetivo.length>160)) return false;
  if ('texto'in body && (typeof body.texto!=='string'||body.texto.trim().length<1||body.texto.length>(body.acao==='publicar'||body.acao==='editar-post'?2000:500))) return false;
  if ('motivo'in body && (typeof body.motivo!=='string'||body.motivo.trim().length<1||body.motivo.length>1000)) return false;
  if ('justificativa'in body && (typeof body.justificativa!=='string'||body.justificativa.trim().length<1||body.justificativa.length>1000)) return false;
  if ('compartilhado'in body && typeof body.compartilhado!=='boolean') return false;
  if ('aceitar'in body && typeof body.aceitar!=='boolean') return false;
  if ('retirar'in body && typeof body.retirar!=='boolean') return false;
  if ('curti'in body && typeof body.curti!=='boolean') return false;
  if ('geracao'in body && (!Number.isInteger(body.geracao)||Number(body.geracao)<1)) return false;
  if ('nomeExibicao'in body && (typeof body.nomeExibicao!=='string'||body.nomeExibicao.trim().length<1||body.nomeExibicao.length>80)) return false;
  if ('termoVersao'in body && !['317-conquistas-v1','317-comunidade-v1'].includes(String(body.termoVersao))) return false;
  return true;
}

export function validatePilotoOperation(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body=value as RecordInput;
  const operation=typeof body.acao==='string'&&Object.hasOwn(operations,body.acao)?operations[body.acao]:undefined;
  return !!operation && validate(body,operation) && operation.path(body)!==null;
}

export async function tratarOperacaoPiloto(request:NextRequest,portal:boolean){
  if(!origemMutacaoPermitida(request))return json(403,{mensagem:'Origem não autorizada.'});
  let identity;
  try{
    const session=portal?await obterSessaoValidaBff():await exigirPermissaoBff('gamificacao.gerenciar');
    if(!portal)await exigirPermissaoBff('pacientes.gerenciar');
    if((portal&&session.papel!=='Patient')||(!portal&&session.papel!=='Professional'))return json(403,{mensagem:'Este recurso não está disponível para seu perfil.'});
    identity=true;
  }catch(e){if(e instanceof ErroSessaoAusente)return json(401,{mensagem:e.message});if(e instanceof ErroPermissaoAusente)return json(403,{mensagem:e.message});return json(502,{mensagem:'Não foi possível validar a sessão.'});}
  if(!identity)return json(403,{mensagem:'Acesso negado.'});
  let limited:{text:string}|null;try{limited=await readLimitedBody(request,8192);}catch{return json(400,{mensagem:'Confira a solicitação.'});}
  if(!limited)return json(413,{mensagem:'Solicitação acima do limite.'});
  const raw=limited.text;
  let body:unknown;try{body=JSON.parse(raw);}catch{return json(400,{mensagem:'Confira a solicitação.'});}
  if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{mensagem:'Confira a solicitação.'});
  const input=body as RecordInput, action=typeof input.acao==='string'?input.acao:'';
  const operation=Object.hasOwn(operations,action)?operations[action]:undefined;
  if(!operation||operation.portal!==portal)return json(404,{mensagem:'Ação não encontrada.'});
  if(!validate(input,operation))return json(400,{mensagem:'Campos inválidos ou acima dos limites.'});
  const path=operation.path(input);if(!path)return json(400,{mensagem:'Identificador ou cursor inválido.'});
  const payload={...input};delete payload.acao;delete payload.cursor;delete payload.pacienteId;delete payload.conquistaId;delete payload.circuloId;delete payload.postId;delete payload.comentarioId;delete payload.denunciaId;
  try{
    const upstream=await requisitarBackendAutenticado(path,{method:operation.method,...(operation.method==='GET'?{}:{body:JSON.stringify(payload)}),cache:'no-store'});
    let result:unknown;try{result=await upstream.json();}catch{return json(502,{mensagem:'O serviço retornou uma resposta inválida.'});}
    if(!upstream.ok)return json(upstream.status,{mensagem:errorText()});
    const safe=projectPilotoResponse(result,operation.projection);if(safe===null)return json(502,{mensagem:'O serviço retornou dados fora do contrato.'});
    return json(upstream.status,safe);
  }catch{return json(502,{mensagem:'Não foi possível acessar o serviço do piloto.'});}
}
