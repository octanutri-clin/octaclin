import {MOTIVOS_CONTEXTO_REGISTRADO,type ContextoRegistradoFactual} from '@/lib/contexto-registrado-factual';
/** Somente resumo validado do registro; não consulta nem completa o cadastro atual. */
export function ContextoRegistradoResumo({contexto:c}:{contexto:ContextoRegistradoFactual}){
 return <div className="grid gap-1 text-sm">
  <p>Contexto registrado nesta análise: {c.dataAnalise.split('-').reverse().join('/')} (data civil da análise).</p>
  <p>Este resumo não descreve necessariamente as condições atuais e não ativa referências RDA/AI/UL.</p>
  <p>Idade: {c.idadeAnos===undefined?'não registrada':`${c.idadeAnos} anos completos`}. População de referência: {c.populacaoReferencia??'não informada'}.</p>
  <p>Mesmo dia planejado: {c.mesmoDiaPlanejado?'confirmado':'não confirmado'}.</p>
  <p>Tabagismo: {c.tabagismo==='nao_informado'?'não informado':c.tabagismo==='sim'?'fuma':'não fuma'}.</p>
  {c.motivos.length?<ul className="list-disc pl-5">{c.motivos.map(m=><li key={m}>{MOTIVOS_CONTEXTO_REGISTRADO[m]}</li>)}</ul>:null}
 </div>;
}
