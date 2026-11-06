'use client';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {consultarTeorCatalogo} from '@/lib/consulta-teor-catalogo-api';
import {lerEntradaConsultaTeor,type EntradaConsultaTeor,type ResultadoConsultaTeor} from '@/lib/consulta-teor-catalogo';
import {ErroApiPlanoAlimentar,type CodigoMicronutrienteApi} from '@/lib/plano-alimentar-api';
import {CAMPOS_MICRONUTRIENTES_PLANO,formatarNutrientePlano} from '@/lib/micronutrientes-plano';
import {CAUSAS_COBERTURA_FACTUAL} from '@/lib/micronutrientes-factuais';
interface Props{permitido:boolean;aoInvalidar:(status:number)=>void}
const classeCampo='min-h-11 min-w-0 rounded border border-linha bg-white px-2';
const classeBotao='min-h-11 rounded border border-linha px-3 text-primaria disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria';
const formatarGramas=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v);
function valorApresentado(codigo:string,valor:number|undefined,positivoAbaixo:boolean|undefined,unidade:string){
 if(positivoAbaixo)return `Positivo abaixo da precisão de cálculo (${unidade})`;
 return valor===undefined?'—':`${formatarNutrientePlano(codigo,valor)} ${unidade}`;
}
/** O pai remonta este painel ao trocar paciente, seleção ou permissão de leitura. */
export function ConsultaTeorCatalogo({permitido,aoInvalidar}:Props){
 const id=useId();const [aberta,setAberta]=useState(false),[busca,setBusca]=useState(''),[codigo,setCodigo]=useState<CodigoMicronutrienteApi>('ferroMg'),[porcao,setPorcao]=useState('50'),[fonte,setFonte]=useState('');
 const [carregando,setCarregando]=useState(false),[erro,setErro]=useState<string>(),[resultado,setResultado]=useState<{pedido:EntradaConsultaTeor;dados:ResultadoConsultaTeor}>();
 const tentativa=useRef(0),controle=useRef<AbortController|null>(null);
 useEffect(()=>()=>{tentativa.current++;controle.current?.abort();},[permitido]);
 function limpar(){tentativa.current++;controle.current?.abort();controle.current=null;setResultado(undefined);setErro(undefined);setCarregando(false);}
 async function consultar(pagina=1,pedidoAnterior?:EntradaConsultaTeor){
  limpar();if(!permitido)return;
  let pedido:EntradaConsultaTeor;
  try{
   const texto=porcao.trim().replace(',','.');if(!/^\d+(?:\.\d{1,3})?$/.test(texto))throw new Error();
   pedido=lerEntradaConsultaTeor(pedidoAnterior?{...pedidoAnterior,pagina}:{codigo,porcaoGramas:Number(texto),busca,pagina,limite:20,...(fonte?{fonteCodigo:fonte}:{})});
  }catch{setErro('Informe ao menos dois caracteres no nome e uma porção de 0,001 a 10.000 g, com até três casas decimais.');return;}
  const atual=tentativa.current,controller=new AbortController();controle.current=controller;setCarregando(true);
  try{
   const dados=await consultarTeorCatalogo(pedido,controller.signal);
   if(!controller.signal.aborted&&tentativa.current===atual)setResultado({pedido,dados});
  }catch(e:unknown){
   if(!controller.signal.aborted&&tentativa.current===atual){
    setErro('Não foi possível consultar o catálogo. Confira os dados e tente novamente.');
    if(e instanceof ErroApiPlanoAlimentar&&[401,403].includes(e.status))aoInvalidar(e.status);
   }
  }finally{if(tentativa.current===atual&&!controller.signal.aborted){setCarregando(false);controle.current=null;}}
 }
 const dados=permitido?resultado?.dados:undefined;
 function enviar(e:FormEvent){e.preventDefault();void consultar();}
 return <section aria-label="Consulta de composição do catálogo" className="grid min-w-0 gap-3 rounded border border-linha p-3">
  <button type="button" className="min-h-11 text-left font-semibold text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" disabled={!permitido} aria-expanded={aberta} aria-controls={id} onClick={()=>{limpar();setAberta(v=>!v);}}>{aberta?'Fechar consulta de alimentos':'Consultar alimentos por micronutriente'}</button>
  {!permitido?<p role="status">Consulta indisponível: atualize a seleção e confira o acesso.</p>:null}
  <div id={id} hidden={!aberta}>
   {aberta&&permitido?<div className="grid min-w-0 gap-3">
    <p className="text-sm">Consulta de composição: não altera o plano nem avalia a adequação ou a compatibilidade com restrições do paciente.</p>
    <form onSubmit={enviar} noValidate className="grid min-w-0 gap-3">
     <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-1 text-sm">Nome do alimento<input className={classeCampo} value={busca} maxLength={120} onChange={e=>{limpar();setBusca(e.target.value);}}/></label>
      <label className="grid min-w-0 gap-1 text-sm">Nutriente consultado<select className={classeCampo} value={codigo} onChange={e=>{limpar();setCodigo(e.target.value as CodigoMicronutrienteApi);}}>{CAMPOS_MICRONUTRIENTES_PLANO.map(c=><option key={c.codigo} value={c.codigo}>{c.rotulo} ({c.unidade})</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-sm">Porção comum (g)<input className={classeCampo} inputMode="decimal" value={porcao} maxLength={12} onChange={e=>{limpar();setPorcao(e.target.value);}} aria-describedby={`${id}-porcao`}/></label>
      <label className="grid min-w-0 gap-1 text-sm">Fonte de composição<select className={classeCampo} value={fonte} onChange={e=>{limpar();setFonte(e.target.value);}}><option value="">Todas as fontes disponíveis</option><option value="taco_nepa_unicamp">TACO</option><option value="usda_fdc_foundation">USDA Foundation</option><option value="usda_fdc_sr_legacy">USDA SR Legacy</option><option value="ibge_pof_2008_2009">IBGE POF 2008–2009</option></select></label>
     </div>
     <p id={`${id}-porcao`} className="text-xs text-texto-suave">Use de 0,001 a 10.000 g, com até três casas decimais. A mesma porção será usada para todos os alimentos.</p>
     <div className="flex flex-wrap gap-2"><button type="submit" className={classeBotao} disabled={carregando}>Consultar</button>{carregando?<button type="button" className={classeBotao} onClick={limpar}>Cancelar consulta</button>:null}</div>
    </form>
    {carregando?<p role="status">Consultando composição do catálogo…</p>:null}
    {erro?<p role="alert">{erro}</p>:null}
    {dados&&resultado?<>
     <p role="status">Página {dados.paginacao.pagina}. {dados.itens.length} alimentos exibidos. Porção consultada: {formatarGramas(dados.porcaoGramas)} g.</p>
     <p className="text-sm">Teor ordenado somente entre os alimentos desta página. As páginas são selecionadas por nome e identificador; avançar não continua uma lista de maior teor.</p>
     <p className="text-xs text-texto-suave">Catálogo atual, sujeito a alterações entre consultas. {dados.cobertura.comValor} de {dados.cobertura.considerados} alimentos desta página com quantidade conhecida. Essa contagem não mede confiança científica.</p>
     {dados.itens.length?<><p className="text-xs text-texto-suave">Se necessário, role a tabela para consultar fonte e versão.</p><div role="region" aria-label="Tabela de composição dos alimentos, role horizontalmente se necessário" tabIndex={0} className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria">
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm"><caption className="sr-only">{CAMPOS_MICRONUTRIENTES_PLANO.find(c=>c.codigo===dados.codigo)?.rotulo}: valores por {formatarGramas(dados.porcaoGramas)} g e por 100 g</caption>
       <thead><tr>{['Alimento e preparo',`Quantidade em ${formatarGramas(dados.porcaoGramas)} g`,'Quantidade em 100 g','Composição','Fonte e versão'].map(c=><th key={c} scope="col" className="border-b border-linha p-2 align-top">{c}</th>)}</tr></thead>
       <tbody>{dados.itens.map(i=><tr key={i.alimento.id}><th scope="row" className="border-b border-linha p-2 align-top font-medium"><p>{i.alimento.nome}</p><p className="text-xs text-texto-suave">{i.alimento.preparacao??'Preparo não informado'}</p></th>
        <td className="border-b border-linha p-2 align-top tabular-nums">{valorApresentado(dados.codigo,i.nutriente.valorPorcao,i.nutriente.arredondadoParaZero?.porcao,i.nutriente.unidade)}</td>
        <td className="border-b border-linha p-2 align-top tabular-nums">{valorApresentado(dados.codigo,i.nutriente.valorPor100g,i.nutriente.arredondadoParaZero?.por100g,i.nutriente.unidade)}</td>
        <td className="border-b border-linha p-2 align-top">{i.nutriente.estado==='conhecido'?'Quantidade conhecida':CAUSAS_COBERTURA_FACTUAL[i.nutriente.estado]}</td>
        <td className="border-b border-linha p-2 align-top break-words">{i.fonte.baseCodigo} · {i.fonte.codigo} · {i.fonte.versao}</td></tr>)}</tbody>
      </table></div></>:<p>Nenhum alimento encontrado nesta página com os filtros informados.</p>}
     {dados.exclusoes.dadosInvalidos>0?<p>{dados.exclusoes.dadosInvalidos} registros desta página não puderam ser apresentados.</p>:null}
     <div className="flex flex-wrap gap-2"><button type="button" className={classeBotao} disabled={dados.paginacao.pagina<=1} onClick={()=>void consultar(dados.paginacao.pagina-1,resultado.pedido)}>Página anterior de alimentos</button><button type="button" className={classeBotao} disabled={!dados.paginacao.temProxima||dados.paginacao.pagina>=10000} onClick={()=>void consultar(dados.paginacao.pagina+1,resultado.pedido)}>Próxima página de alimentos</button></div>
     {dados.paginacao.temProxima&&dados.paginacao.pagina>=10000?<p>Limite de páginas atingido. Refine a busca.</p>:null}
    </>:null}
   </div>:null}
  </div>
 </section>;
}
