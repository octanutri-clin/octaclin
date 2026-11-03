import { AnaliseFactualInvalidaError,type RegistroAnaliseFactual } from './construtor-analise-factual';
import { DIMENSOES_VERSAO,type IdentidadeVersaoFactual,type ComparacaoVersoesFactuais } from '../dominio/comparacao-versoes-factuais';
import type { ResultadoCalculoCombinado,CodigoNutrienteCombinado } from '../dominio/calculo-combinado';
import type { CoberturaDietetica } from '../dominio/cobertura-dietetica';
import type { DeltaFactual } from '../dominio/previa-dietetica';
import { CODIGOS_MICRONUTRIENTES } from '../dominio/micronutrientes';
import { projetarAjudaDietetica } from './projecao-ajuda-dietetica';
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
/** Projeções por allowlist de fontes já validadas/autorizadas. Nunca serializar o registro interno. */
export function projetarRegistroFactual(m:Meta,r:RegistroAnaliseFactual){
 if(r.avisos.some(a=>!['porcao_divergente','planejamento_nao_documentado','composicao_nao_documentada'].includes(a)))throw new AnaliseFactualInvalidaError();
 return {schemaVersao:1 as const,motorVersao:'food06-registro-api-v1' as const,registro:projetarMetadadosRegistro(m),origem:origem(r.versao.origem),
  selecao:selecao(r),analise:estado(r.analise),referencias:referencias(),avisos:[...r.avisos],ajuda:projetarAjudaDietetica()};
}
export function projetarComparacaoFactual(a:Meta,b:Meta,r:ComparacaoVersoesFactuais,registroAntes:RegistroAnaliseFactual,registroDepois:RegistroAnaliseFactual){
 return {schemaVersao:1 as const,motorVersao:'food06-comparacao-api-v1' as const,escopoComparacao:r.escopoComparacao,
  antes:{registro:projetarMetadadosRegistro(a),origem:origem(r.antes),selecao:selecao(registroAntes)},depois:{registro:projetarMetadadosRegistro(b),origem:origem(r.depois),selecao:selecao(registroDepois)},
  comparacao:{schemaVersao:1 as const,motorVersao:r.comparacao.motorVersao,antes:estado(r.comparacao.antes),depois:estado(r.comparacao.depois),
   diferencas:Object.fromEntries(CODIGOS.map(c=>[c,{codigo:c,unidade:r.comparacao.diferencas[c].unidade,delta:delta(r.comparacao.diferencas[c].delta)}]))},
  bases:Object.fromEntries(DIMENSOES_VERSAO.map(c=>[c,r.bases[c]])),cobertura:Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>[c,r.cobertura[c]])),
  atribuicaoCausal:r.atribuicaoCausal,referencias:referencias(),ajuda:projetarAjudaDietetica()};
}
