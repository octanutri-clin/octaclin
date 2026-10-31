import type { CalcularCombinadoEntradaApi, CodigoMicronutrienteApi } from './plano-alimentar-api';
import { CAMPOS_MICRONUTRIENTES_PLANO } from './micronutrientes-plano';
export type EstadoCoberturaFactual = 'COMPLETO' | 'PARCIAL' | 'DESCONHECIDO' | 'INCOMPATIVEL' | 'INDISPONIVEL';
export interface LinhaMicronutrienteFactual {
  codigo: CodigoMicronutrienteApi; rotulo: string; unidade: 'mg' | 'mcg'; grupo: 'minerais' | 'vitaminas';
  estado: EstadoCoberturaFactual; valor?: number;
  contagens: { incluidos: number; conhecidos: number; semComposicao: number; incompativeis: number; naoResolvidos: number };
  causas: { codigo: string; quantidade: number }[];
}
export interface AnaliseMicronutrientesFactual { calculadoEm: string; linhas: LinhaMicronutrienteFactual[] }
export interface FiltrosMicronutrientesFactuais {
  grupo: 'todos' | 'minerais' | 'vitaminas'; cobertura: 'todas' | EstadoCoberturaFactual;
  ordem: 'nome' | 'quantidade' | 'cobertura';
}
const ESTADOS: EstadoCoberturaFactual[] = ['COMPLETO','PARCIAL','DESCONHECIDO','INCOMPATIVEL','INDISPONIVEL'];
export const CAUSAS_COBERTURA_FACTUAL: Readonly<Record<string,string>> = Object.freeze({
  sem_componentes:'Nenhum alimento ativo incluído', snapshot_indisponivel:'Composição não pôde ser lida',
  legado_sem_composicao:'Registro antigo sem composição detalhada', schema_nao_suportado:'Formato de composição não suportado',
  ausente:'Composição ausente', traco:'Traço sem quantidade determinada', nao_analisado:'Nutriente não analisado',
  abaixo_loq:'Quantidade abaixo do limite de quantificação', em_reavaliacao:'Dado em reavaliação',
  duplicado:'Dado nutricional duplicado', invalido:'Dado nutricional inválido', unidade_incompativel:'Unidade incompatível',
  definicao_incompativel:'Forma nutricional incompatível', estado_nao_suportado:'Estado de composição não suportado'
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
  const recebidas=new Set<string>();
  for(const publicacao of r.publicacoes) {
    const p=objeto(publicacao);
    if(typeof p.planoId!=='string' || typeof p.versaoId!=='string' || recebidas.has(p.planoId.toLowerCase())) return falhar();
    recebidas.add(p.planoId.toLowerCase());
    if(!entrada.selecoes.some(s=>s.planoId.toLowerCase()===String(p.planoId).toLowerCase() &&
      s.versaoIdEsperada.toLowerCase()===String(p.versaoId).toLowerCase() && s.ativacaoRevisaoEsperada===p.ativacaoRevisao)) return falhar();
  }
  const nutrientes=objeto(cobertura.nutrientes);
  const minerais=new Set(['calcioMg','magnesioMg','manganesMg','fosforoMg','ferroMg','potassioMg','cobreMg','zincoMg','selenioMcg']);
  const linhas=CAMPOS_MICRONUTRIENTES_PLANO.map((campo): LinhaMicronutrienteFactual=>{
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
    const tecnico=causas.some(c=>c.codigo==='snapshot_indisponivel'||c.codigo==='schema_nao_suportado');
    if(estado==='INCOMPATIVEL' && contagens.incompativeis===0) return falhar();
    if(estado==='INDISPONIVEL' && contagens.incluidos>0 && !tecnico) return falhar();
    if(estado!=='INDISPONIVEL' && (tecnico || contagens.incluidos===0)) return falhar();
    if(estado!=='INDISPONIVEL' && estado!=='INCOMPATIVEL' && contagens.incompativeis>0) return falhar();
    return {...campo,grupo:minerais.has(campo.codigo)?'minerais':'vitaminas',estado,contagens,causas,...(valorConhecido!==undefined?{valor:valorConhecido as number}:{})};
  });
  return {calculadoEm:r.calculadoEm,linhas};
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
