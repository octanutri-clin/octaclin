import {AjudaInterpretacaoMicronutrientes} from './ajuda-interpretacao-micronutrientes';
import type {PreviaMicronutrientes,ValorPrevia} from '@/lib/previa-micronutrientes-plano';
import {formatarNutrientePlano} from '@/lib/micronutrientes-plano';
const estados={COMPLETO:'Completo',PARCIAL:'Parcial',DESCONHECIDO:'Desconhecido',INCOMPATIVEL:'Incompatível',INDISPONIVEL:'Indisponível'};
function mostrar(v:ValorPrevia,codigo:string){return v.valor===undefined?estados[v.estado]:`${formatarNutrientePlano(codigo,v.valor)}${v.estado==='COMPLETO'?'':' contabilizados; total desconhecido'}`;}
/** Projeção compartilhada de fatos; não resolve fontes nem calcula composição. */
export function ComparacaoPreviaAlimentar({dados}:{dados:PreviaMicronutrientes}){
 return <>
     <AjudaInterpretacaoMicronutrientes ajuda={dados.ajuda}/>
     <p className="text-xs text-texto-suave">Fontes são conferidas como no salvamento. Diferenças podem incluir atualização de composição; não representam diagnóstico ou ingestão real. Comparações RDA, AI e UL indisponíveis.</p>
     <p className="text-xs text-texto-suave">O percentual mostra a variação em relação ao valor anterior, não a adequação nutricional.</p>
     <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label="Comparação nutricional da proposta">
      <table className="w-full text-sm"><caption className="sr-only">Antes e depois no rascunho, cobertura e diferença em relação ao próprio valor anterior</caption><thead><tr>{['Nutriente','Antes','Depois','Diferença'].map(t=><th key={t} scope="col" className="p-2 text-left">{t}</th>)}</tr></thead>
       <tbody>{dados.linhas.map(l=><tr key={l.codigo}><th scope="row" className="p-2 text-left">{l.rotulo} ({l.unidade})</th><td className="p-2">{mostrar(l.antes,l.codigo)}{l.antes.valor!==undefined?` · ${estados[l.antes.estado]}`:''}</td><td className="p-2">{mostrar(l.depois,l.codigo)}{l.depois.valor!==undefined?` · ${estados[l.depois.estado]}`:''}</td><td className="p-2">{l.delta?`${l.delta.valor>0?'+':''}${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(l.delta.valor)}${l.delta.percentual!==undefined?` (${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(l.delta.percentual)}%)`:''}`:'Indisponível'}</td></tr>)}</tbody>
      </table>
     </div>
 </>;
}
