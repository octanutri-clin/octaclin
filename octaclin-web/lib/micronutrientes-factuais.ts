import {lerAjudaDietetica,type AjudaDietetica} from './ajuda-dietetica';
import type { CalcularCombinadoEntradaApi, CodigoMicronutrienteApi } from './plano-alimentar-api';
import { CAMPOS_MICRONUTRIENTES_PLANO } from './micronutrientes-plano';
export type EstadoCoberturaFactual = 'COMPLETO' | 'PARCIAL' | 'DESCONHECIDO' | 'INCOMPATIVEL' | 'INDISPONIVEL';
export interface LinhaMicronutrienteFactual {
  codigo: CodigoMicronutrienteApi; rotulo: string; unidade: 'mg' | 'mcg'; grupo: 'minerais' | 'vitaminas';
  estado: EstadoCoberturaFactual; valor?: number;
  contagens: { incluidos: number; conhecidos: number; semComposicao: number; incompativeis: number; naoResolvidos: number };
  causas: { codigo: string; quantidade: number }[];
  /** Origem registrada dos alimentos com valor conhecido; ausente quando a resposta não a traz. */
  origem?: OrigemNutrienteFactual;
}
export const TIPOS_FONTE_FACTUAL = ['TACO','USDA','IBGE','manual','custom'] as const;
export type TipoFonteFactual = typeof TIPOS_FONTE_FACTUAL[number];
export interface FonteNutrienteFactual { tipo: TipoFonteFactual; codigo?: string; versao?: string; quantidade: number }
export interface OrigemNutrienteFactual { contribuintes: number; fontes: FonteNutrienteFactual[]; semOrigemDocumentada: number; fontesNaoDetalhadas: number }
export const LIMITE_GRUPOS_FONTE_FACTUAL = 50;
export const ROTULOS_FONTE_FACTUAL: Readonly<Record<TipoFonteFactual,string>> = Object.freeze({
  TACO:'TACO', USDA:'USDA', IBGE:'IBGE', manual:'Entrada manual', custom:'Alimento personalizado'
});
const ROTULOS_CODIGO_FONTE: Readonly<Record<string,string>> = Object.freeze({
  taco_nepa_unicamp:'NEPA/Unicamp', usda_fdc_foundation:'Foundation Foods', usda_fdc_sr_legacy:'SR Legacy', ibge_pof_2008_2009:'POF 2008-2009'
});
/** Sufixo curto, só para a linha compacta da tabela. */
const ROTULOS_CURTOS_CODIGO_FONTE: Readonly<Record<string,string>> = Object.freeze({
  taco_nepa_unicamp:'', usda_fdc_foundation:' Foundation', usda_fdc_sr_legacy:' SR Legacy', ibge_pof_2008_2009:''
});
export function rotuloQuantidadeAlimentos(n: number): string { return `${n} ${n===1?'alimento':'alimentos'}`; }
const rotuloFontes=(n:number)=>`${n} ${n===1?'fonte':'fontes'}`;
const ehEntradaDigitada=(f: FonteNutrienteFactual)=>f.tipo==='manual'||f.tipo==='custom';
/** Base catalogada cujo código este sistema não reconhece. Nunca presume nome ou direitos. */
export function fonteNaoCatalogada(f: FonteNutrienteFactual): boolean {
  return !ehEntradaDigitada(f) && f.codigo!==undefined && !Object.hasOwn(ROTULOS_CODIGO_FONTE,f.codigo);
}
function classeDeExibicao(f: FonteNutrienteFactual): number {
  return f.tipo==='manual'?0:f.tipo==='custom'?1:fonteNaoCatalogada(f)?2:3;
}
/** Ordem única para a linha, os detalhes e o relatório: entrada manual, personalizado, não catalogada e bases. */
export function ordenarFontesParaExibicao(fontes: FonteNutrienteFactual[]): FonteNutrienteFactual[] {
  const bin=(a:string,b:string)=>a<b?-1:a>b?1:0;
  return [...fontes].sort((a,b)=>classeDeExibicao(a)-classeDeExibicao(b) || b.quantidade-a.quantidade ||
    bin(a.tipo,b.tipo) || bin(a.codigo??'',b.codigo??'') || (a.versao??'').localeCompare(b.versao??'','pt-BR',{numeric:true}) || bin(a.versao??'',b.versao??''));
}
/** Texto único para tabela, detalhes e relatório. Versão ausente permanece "não informada". */
export function descreverFonteFactual(f: FonteNutrienteFactual): string {
  const partes: string[] = [ROTULOS_FONTE_FACTUAL[f.tipo]];
  if (!ehEntradaDigitada(f)) {
    if (f.codigo) partes.push(fonteNaoCatalogada(f) ? `Fonte não catalogada (código ${f.codigo})` : ROTULOS_CODIGO_FONTE[f.codigo]!);
    partes.push(f.versao ? `versão ${f.versao}` : 'versão não informada');
  }
  partes.push(rotuloQuantidadeAlimentos(f.quantidade));
  return partes.join(' · ');
}
export function rotuloCurtoFonteFactual(f: FonteNutrienteFactual): string {
  return `${f.tipo}${ROTULOS_CURTOS_CODIGO_FONTE[f.codigo??'']??''} ${f.versao??'versão não informada'}`;
}
export interface ResumoOrigemLinha { excecoes: { texto: string; atencao: boolean }[]; fontes: string[] }
/**
 * Resumo para a linha da tabela. Exceções (entrada digitada, sem origem, não catalogada, fontes não detalhadas)
 * ficam integrais e fora do "+N"; só bases catalogadas e reconhecidas entram na linha de origem.
 * Sem alimento conhecido não há resumo: um traço poderia ser lido como zero.
 */
export function resumirOrigemLinha(o: OrigemNutrienteFactual): ResumoOrigemLinha | undefined {
  if (o.contribuintes===0) return undefined;
  const ordenadas=ordenarFontesParaExibicao(o.fontes), excecoes: ResumoOrigemLinha['excecoes']=[];
  const soma=(tipo:string)=>ordenadas.filter(f=>f.tipo===tipo).reduce((n,f)=>n+f.quantidade,0);
  if (soma('manual')) excecoes.push({texto:`Inclui entrada manual (${rotuloQuantidadeAlimentos(soma('manual'))})`,atencao:false});
  if (soma('custom')) excecoes.push({texto:`Inclui alimento personalizado (${rotuloQuantidadeAlimentos(soma('custom'))})`,atencao:false});
  if (o.semOrigemDocumentada>0) excecoes.push({texto:`${rotuloQuantidadeAlimentos(o.semOrigemDocumentada)} sem origem documentada`,atencao:true});
  const naoCatalogadas=ordenadas.filter(fonteNaoCatalogada).length;
  if (naoCatalogadas>0) excecoes.push({texto:`${naoCatalogadas} ${naoCatalogadas===1?'fonte não catalogada':'fontes não catalogadas'}`,atencao:true});
  if (o.fontesNaoDetalhadas>0) excecoes.push({texto:`${rotuloQuantidadeAlimentos(o.fontesNaoDetalhadas)} em fontes adicionais não detalhadas`,atencao:true});
  return {excecoes,fontes:ordenadas.filter(f=>classeDeExibicao(f)===3).map(rotuloCurtoFonteFactual)};
}
export function formatarFontesCurtas(fontes: string[], limite: number): string {
  const visiveis=fontes.slice(0,limite), resto=fontes.length-visiveis.length;
  return visiveis.join(' · ')+(resto>0?` · +${rotuloFontes(resto)}`:'');
}
export interface AnaliseMicronutrientesFactual { ajuda?:AjudaDietetica|null; calculadoEm: string; linhas: LinhaMicronutrienteFactual[] }
export interface FiltrosMicronutrientesFactuais {
  grupo: 'todos' | 'minerais' | 'vitaminas'; cobertura: 'todas' | EstadoCoberturaFactual;
  ordem: 'nome' | 'quantidade' | 'cobertura';
}
const ESTADOS: EstadoCoberturaFactual[] = ['COMPLETO','PARCIAL','DESCONHECIDO','INCOMPATIVEL','INDISPONIVEL'];
export const CAUSAS_COBERTURA_FACTUAL: Readonly<Record<string,string>> = Object.freeze({
  sem_componentes:'Nenhum alimento ativo incluído', snapshot_indisponivel:'Composição não pôde ser lida',
  legado_sem_composicao:'Composição de micronutrientes não registrada no item', schema_nao_suportado:'Formato de composição não suportado',
  ausente:'Composição ausente', traco:'Traço sem quantidade determinada', nao_analisado:'Nutriente não analisado',
  abaixo_loq:'Quantidade abaixo do limite de quantificação', em_reavaliacao:'Dado em reavaliação',
  duplicado:'Dado nutricional duplicado', invalido:'Dado nutricional inválido', unidade_incompativel:'Unidade incompatível',
  definicao_incompativel:'Forma nutricional incompatível', estado_nao_suportado:'Estado de composição não suportado'
});
/** Categoria de contagem a que cada motivo pertence; a soma por categoria precisa fechar com as contagens. */
const CATEGORIA_CAUSA_FACTUAL: Readonly<Record<string,'semComposicao'|'incompativeis'|'naoResolvidos'>> = Object.freeze({
  ausente:'semComposicao', traco:'semComposicao', nao_analisado:'semComposicao', abaixo_loq:'semComposicao', legado_sem_composicao:'semComposicao',
  unidade_incompativel:'incompativeis', definicao_incompativel:'incompativeis',
  em_reavaliacao:'naoResolvidos', duplicado:'naoResolvidos', invalido:'naoResolvidos', estado_nao_suportado:'naoResolvidos',
  snapshot_indisponivel:'naoResolvidos', schema_nao_suportado:'naoResolvidos'
});
function falhar(): never { throw new Error('Não foi possível interpretar a análise factual. Atualize a seleção e tente novamente.'); }
function objeto(v: unknown): Record<string,unknown> { if (!v || typeof v!=='object' || Array.isArray(v)) return falhar(); return v as Record<string,unknown>; }
function inteiro(v: unknown): v is number { return Number.isSafeInteger(v) && (v as number)>=0 && (v as number)<=10000; }
function numero(v: unknown): v is number { return typeof v==='number' && Number.isFinite(v) && v>=0; }
/** Projeta somente dados utilizados pela tabela; não interpreta nem habilita referências. */
export function lerAnaliseMicronutrientesFactual(valor: unknown, entrada: CalcularCombinadoEntradaApi): AnaliseMicronutrientesFactual {
  const r=objeto(valor), comparacoes=objeto(r.comparacoes), cobertura=objeto(r.cobertura);
  if(r.schemaVersao!==1 || r.motorVersao!=='food06-factual-v1' || cobertura.schemaVersao!==1 ||
    comparacoes.estado!=='indisponivel' || comparacoes.motivo!=='referencias_nao_habilitadas' ||
    typeof r.calculadoEm!=='string' || !Number.isFinite(Date.parse(r.calculadoEm)) || !Array.isArray(r.publicacoes) ||
    r.publicacoes.length!==entrada.selecoes.length) return falhar();
  validarPublicacoesFactuais(r.publicacoes,entrada);
  const nutrientes=objeto(cobertura.nutrientes);
  const linhas=CAMPOS_MICRONUTRIENTES_PLANO.map(c=>lerLinhaMicronutrienteFactual(nutrientes[c.codigo],c.codigo));
  if(new Set(linhas.map(l=>l.contagens.incluidos)).size!==1)return falhar();
  if(r.fontes!==undefined){const origens=lerFontesPorNutrienteFactual(r.fontes,linhas);for(const l of linhas)l.origem=origens[l.codigo];}
  return {calculadoEm:r.calculadoEm,linhas,...(r.ajuda!==undefined?{ajuda:lerAjudaDietetica(r.ajuda)}:{})};
}
const CODIGO_FONTE_FACTUAL = /^[A-Za-z0-9_.-]{1,80}$/;
/** Mesmo formato do backend: rótulo do catálogo (ex.: `taco-4a-cmvcol-taco3-v1`), até 64 caracteres seguros. */
const VERSAO_FONTE_FACTUAL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** Valida contra a cobertura da mesma resposta e falha fechado; devolve só o que a interface usa. */
export function lerFontesPorNutrienteFactual(valor: unknown, linhas: LinhaMicronutrienteFactual[]): Record<string,OrigemNutrienteFactual> {
  const raiz=objeto(valor);
  if(raiz.schemaVersao!==1 || raiz.vinculo!=='origem_do_registro_de_composicao') return falhar();
  const nutrientes=objeto(raiz.nutrientes), resultado: Record<string,OrigemNutrienteFactual>={};
  for(const linha of linhas) {
    const n=objeto(nutrientes[linha.codigo]);
    if(!inteiro(n.contribuintes) || !inteiro(n.semOrigemDocumentada) || !inteiro(n.fontesNaoDetalhadas) ||
      !Array.isArray(n.fontes) || n.fontes.length>LIMITE_GRUPOS_FONTE_FACTUAL ||
      n.contribuintes!==linha.contagens.conhecidos) return falhar();
    const chaves=new Set<string>();
    const fontes=n.fontes.map(v=>{
      const f=objeto(v);
      if(!(TIPOS_FONTE_FACTUAL as readonly unknown[]).includes(f.tipo) || !inteiro(f.quantidade) || f.quantidade<1) return falhar();
      const tipo=f.tipo as TipoFonteFactual, catalogo=tipo!=='manual'&&tipo!=='custom';
      if(!catalogo && (f.codigo!==undefined || f.versao!==undefined)) return falhar();
      if(f.codigo!==undefined && (typeof f.codigo!=='string' || !CODIGO_FONTE_FACTUAL.test(f.codigo))) return falhar();
      if(f.versao!==undefined && (typeof f.versao!=='string' || !VERSAO_FONTE_FACTUAL.test(f.versao))) return falhar();
      const chave=JSON.stringify([tipo,f.codigo,f.versao]);
      if(chaves.has(chave)) return falhar();
      chaves.add(chave);
      return {tipo,...(f.codigo!==undefined?{codigo:f.codigo as string}:{}),...(f.versao!==undefined?{versao:f.versao as string}:{}),quantidade:f.quantidade};
    });
    if(fontes.reduce((soma,f)=>soma+f.quantidade,0)+n.semOrigemDocumentada+n.fontesNaoDetalhadas!==n.contribuintes) return falhar();
    resultado[linha.codigo]={contribuintes:n.contribuintes,fontes,semOrigemDocumentada:n.semOrigemDocumentada,fontesNaoDetalhadas:n.fontesNaoDetalhadas};
  }
  return resultado;
}
export function validarPublicacoesFactuais(valor:unknown,entrada:CalcularCombinadoEntradaApi):void {
  if(!Array.isArray(valor)||valor.length!==entrada.selecoes.length)return falhar();
  const recebidas=new Set<string>();
  for(const publicacao of valor) {
    const p=objeto(publicacao);
    if(typeof p.planoId!=='string' || typeof p.versaoId!=='string' || recebidas.has(p.planoId.toLowerCase())) return falhar();
    recebidas.add(p.planoId.toLowerCase());
    if(!entrada.selecoes.some(s=>s.planoId.toLowerCase()===String(p.planoId).toLowerCase() &&
      s.versaoIdEsperada.toLowerCase()===String(p.versaoId).toLowerCase() && s.ativacaoRevisaoEsperada===p.ativacaoRevisao)) return falhar();
  }
}
export function lerLinhaMicronutrienteFactual(valor: unknown, codigo: CodigoMicronutrienteApi): LinhaMicronutrienteFactual {
  const campo=CAMPOS_MICRONUTRIENTES_PLANO.find(c=>c.codigo===codigo);
  if(!campo)return falhar();
  const nutrientes={ [codigo]:valor };
  const minerais=new Set(['calcioMg','magnesioMg','manganesMg','fosforoMg','ferroMg','potassioMg','cobreMg','zincoMg','selenioMcg']);
    const n=objeto(nutrientes[campo.codigo]),c=objeto(n.contagens);
    if(n.codigo!==campo.codigo || n.unidade!==campo.unidade || !ESTADOS.includes(n.estado as EstadoCoberturaFactual)) return falhar();
    const chaves=['incluidos','conhecidos','semComposicao','incompativeis','naoResolvidos'] as const;
    if(chaves.some(k=>!inteiro(c[k])) || c.incluidos!==(c.conhecidos as number)+(c.semComposicao as number)+(c.incompativeis as number)+(c.naoResolvidos as number)) return falhar();
    const contagens=Object.fromEntries(chaves.map(k=>[k,c[k]])) as unknown as LinhaMicronutrienteFactual['contagens'];
    const estado=n.estado as EstadoCoberturaFactual;
    if(estado==='COMPLETO' && (!contagens.incluidos || contagens.conhecidos!==contagens.incluidos)) return falhar();
    if(estado==='PARCIAL' && (!contagens.conhecidos || contagens.conhecidos===contagens.incluidos)) return falhar();
    if(estado==='DESCONHECIDO' && contagens.conhecidos!==0) return falhar();
    if(estado!=='COMPLETO' && n.total!==undefined) return falhar();
    const valorConhecido=estado==='COMPLETO'?n.total:n.quantidadeConhecida;
    if(contagens.conhecidos>0 ? !numero(valorConhecido) : valorConhecido!==undefined) return falhar();
    if(!Array.isArray(n.causas) || n.causas.length>Object.keys(CAUSAS_COBERTURA_FACTUAL).length) return falhar();
    const causas=n.causas.map(v=>{
      const causa=objeto(v);
      if(typeof causa.codigo!=='string' || !Object.hasOwn(CAUSAS_COBERTURA_FACTUAL,causa.codigo) || !inteiro(causa.quantidade)) return falhar();
      return {codigo:causa.codigo,quantidade:causa.quantidade};
    });
    if(new Set(causas.map(c=>c.codigo)).size!==causas.length ||
      causas.reduce((s,c)=>s+c.quantidade,0)!==contagens.incluidos-contagens.conhecidos ||
      causas.some(c=>c.quantidade===0 && (c.codigo!=='sem_componentes'||contagens.incluidos!==0))) return falhar();
    const porCategoria={semComposicao:0,incompativeis:0,naoResolvidos:0};
    for(const c of causas){const categoria=CATEGORIA_CAUSA_FACTUAL[c.codigo];if(categoria)porCategoria[categoria]+=c.quantidade;}
    if(porCategoria.semComposicao!==contagens.semComposicao || porCategoria.incompativeis!==contagens.incompativeis || porCategoria.naoResolvidos!==contagens.naoResolvidos) return falhar();
    const tecnico=causas.some(c=>c.codigo==='snapshot_indisponivel'||c.codigo==='schema_nao_suportado');
    if(estado==='INCOMPATIVEL' && contagens.incompativeis===0) return falhar();
    if(estado==='INDISPONIVEL' && contagens.incluidos>0 && !tecnico) return falhar();
    if(estado!=='INDISPONIVEL' && (tecnico || contagens.incluidos===0)) return falhar();
    if(estado!=='INDISPONIVEL' && estado!=='INCOMPATIVEL' && contagens.incompativeis>0) return falhar();
    return {...campo,grupo:minerais.has(campo.codigo)?'minerais':'vitaminas',estado,contagens,causas,...(valorConhecido!==undefined?{valor:valorConhecido as number}:{})};
}

export function filtrarMicronutrientesFactuais(linhas: LinhaMicronutrienteFactual[], filtros: FiltrosMicronutrientesFactuais): LinhaMicronutrienteFactual[] {
  const nome=(a:LinhaMicronutrienteFactual,b:LinhaMicronutrienteFactual)=>a.rotulo.localeCompare(b.rotulo,'pt-BR') || a.codigo.localeCompare(b.codigo);
  return linhas.filter(l=>(filtros.grupo==='todos'||l.grupo===filtros.grupo)&&(filtros.cobertura==='todas'||l.estado===filtros.cobertura)).sort((a,b)=>{
    if(filtros.ordem==='quantidade') return Number(a.valor===undefined)-Number(b.valor===undefined) || a.unidade.localeCompare(b.unidade) || (a.valor??0)-(b.valor??0) || nome(a,b);
    if(filtros.ordem==='cobertura') return ESTADOS.indexOf(a.estado)-ESTADOS.indexOf(b.estado) || nome(a,b);
    return nome(a,b);
  });
}
export { CAMPOS_MICRONUTRIENTES_PLANO };
