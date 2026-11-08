import { AnaliseFactualInvalidaError,type RegistroAnaliseFactual } from './construtor-analise-factual';
import { DIMENSOES_VERSAO,type IdentidadeVersaoFactual,type ComparacaoVersoesFactuais } from '../dominio/comparacao-versoes-factuais';
import type { ResultadoCalculoCombinado,CodigoNutrienteCombinado } from '../dominio/calculo-combinado';
import type { CoberturaDietetica } from '../dominio/cobertura-dietetica';
import type { DeltaFactual } from '../dominio/previa-dietetica';
import { CODIGOS_MICRONUTRIENTES } from '../dominio/micronutrientes';
import { projetarAjudaDietetica } from './projecao-ajuda-dietetica';
import { analisarFontesPorNutriente } from '../dominio/fontes-por-nutriente';
type DimensaoBase='planejamento'|'composicao_fonte'|'referencia'|'contexto';
export type EstadoComparacaoHistorica='IGUAL'|'DIFERENTE'|'NAO_COMPARAVEL'|'SEM_REGISTRO_ANTERIOR';
export interface ComparacaoBasesHistoricas {
 planejamento:EstadoComparacaoHistorica;composicaoFonte:EstadoComparacaoHistorica;referencia:EstadoComparacaoHistorica;contexto:EstadoComparacaoHistorica;
 cobertura:Record<typeof CODIGOS_MICRONUTRIENTES[number],EstadoComparacaoHistorica>;
}
type Meta={id:string;criadoEm:Date};
const CODIGOS:CodigoNutrienteCombinado[]=['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg',...CODIGOS_MICRONUTRIENTES];
const referencias=()=>({estado:'indisponivel' as const,motivo:'referencias_nao_habilitadas' as const});
function origem(o:IdentidadeVersaoFactual){return {planoId:o.planoId,versaoId:o.versaoId,numero:o.numero,status:o.status,registradaEm:o.registradaEm,...(o.status==='rascunho'?{rascunhoRevisao:o.rascunhoRevisao}:{})};}
function selecao(r:RegistroAnaliseFactual){return {planoAtivo:r.versao.estado.ativo,planoSelecionado:r.versao.estado.selecionado,refeicoes:r.versao.estado.refeicoes.map(f=>({identidadeId:f.identidadeId,ativa:f.ativa,selecionada:f.selecionada}))};}
export function projetarMetadadosRegistro(m:Meta){return {id:m.id,criadoEm:m.criadoEm.toISOString()};}
function estado(a:{calculo:ResultadoCalculoCombinado;cobertura:CoberturaDietetica}){
 return {calculo:{motorVersao:a.calculo.motorVersao,estado:a.calculo.estado,itensIncluidos:a.calculo.itensIncluidos,
  nutrientes:Object.fromEntries(CODIGOS.map(c=>{const n=a.calculo.nutrientes[c];return [c,{codigo:c,unidade:n.unidade,estado:n.estado,
   itensComValor:n.itensComValor,itensIncluidos:n.itensIncluidos,...(n.total!==undefined?{total:n.total}:{}),...(n.quantidadeConhecida!==undefined?{quantidadeConhecida:n.quantidadeConhecida}:{})}];})),
  exclusoes:a.calculo.exclusoes.map(e=>({planoId:e.planoId,...(e.identidadeRefeicao!==undefined?{identidadeRefeicao:e.identidadeRefeicao}:{}),motivo:e.motivo}))},
  cobertura:{schemaVersao:1 as const,nutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>{const n=a.cobertura.nutrientes[c];return [c,{codigo:c,unidade:n.unidade,estado:n.estado,
   contagens:{incluidos:n.contagens.incluidos,conhecidos:n.contagens.conhecidos,semComposicao:n.contagens.semComposicao,incompativeis:n.contagens.incompativeis,naoResolvidos:n.contagens.naoResolvidos},
   causas:n.causas.map(x=>({codigo:x.codigo,quantidade:x.quantidade})),...(n.total!==undefined?{total:n.total}:{}),...(n.quantidadeConhecida!==undefined?{quantidadeConhecida:n.quantidadeConhecida}:{})}];}))}};
}
function delta(d:DeltaFactual){
 if(d.estado==='indisponivel')return {estado:d.estado,motivo:d.motivo};
 return {estado:d.estado,diferenca:d.diferenca,percentual:d.percentual.estado==='indisponivel'?{estado:d.percentual.estado,motivo:d.percentual.motivo}:
  {estado:d.percentual.estado,valor:d.percentual.valor,arredondado:d.percentual.arredondado}};
}
function projetarContextoConfirmado(c:NonNullable<RegistroAnaliseFactual['contexto']>){
 return {schemaVersao:1 as const,dataAnalise:c.dataAnalise,
  ...(c.resolvido.idadeAnos===undefined?{}:{idadeAnos:c.resolvido.idadeAnos}),
  ...(c.resolvido.populacaoReferencia===undefined?{}:{populacaoReferencia:c.resolvido.populacaoReferencia}),
  mesmoDiaPlanejado:c.resolvido.contexto.mesmoDiaPlanejado,tabagismo:c.resolvido.contexto.tabagismo,motivos:[...c.resolvido.motivos]};
}
/** Derivada dos itens congelados do registro, nunca gravada: o envelope persistido e seu hash não mudam. */
function projetarFontesPorNutriente(r:RegistroAnaliseFactual){return analisarFontesPorNutriente([r.versao.estado]);}
/** Projeções por allowlist de fontes já validadas/autorizadas. Nunca serializar o registro interno. */
export function projetarRegistroFactual(m:Meta,r:RegistroAnaliseFactual){
 if(r.avisos.some(a=>!['porcao_divergente','planejamento_nao_documentado','composicao_nao_documentada'].includes(a)))throw new AnaliseFactualInvalidaError();
 return {schemaVersao:1 as const,motorVersao:'food06-registro-api-v1' as const,registro:projetarMetadadosRegistro(m),origem:origem(r.versao.origem),
  selecao:selecao(r),analise:estado(r.analise),fontesPorNutriente:projetarFontesPorNutriente(r),referencias:referencias(),
  ...(r.contexto?{contextoConfirmado:projetarContextoConfirmado(r.contexto)}:{}),avisos:[...r.avisos],ajuda:projetarAjudaDietetica()};
}
export function projetarComparacaoFactual(a:Meta,b:Meta,r:ComparacaoVersoesFactuais,registroAntes:RegistroAnaliseFactual,registroDepois:RegistroAnaliseFactual){
 return {schemaVersao:1 as const,motorVersao:'food06-comparacao-api-v1' as const,escopoComparacao:r.escopoComparacao,
  antes:{registro:projetarMetadadosRegistro(a),origem:origem(r.antes),selecao:selecao(registroAntes)},depois:{registro:projetarMetadadosRegistro(b),origem:origem(r.depois),selecao:selecao(registroDepois)},
  comparacao:{schemaVersao:1 as const,motorVersao:r.comparacao.motorVersao,antes:estado(r.comparacao.antes),depois:estado(r.comparacao.depois),
   diferencas:Object.fromEntries(CODIGOS.map(c=>[c,{codigo:c,unidade:r.comparacao.diferencas[c].unidade,delta:delta(r.comparacao.diferencas[c].delta)}]))},
  bases:Object.fromEntries(DIMENSOES_VERSAO.map(c=>[c,r.bases[c]])),cobertura:Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>[c,r.cobertura[c]])),
  atribuicaoCausal:r.atribuicaoCausal,referencias:referencias(),ajuda:projetarAjudaDietetica()};
}

const DIMENSOES_HISTORICAS:readonly [DimensaoBase,string][]=[['planejamento','planejamento'],['composicao_fonte','composicaoFonte'],['referencia','referencia'],['contexto','contexto']];
function compararMarcadorBase(atual:RegistroAnaliseFactual,anterior:RegistroAnaliseFactual,dimensao:DimensaoBase):EstadoComparacaoHistorica{
 const ler=(r:RegistroAnaliseFactual)=>{
  const bases=r.versao.bases as Record<string,unknown>|undefined,m=bases?.[dimensao];
  if(!m||typeof m!=='object'||Array.isArray(m))return;
  const o=m as Record<string,unknown>;
  if(o.esquemaVersao!=='food06-bases-v1'||typeof o.conteudoHash!=='string'||! /^[a-f0-9]{64}$/i.test(o.conteudoHash))return;
  return o.conteudoHash.toLowerCase();
 };
 const a=ler(atual),b=ler(anterior);if(!a||!b)return 'NAO_COMPARAVEL';return a===b?'IGUAL':'DIFERENTE';
}
function resumoCobertura(r:RegistroAnaliseFactual,codigo:typeof CODIGOS_MICRONUTRIENTES[number]):string{
 const n=r.analise.cobertura.nutrientes[codigo],causas=[...n.causas].map(x=>[x.codigo,x.quantidade] as const).sort(([a],[b])=>a<b?-1:a>b?1:0);
 return JSON.stringify([n.estado,n.contagens.incluidos,n.contagens.conhecidos,n.contagens.semComposicao,n.contagens.incompativeis,n.contagens.naoResolvidos,causas]);
}
/** Compara apenas marcadores/dimensões já congelados; nunca devolve hash ou estabelece causalidade. */
export function compararBasesHistoricas(atual:RegistroAnaliseFactual,anterior?:RegistroAnaliseFactual):ComparacaoBasesHistoricas{
 if(!anterior){
  const sem='SEM_REGISTRO_ANTERIOR' as const;
  return {planejamento:sem,composicaoFonte:sem,referencia:sem,contexto:sem,cobertura:Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>[c,sem])) as ComparacaoBasesHistoricas['cobertura']};
 }
 const bases=Object.fromEntries(DIMENSOES_HISTORICAS.map(([dimensao,chave])=>[chave,compararMarcadorBase(atual,anterior,dimensao)])) as Pick<ComparacaoBasesHistoricas,'planejamento'|'composicaoFonte'|'referencia'|'contexto'>;
 const cobertura=Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>[c,resumoCobertura(atual,c)===resumoCobertura(anterior,c)?'IGUAL':'DIFERENTE'])) as ComparacaoBasesHistoricas['cobertura'];
 return {...bases,cobertura};
}
/** Resumo M10 por allowlist; contexto mínimo somente por opt-in explícito. */
export function projetarResumoHistoricoFactual(meta:Meta,r:RegistroAnaliseFactual,comparacaoAnterior:ComparacaoBasesHistoricas=compararBasesHistoricas(r),incluirContexto=false){
 const nutrientes=Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(codigo=>{
  const n=r.analise.cobertura.nutrientes[codigo];
  return [codigo,{codigo,unidade:n.unidade,estado:n.estado,
   contagens:{incluidos:n.contagens.incluidos,conhecidos:n.contagens.conhecidos,semComposicao:n.contagens.semComposicao,
    incompativeis:n.contagens.incompativeis,naoResolvidos:n.contagens.naoResolvidos},causas:n.causas.map(x=>({codigo:x.codigo,quantidade:x.quantidade})),
   ...(n.estado==='COMPLETO'&&n.total!==undefined?{total:n.total}:{}),...(n.estado!=='COMPLETO'&&n.quantidadeConhecida!==undefined?{quantidadeConhecida:n.quantidadeConhecida}:{})}];
 }));
 return {schemaVersao:1 as const,registro:projetarMetadadosRegistro(meta),origem:origem(r.versao.origem),comparacaoAnterior,
  motorVersao:r.analise.calculo.motorVersao,nutrientes,fontesPorNutriente:projetarFontesPorNutriente(r),
  referencias:referencias(),
  ...(incluirContexto&&r.contexto?{contextoConfirmado:projetarContextoConfirmado(r.contexto)}:{}),
  bases:{planejamentoDocumentado:Boolean(r.versao.bases?.planejamento),composicaoDocumentada:Boolean(r.versao.bases?.composicao_fonte),
   contextoDocumentado:Boolean(r.versao.bases?.contexto)}};
}
