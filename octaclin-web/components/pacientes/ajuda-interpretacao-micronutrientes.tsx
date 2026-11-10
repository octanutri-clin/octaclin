import type {AjudaDietetica} from '@/lib/ajuda-dietetica';
/** Conteúdo próprio vindo do servidor, sem interpretar contexto ou habilitar cálculo. */
export function AjudaInterpretacaoMicronutrientes({ajuda,comparacaoAtiva=false}:{ajuda?:AjudaDietetica|null;comparacaoAtiva?:boolean}){
 if(ajuda===undefined)return null;
 if(ajuda===null)return <p role="status" className="text-sm text-texto-suave">O conteúdo de ajuda está indisponível. Os valores apresentados e a indicação de dados conhecidos ou desconhecidos permanecem iguais.</p>;
 return <details className="rounded-lg border border-linha p-3">
  <summary tabIndex={0} className="min-h-11 cursor-pointer py-2 font-medium text-primaria underline">Como interpretar estes valores</summary>
  <div className="grid gap-2 text-sm">
   <p>Informações gerais para o profissional. {comparacaoAtiva?'A comparação com referências desta análise foi pedida no bloco abaixo e usa as respostas informadas.':'As comparações com referências permanecem indisponíveis nesta análise.'}</p>
   {ajuda.topicos.map(t=><details key={t.codigo} className="border-t border-linha pt-2">
    <summary tabIndex={0} className="min-h-11 cursor-pointer py-2 font-medium">{t.titulo}</summary>
    <p>{t.texto}</p>{t.detalhe?<p className="mt-2 text-texto-suave">{t.detalhe}</p>:null}
   </details>)}
   <p className="text-xs text-texto-suave">Texto próprio OctaClin. Fonte das definições:</p>
   <ul>{ajuda.fontes.map(f=><li key={f.id}><a href={f.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center py-2 text-primaria underline">{f.titulo}</a></li>)}</ul>
  </div>
 </details>;
}
