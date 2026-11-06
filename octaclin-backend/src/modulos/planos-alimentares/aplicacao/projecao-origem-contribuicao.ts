/** Metadados do snapshot publicado, nunca do catálogo vivo ou do contexto clínico. */
export function projetarOrigemContribuicao(valor:unknown) {
  const objeto=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
  const texto=(v:unknown,max=200)=>typeof v==='string'&&v.trim()&&v.length<=max?v:undefined;
  const s=objeto(valor),f=objeto(s.fonte),micros=objeto(s.micronutrientes);
  const origem=s.origem==='catalogo'||s.origem==='manual'||s.origem==='custom'?s.origem:'nao_informada';
  const preparacao=texto(s.preparacao),codigo=texto(f.codigo,80),nome=texto(f.nome),versao=texto(f.versao,100);
  const base=micros.baseGramasOrigem;
  return {origem,...(preparacao?{preparacao}:{}),
    ...(origem==='catalogo'&&codigo&&nome&&versao?{fonte:{codigo,nome,versao}}:{}),
    ...(typeof base==='number'&&Number.isFinite(base)&&base>0?{baseGramas:base}:{})};
}
