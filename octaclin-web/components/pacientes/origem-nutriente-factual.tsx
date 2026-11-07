import {descreverFonteFactual,rotuloQuantidadeAlimentos,type OrigemNutrienteFactual as Origem} from '@/lib/micronutrientes-factuais';

const LIMITACAO='Origem do registro de composição do alimento. Não comprova que a base mediu este nutriente nem indica confiança científica.';

/** Detalhes de um nutriente. Sem headings: aparece dentro de cada linha da tabela. */
export function OrigemNutrienteFactual({origem,rotulo}:{origem?:Origem;rotulo:string}) {
  if(!origem)return <p className="text-sm text-texto-suave">Origem por nutriente não disponibilizada nesta resposta.</p>;
  if(origem.contribuintes===0)return <p className="text-sm text-texto-suave">Nenhum alimento com valor conhecido de {rotulo}: não há origem a informar.</p>;
  return <div className="grid gap-1 text-sm">
    <p className="font-medium">Origem registrada · {rotuloQuantidadeAlimentos(origem.contribuintes)} com valor conhecido</p>
    <ul className="list-disc pl-5">{origem.fontes.map(f=><li key={JSON.stringify([f.tipo,f.codigo,f.versao])}>{descreverFonteFactual(f)}</li>)}</ul>
    {origem.semOrigemDocumentada>0?<p>{rotuloQuantidadeAlimentos(origem.semOrigemDocumentada)} sem origem documentada.</p>:null}
    {origem.fontesNaoDetalhadas>0?<p>{rotuloQuantidadeAlimentos(origem.fontesNaoDetalhadas)} em fontes adicionais não detalhadas.</p>:null}
    <p className="text-xs text-texto-suave">{LIMITACAO}</p>
  </div>;
}

/** Versão compacta para a tabela do relatório impresso. */
export function OrigemNutrienteResumo({origem}:{origem?:Origem}) {
  if(!origem)return <>Não disponibilizada</>;
  if(origem.contribuintes===0)return <>Sem valor conhecido</>;
  const partes=[...origem.fontes.map(descreverFonteFactual)];
  if(origem.semOrigemDocumentada>0)partes.push(`${rotuloQuantidadeAlimentos(origem.semOrigemDocumentada)} sem origem documentada`);
  if(origem.fontesNaoDetalhadas>0)partes.push(`${rotuloQuantidadeAlimentos(origem.fontesNaoDetalhadas)} em fontes adicionais não detalhadas`);
  return <>{partes.join('; ')}</>;
}
export const LIMITACAO_ORIGEM_NUTRIENTE=LIMITACAO;
