import {descreverFonteFactual,fonteNaoCatalogada,formatarFontesCurtas,ordenarFontesParaExibicao,resumirOrigemLinha,rotuloQuantidadeAlimentos,type OrigemNutrienteFactual as Origem} from '@/lib/micronutrientes-factuais';

const LIMITACAO='Origem do registro de composição do alimento. Não comprova que a base mediu este nutriente nem indica confiança científica.';
export const LEGENDA_ORIGEM_TABELA='Origem registrada: do registro de composição do alimento; não prova que a base mediu o nutriente. A origem vale só para os alimentos com composição conhecida de cada nutriente.';
export const LEGENDA_ORIGEM_RELATORIO='do registro de composição; não prova medição';
export const LIMITACAO_ORIGEM_NUTRIENTE=LIMITACAO;

/**
 * Resumo na própria linha da tabela. Exceções primeiro, integrais e com ícone e texto (nunca só cor);
 * depois a origem das bases catalogadas. Sem alimento conhecido não há linha.
 */
export function OrigemNutrienteLinha({origem}:{origem?:Origem}) {
  const resumo=origem?resumirOrigemLinha(origem):undefined;
  if(!resumo)return null;
  return <div className="grid gap-0.5 text-sm" data-origem-linha="true">
    {resumo.excecoes.map(e=><p key={e.texto} className="font-medium"><span aria-hidden="true">{e.atencao?'▲ ':'● '}</span>{e.texto}</p>)}
    {resumo.fontes.length?<p>
      <span className="sm:hidden">Origem registrada: {formatarFontesCurtas(resumo.fontes,1)}</span>
      <span className="hidden sm:inline">Origem registrada: {formatarFontesCurtas(resumo.fontes,2)}</span>
    </p>:null}
  </div>;
}

/** Detalhes de um nutriente. Sem headings: aparece dentro de cada linha da tabela. */
export function OrigemNutrienteFactual({origem,rotulo}:{origem?:Origem;rotulo:string}) {
  if(!origem)return <p className="text-sm">Origem por nutriente não disponibilizada nesta resposta.</p>;
  if(origem.contribuintes===0)return <p className="text-sm">Nenhum alimento com valor conhecido de {rotulo}: não há origem a informar.</p>;
  const fontes=ordenarFontesParaExibicao(origem.fontes);
  const temManual=fontes.some(f=>f.tipo==='manual'),temNaoCatalogada=fontes.some(fonteNaoCatalogada);
  return <div className="grid gap-1 text-sm">
    <p className="font-medium">Origem registrada · {rotuloQuantidadeAlimentos(origem.contribuintes)} com valor conhecido</p>
    <ul className="list-disc break-words pl-5">{fontes.map(f=><li key={JSON.stringify([f.tipo,f.codigo,f.versao])}>{descreverFonteFactual(f)}</li>)}</ul>
    {origem.semOrigemDocumentada>0?<p>{rotuloQuantidadeAlimentos(origem.semOrigemDocumentada)} sem origem documentada.</p>:null}
    {origem.fontesNaoDetalhadas>0?<p>{rotuloQuantidadeAlimentos(origem.fontesNaoDetalhadas)} em fontes adicionais não detalhadas.</p>:null}
    {temManual?<p>Entrada manual: valores digitados no cadastro do alimento; não vêm de uma base catalogada.</p>:null}
    {temNaoCatalogada?<p>Fonte não catalogada: o registro cita um código que este sistema não reconhece.</p>:null}
    <p>{LIMITACAO}</p>
  </div>;
}

/** Célula do relatório impresso: uma origem por linha, na mesma ordem da tabela, para quebrar bem entre páginas. */
export function OrigemNutrienteResumo({origem}:{origem?:Origem}) {
  if(!origem)return <>Não disponibilizada</>;
  if(origem.contribuintes===0)return <>Sem valor conhecido</>;
  const itens=[...ordenarFontesParaExibicao(origem.fontes).map(descreverFonteFactual)];
  if(origem.semOrigemDocumentada>0)itens.push(`${rotuloQuantidadeAlimentos(origem.semOrigemDocumentada)} sem origem documentada`);
  if(origem.fontesNaoDetalhadas>0)itens.push(`${rotuloQuantidadeAlimentos(origem.fontesNaoDetalhadas)} em fontes adicionais não detalhadas`);
  return <ul className="m-0 list-none break-words p-0">{itens.map(t=><li key={t}>{t}</li>)}</ul>;
}
