import { calcularNutrientesParciaisDaPorcao } from '../dominio/calculo-nutricional';
import { createHash } from 'node:crypto';
import { CODIGOS_MICRONUTRIENTES,MAPEAMENTO_MICRONUTRIENTES,decimalComoRazao,decimalParaEscala8,LimitePrecisaoNutricionalError,criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { validarVersaoFactualResolvida,type VersaoFactualResolvida,type IdentidadeVersaoFactual } from '../dominio/comparacao-versoes-factuais';
import { resolverContextoDietetico,type EntradaContextoDietetico,type ContextoDieteticoResolvido } from '../dominio/contexto-dietetico';
import { calcularNutrientesCombinados,type ResultadoCalculoCombinado } from '../dominio/calculo-combinado';
import { analisarCoberturaDietetica,type CoberturaDietetica } from '../dominio/cobertura-dietetica';
import { instanteCivil } from '../../pacientes/dominio/idade-pediatrica';
import { VERSAO_REFERENCIAS_DRI_ADULTO } from '../dominio/referencias-dri';
/** Contrato interno do carregador autorizado, nunca body HTTP ou totais do cliente. */
export interface EntradaConstrutorAnaliseFactual {
 escopo:VersaoFactualResolvida['escopo'];origem:IdentidadeVersaoFactual;
 ativo:boolean;selecionado:boolean;
 refeicoes:{identidadeId:string;ativa:boolean;selecionada:boolean;itens:{porcaoGramas?:number|string;snapshot:unknown}[]}[];
 contexto?:EntradaContextoDietetico;
}
/**
 * v1: sem versão de referência (todo registro anterior à T3b e todo registro sem contexto).
 * v2 (FOOD06 T3b): só com contexto confirmado; grava a IDENTIDADE da versão DRI
 * vigente na captura, nunca valores ou comparação prontos. A projeção usa essa versão.
 */
export type ReferenciasRegistroFactual =
 | {estado:'indisponivel';motivo:'referencias_nao_habilitadas'}
 | {estado:'registrada';versao:string};
export interface RegistroAnaliseFactual {
 schemaVersao:1|2;motorVersao:'food06-registro-factual-v1'|'food06-registro-factual-v2';
 versao:VersaoFactualResolvida;
 analise:{calculo:ResultadoCalculoCombinado;cobertura:CoberturaDietetica};
 contexto?:{dataAnalise:string;resolvido:ContextoDieteticoResolvido};
 referencias:ReferenciasRegistroFactual;
 avisos:string[];
}
const IDENTIDADE_VERSAO_REFERENCIAS=/^[a-z0-9][a-z0-9_.:-]{0,99}$/;
export class AnaliseFactualInvalidaError extends Error {
 constructor(){super('Não foi possível registrar os dados factuais desta versão.');this.name='AnaliseFactualInvalidaError';}
}
/** Leitor versionado interno; não é autorização nem DTO HTTP. */
export function lerRegistroAnaliseFactual(conteudo: string): RegistroAnaliseFactual {
 try {
  if(typeof conteudo!=='string'||Buffer.byteLength(conteudo)>10*1024*1024)throw new AnaliseFactualInvalidaError();
  const r=objeto(JSON.parse(conteudo)),v=objeto(r.versao),e=objeto(v.estado);
  lista(e.refeicoes,50);
  // Reconferência exclusivamente contra os fatos gravados. Não consulta catálogo,
  // altera porções ou regrava a análise; versão de motor desconhecida falha fechada.
  const reconstruido=JSON.parse(JSON.stringify(construirAnaliseFactual({escopo:v.escopo as EntradaConstrutorAnaliseFactual['escopo'],
   origem:v.origem as IdentidadeVersaoFactual,ativo:e.ativo as boolean,selecionado:e.selecionado as boolean,
   refeicoes:(e.refeicoes as unknown[]).map(ref=>{
    const f=objeto(ref);lista(f.itens,10000);
    return {identidadeId:f.identidadeId as string,ativa:f.ativa as boolean,selecionada:f.selecionada as boolean,
     itens:(f.itens as unknown[]).map(snapshot=>({snapshot,porcaoGramas:snapshot===null?undefined:decimalDaRazao(objeto(snapshot).porcaoRegistroGramas)}))};
   })})));
  if(r.contexto!==undefined){
   const c=objeto(r.contexto),res=objeto(c.resolvido),ctx=objeto(res.contexto);
   if(Object.keys(c).some(k=>!['dataAnalise','resolvido'].includes(k))||Object.keys(res).some(k=>!['contexto','motivos','idadeAnos','populacaoReferencia'].includes(k))||
    Object.keys(ctx).some(k=>!['elegivel','mesmoDiaPlanejado','tabagismo'].includes(k))||typeof c.dataAnalise!=='string')throw new AnaliseFactualInvalidaError();
   instanteCivil(c.dataAnalise);
   lista(res.motivos,10);
   const motivos=res.motivos as unknown[],permitidos=['nascimento_nao_informado','nascimento_futuro','idade_fora_do_escopo','populacao_nao_confirmada','gestacao_fora_do_escopo',
    'lactacao_fora_do_escopo','fisiologia_nao_confirmada','aplicabilidade_nao_confirmada','confirmacao_invalida'];
   if(new Set(motivos).size!==motivos.length||motivos.some(m=>typeof m!=='string'||!permitidos.includes(m))||
    typeof ctx.elegivel!=='boolean'||typeof ctx.mesmoDiaPlanejado!=='boolean'||!['sim','nao','nao_informado'].includes(ctx.tabagismo as string)||
    ctx.elegivel!==(motivos.length===0)||
    (res.idadeAnos!==undefined&&(!Number.isSafeInteger(res.idadeAnos)||Number(res.idadeAnos)<0||Number(res.idadeAnos)>9999))||
    (res.idadeAnos===undefined?
     Number(motivos.includes('nascimento_nao_informado'))+Number(motivos.includes('nascimento_futuro'))!==1||motivos.includes('idade_fora_do_escopo'):
     motivos.includes('nascimento_nao_informado')||motivos.includes('nascimento_futuro'))||
    (res.idadeAnos!==undefined&&(Number(res.idadeAnos)<19)!==motivos.includes('idade_fora_do_escopo'))||
    (res.populacaoReferencia!==undefined&&!['masculina','feminina'].includes(res.populacaoReferencia as string))||
    (res.populacaoReferencia===undefined)!==motivos.includes('populacao_nao_confirmada'))throw new AnaliseFactualInvalidaError();
   reconstruido.contexto=c;reconstruido.versao.bases.contexto=marcador(c);
  }
  // v1 legado (com ou sem contexto) segue exatamente o reconstruído acima. v2 exige
  // contexto e só a identidade da versão; versão desconhecida bem formada é legível
  // (a projeção a declara indisponível), forma diferente falha fechada.
  if(r.schemaVersao===2){
   const ref=objeto(r.referencias);
   if(r.contexto===undefined||Object.keys(ref).length!==2||ref.estado!=='registrada'||typeof ref.versao!=='string'||!IDENTIDADE_VERSAO_REFERENCIAS.test(ref.versao))throw new AnaliseFactualInvalidaError();
   const referencias={estado:'registrada' as const,versao:ref.versao};
   // Chaves fixas: nenhuma propriedade do registro de entrada é mesclada.
   reconstruido.schemaVersao=2;
   reconstruido.motorVersao='food06-registro-factual-v2';
   reconstruido.referencias=referencias;
  }else if(r.schemaVersao!==1)throw new AnaliseFactualInvalidaError();
  // Igualdade canônica detecta campos extras, totais/avisos/markers divergentes
  // sem aceitar o conteúdo cifrado apenas porque seu TypeScript parece correto.
  if(serializar(r)!==serializar(reconstruido))throw new AnaliseFactualInvalidaError();
  congelar(r);return r as unknown as RegistroAnaliseFactual;
 }catch{throw new AnaliseFactualInvalidaError();}
}
/** Decodifica a razão decimal gravada sem converter por Number ou arredondar. */
function decimalDaRazao(v:unknown):string|undefined {
 if(v===undefined)return;
 lista(v,2);const a=v as unknown[];
 if(a.length!==2||a.some(x=>typeof x!=='string'||! /^[1-9]\d{0,1100}$/.test(x)))throw new AnaliseFactualInvalidaError();
 const n=BigInt(a[0] as string),d=BigInt(a[1] as string);let resto=d,dois=0,cinco=0;
 while(resto%2n===0n){resto/=2n;dois++;}
 while(resto%5n===0n){resto/=5n;cinco++;}
 if(resto!==1n)throw new AnaliseFactualInvalidaError();
 const escala=Math.max(dois,cinco),coef=(n*2n**BigInt(escala-dois)*5n**BigInt(escala-cinco)).toString();
 const inteiro=escala===0?coef:coef.length>escala?coef.slice(0,-escala)+'.'+coef.slice(-escala):'0.'+'0'.repeat(escala-coef.length)+coef;
 const expoente=coef.length-1-escala,digitos=coef.replace(/0+$/,'');
 const cientifico=expoente < -999?'0.'+'0'.repeat(-999-expoente-1)+digitos+'e-999':digitos[0]+(digitos.length>1?'.'+digitos.slice(1):'')+'e'+expoente;
 const candidatos=[inteiro,cientifico].filter(c=>c.length<=64).sort((a,b)=>a.length-b.length);
 for(const c of candidatos){const x=razao(c,true);if(x[0]===a[0]&&x[1]===a[1])return c;}
 throw new AnaliseFactualInvalidaError();
}
const MACROS=['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg'];
function objeto(v:unknown):Record<string,unknown> {
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length||
  Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))throw new AnaliseFactualInvalidaError();
 return v as Record<string,unknown>;
}
function lista(v:unknown,maximo:number):void {
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>maximo||Object.getOwnPropertySymbols(v).length)throw new AnaliseFactualInvalidaError();
 const ds=Object.getOwnPropertyDescriptors(v);
 if(Object.keys(ds).length!==v.length+1||Object.entries(ds).some(([k,d])=>k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=v.length||!d.enumerable||!Object.hasOwn(d,'value'))))throw new AnaliseFactualInvalidaError();
}
function positivo(v:unknown):number {const n=numero(v);if(!n)throw new AnaliseFactualInvalidaError();return n;}
function texto(v:unknown):string|undefined {if(v===undefined)return; if(typeof v!=='string'||v.length>256)throw new AnaliseFactualInvalidaError();return v.normalize('NFC').trim();}
function razao(v:unknown,positivo=false):string[] {
 decimalParaEscala8(v);const {numerador,denominador}=decimalComoRazao(v);
 if(positivo&&!numerador)throw new AnaliseFactualInvalidaError();
 const mdc=(a:bigint,b:bigint):bigint=>b?mdc(b,a%b):a;
 const divisor=mdc(numerador,denominador);return [(numerador/divisor).toString(),(denominador/divisor).toString()];
}
function numero(v:unknown):number {if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new AnaliseFactualInvalidaError();decimalParaEscala8(v);return v;}
function nutrientes(v:unknown):Record<string,number>|undefined {
 if(v===undefined)return;const o=objeto(v);
 return Object.fromEntries(MACROS.filter(c=>o[c]!==undefined).map(c=>[c,numero(o[c])]));
}
function projetarSnapshot(v:unknown):Record<string,unknown>|null {
 if(v===null||v===undefined)return null;
 const o=objeto(v),r:Record<string,unknown>={};
 for(const c of ['origem','alimentoComposicaoId','codigoOrigem','preparacao'])if(o[c]!==undefined)Object.defineProperty(r,c,{value:texto(o[c]),enumerable:true,writable:true,configurable:true});
 if(r.origem!==undefined&&!['catalogo','manual','custom'].includes(r.origem as string))throw new AnaliseFactualInvalidaError();
 if(o.nutrientesPor100g!==undefined)r.nutrientesPor100g=nutrientes(o.nutrientesPor100g);
 if(o.nutrientesPorcao!==undefined)r.nutrientesPorcao=nutrientes(o.nutrientesPorcao);
 if(o.fonte!==undefined){
  const f=objeto(o.fonte);r.fonte=Object.fromEntries(['codigo','versao','baseCodigo','hashConteudo','esquemaVersao'].filter(c=>f[c]!==undefined).map(c=>[c,c==='hashConteudo'?texto(f[c])?.toLowerCase():texto(f[c])]));
 }
 if(o.composicaoInformada!==undefined){
  const ci=objeto(o.composicaoInformada),micros=objeto(ci.micronutrientes);
  if(!numero(ci.baseGramas)||!texto(ci.normalizacaoVersao))throw new AnaliseFactualInvalidaError();
  r.composicaoInformada={baseGramas:numero(ci.baseGramas),normalizacaoVersao:texto(ci.normalizacaoVersao),
   nutrientes:nutrientes(ci.nutrientes),micronutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.filter(c=>micros[c]!==undefined).map(c=>[c,numero(micros[c])]))};
 }
 if(o.micronutrientes!==undefined){
  const m=objeto(o.micronutrientes);
  // Um registro não pode declarar reprodutível um esquema que não sabe ler.
  // A análise factual existente continua independente desta operação de registro.
  if(m.schemaVersao!==1||m.mapeamentoVersao!==MAPEAMENTO_MICRONUTRIENTES)throw new AnaliseFactualInvalidaError();
  const ns=objeto(m.nutrientes);
  r.micronutrientes={schemaVersao:1,mapeamentoVersao:MAPEAMENTO_MICRONUTRIENTES,baseGramasOrigem:positivo(m.baseGramasOrigem),porcaoGramas:positivo(m.porcaoGramas),
   nutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.filter(c=>ns[c]!==undefined).map(c=>{
    const n=objeto(ns[c]);const estado=texto(n.estado);
    if(!['conhecido','ausente','traco','nao_analisado','em_reavaliacao','abaixo_loq','unidade_incompativel','duplicado','invalido','definicao_incompativel'].includes(estado??''))throw new AnaliseFactualInvalidaError();
    return [c,{estado,...Object.fromEntries(['valorOrigem','por100g','porcao'].filter(k=>n[k]!==undefined).map(k=>[k,numero(n[k])]))}];
   }))};
 }
 return r;
}
function canonicalizar(v:unknown):unknown {
 if(typeof v==='number')return {decimal:razao(v)};
 if(Array.isArray(v))return v.map(canonicalizar);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalizar((v as Record<string,unknown>)[k])]));
 return v;
}
function serializar(v:unknown):string{return JSON.stringify(canonicalizar(v));}
function marcador(v:unknown){return {esquemaVersao:'food06-bases-v1',conteudoHash:createHash('sha256').update(serializar(v)).digest('hex')};}
function congelar(v:unknown):void {if(v&&typeof v==='object'){for(const x of Object.values(v))congelar(x);Object.freeze(v);}}
/** Só produz envelope em memória. Não autoriza, persiste, consulta fonte ou ativa DRI. */
export function construirAnaliseFactual(entrada:EntradaConstrutorAnaliseFactual):RegistroAnaliseFactual {
 try {
  const e=objeto(entrada);const avisos=new Set<string>();const compostos=new Set<string>();let planejamentoDocumentado=true,composicaoDocumentada=true;
  lista(e.refeicoes,50);if(typeof e.ativo!=='boolean'||typeof e.selecionado!=='boolean')throw new AnaliseFactualInvalidaError();
  let quantidade=0;
  const grupos:unknown[]=[];
  const refeicoes=entrada.refeicoes.map(ref=>{
   objeto(ref);lista(ref.itens,10000);if(typeof ref.ativa!=='boolean'||typeof ref.selecionada!=='boolean')throw new AnaliseFactualInvalidaError();
   const incluida=e.ativo&&e.selecionado&&ref.ativa&&ref.selecionada;
   const planejamentoItens:unknown[]=[];
   const itens=incluida?ref.itens.map(item=>{
    if(++quantidade>10000)throw new AnaliseFactualInvalidaError();objeto(item);
    const s=projetarSnapshot(item.snapshot);
    const porcao=item.porcaoGramas===undefined?undefined:razao(item.porcaoGramas,true);
    if(!s){planejamentoDocumentado=false;composicaoDocumentada=false;return null;}
    const preparo=typeof s.preparacao==='string'?s.preparacao.toLocaleLowerCase('pt-BR').replace(/\s+/g,' '):undefined;
    const fonte=s.fonte as Record<string,unknown>|undefined,m=s.micronutrientes as Record<string,unknown>|undefined;
    if(porcao&&m&&serializar(razao(m.porcaoGramas))!==serializar(porcao)){avisos.add('porcao_divergente');planejamentoDocumentado=false;}
    const ns=s.nutrientesPor100g as Record<string,unknown>|undefined;
    const naPorcao=s.nutrientesPorcao as Record<string,unknown>|undefined;
    if(!s.origem||!ns||MACROS.some(c=>naPorcao?.[c]!==undefined&&ns[c]===undefined))composicaoDocumentada=false;
    if(s.origem==='catalogo'&&(!fonte?.codigo||!fonte.versao||!fonte.baseCodigo||typeof fonte.hashConteudo!=='string'||! /^[a-f0-9]{64}$/.test(fonte.hashConteudo)))composicaoDocumentada=false;
    if(s.origem==='custom'&&!s.composicaoInformada)composicaoDocumentada=false;
    const divergencia=()=>{avisos.add('porcao_divergente');planejamentoDocumentado=false;composicaoDocumentada=false;};
    if(porcao&&ns&&naPorcao){
     const esperados=calcularNutrientesParciaisDaPorcao(ns,Number(item.porcaoGramas)) as Record<string,number|undefined>;
     if(MACROS.some(c=>naPorcao[c]!==undefined&&esperados[c]!==undefined&&decimalParaEscala8(naPorcao[c])!==decimalParaEscala8(esperados[c])))divergencia();
    }
    if(m){
     const valores=m.nutrientes as Record<string,Record<string,unknown>>;
     const origens=Object.fromEntries(Object.entries(valores).map(([c,n])=>[c,{estado:n.estado,valor:n.valorOrigem}]));
     const esperados=criarSnapshotMicronutrientes(origens as Parameters<typeof criarSnapshotMicronutrientes>[0],m.baseGramasOrigem as number,m.porcaoGramas as number);
     for(const c of CODIGOS_MICRONUTRIENTES){
      const n=valores[c];if(n?.estado!=='conhecido')continue;
      if(n.por100g===undefined||n.valorOrigem===undefined||n.porcao===undefined){composicaoDocumentada=false;continue;}
      const esperado=esperados.nutrientes[c];
      if(esperado.estado!=='conhecido'||decimalParaEscala8(n.porcao)!==decimalParaEscala8(esperado.porcao)||decimalParaEscala8(n.por100g)!==decimalParaEscala8(esperado.por100g))divergencia();
     }
    }
    const identidade=s.origem==='catalogo'&&fonte?.baseCodigo&&s.codigoOrigem?{base:fonte.baseCodigo,codigo:s.codigoOrigem,preparacao:preparo}:undefined;
    if(!identidade||!porcao)planejamentoDocumentado=false;
    planejamentoItens.push({identidade,porcao});
    const micros=m?{schemaVersao:m.schemaVersao,mapeamentoVersao:m.mapeamentoVersao,baseGramasOrigem:m.baseGramasOrigem,
      nutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>{const n=(m.nutrientes as Record<string,Record<string,unknown>>)[c];return [c,n?{estado:n.estado,valorOrigem:n.valorOrigem,por100g:n.por100g}:{estado:'ausente'}];}))}:undefined;
    compostos.add(serializar({origem:s.origem,preparacao:preparo,codigoOrigem:s.codigoOrigem,fonte,nutrientesPor100g:s.nutrientesPor100g,micronutrientes:micros,composicaoInformada:s.composicaoInformada}));
    if(porcao)s.porcaoRegistroGramas=porcao;
    return s;
   }):[];
   grupos.push({ativa:ref.ativa,selecionada:ref.selecionada,itens:planejamentoItens.map(serializar).sort()});
   return {identidadeId:ref.identidadeId,ativa:ref.ativa,selecionada:ref.selecionada,itens};
  });
  const origemEntrada=objeto(e.origem),escopoEntrada=objeto(e.escopo);
  const versao:VersaoFactualResolvida={escopo:{tenantId:escopoEntrada.tenantId as string,pacienteId:escopoEntrada.pacienteId as string},origem:entrada.origem,
   estado:{planoId:origemEntrada.planoId as string,ativo:entrada.ativo,selecionado:entrada.selecionado,refeicoes},bases:{}};
  const validada=validarVersaoFactualResolvida(versao);versao.origem=validada.origem;
  if(planejamentoDocumentado)versao.bases!.planejamento=marcador({ativo:e.ativo,selecionado:e.selecionado,grupos:grupos.map(serializar).sort()});
  else avisos.add('planejamento_nao_documentado');
  if(composicaoDocumentada)versao.bases!.composicao_fonte=marcador([...compostos].sort());
  else avisos.add('composicao_nao_documentada');
  let contexto:RegistroAnaliseFactual['contexto'];
  if(e.contexto!==undefined){
   objeto(e.contexto);const resolvido=resolverContextoDietetico(entrada.contexto!);
   // Data civil inválida não vira um contexto aparentemente documentado.
   if(resolvido.motivos.includes('data_invalida'))throw new AnaliseFactualInvalidaError();
   contexto={dataAnalise:entrada.contexto!.dataAnalise,resolvido};versao.bases!.contexto=marcador(contexto);
  }
  let referencias:ReferenciasRegistroFactual={estado:'indisponivel',motivo:'referencias_nao_habilitadas'};
  // Sem marcador `bases.referencia`: ele mudaria histórico e /comparar sem opt-in, e a
  // integridade já vem da igualdade canônica do registro inteiro. Contexto inelegível
  // (ex.: gestação) também grava a versão adulta; a projeção o declara não elegível.
  if(contexto)referencias={estado:'registrada',versao:VERSAO_REFERENCIAS_DRI_ADULTO};
  const r:RegistroAnaliseFactual={...(contexto?{schemaVersao:2 as const,motorVersao:'food06-registro-factual-v2' as const}:{schemaVersao:1 as const,motorVersao:'food06-registro-factual-v1' as const}),versao,
   analise:{calculo:calcularNutrientesCombinados([versao.estado]),cobertura:analisarCoberturaDietetica([versao.estado])},
   ...(contexto?{contexto}:{}),referencias,avisos:[...avisos].sort()};
  congelar(r);return r;
 }catch(erro){if(erro instanceof LimitePrecisaoNutricionalError)throw erro;throw new AnaliseFactualInvalidaError();}
}
