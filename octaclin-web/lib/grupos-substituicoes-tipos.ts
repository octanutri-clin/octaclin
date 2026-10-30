import type { MicronutrientesPor100gApi, NutrientesPor100gApi } from './plano-alimentar-api';
export type EscopoGrupoSubstituicoes = 'pessoal' | 'clinica';
export interface EntradaGrupoSubstituicoes {
  id: string; origem: 'catalogo'|'custom'; alimentoId: string; revisao?: number;
  quantidade: number; unidade: string; porcaoGramas: number;
}
export interface ConteudoGrupoSubstituicoes {
  nome: string; descricao?: string; categoria?: string; etiquetas?: string[]; entradas: EntradaGrupoSubstituicoes[];
}
export interface GrupoSubstituicoesResumo {
  id: string; nome: string; descricao?: string; categoria?: string; etiquetas: string[];
  escopo: EscopoGrupoSubstituicoes; estado: 'ativo'|'arquivado'; revisao: number;
  quantidadeEntradas: number; podeEditar: boolean; favorito: boolean;
}
export interface AlternativaGrupoDisponivel extends EntradaGrupoSubstituicoes {
  disponivel: boolean; motivo?: string;
  composicao: { descricao: string; nutrientesPor100g: Partial<NutrientesPor100gApi>;
    micronutrientesPor100g?: MicronutrientesPor100gApi; fonte?: { codigo: string; versao: string; hashConteudo: string } };
}
export interface AlternativaGrupoIndisponivel { id: string; disponivel: false; motivo: string }
export interface GrupoSubstituicoesDetalhe extends GrupoSubstituicoesResumo {
  entradas: Array<AlternativaGrupoDisponivel|AlternativaGrupoIndisponivel>;
}
export interface CriarGrupoSubstituicoesEntrada { chaveIdempotencia: string; escopo?: EscopoGrupoSubstituicoes; conteudo: ConteudoGrupoSubstituicoes }
export type AtualizarGrupoSubstituicoesEntrada = { revisaoEsperada: number } & (
  { conteudo: ConteudoGrupoSubstituicoes; estado?: never; escopo?: never } |
  { estado: 'ativo'|'arquivado'; conteudo?: never; escopo?: never } |
  { escopo: 'clinica'; conteudo?: never; estado?: never }
);
export interface DuplicarGrupoSubstituicoesEntrada extends CriarGrupoSubstituicoesEntrada { revisaoEsperada: number }
export interface ConsultaGruposSubstituicoes {
  pagina?: number; limite?: number; escopo?: EscopoGrupoSubstituicoes; estado?: 'ativo'|'arquivado'|'todos';
  favoritos?: boolean; busca?: string; categoria?: string; etiqueta?: string;
}
export interface IntencaoGrupoSubstituicoesEdicao {
  grupoId: string; revisao: number; entradaId: string; aplicacaoId: string; confirmarPorcaoDistinta?: boolean;
}

export type FonteGrupoSubstituicoes = Pick<AlternativaGrupoDisponivel,'origem'|'alimentoId'|'revisao'|'composicao'> & { id:string;nome:string };
