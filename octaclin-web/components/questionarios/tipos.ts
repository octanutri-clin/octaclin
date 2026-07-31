export type TipoPergunta =
  | 'likert'
  | 'multipla_escolha'
  | 'linear'
  | 'metrica'
  | 'upload_midia'
  | 'texto_longo'
  | 'sim_nao';

export interface CategoriaPergunta {
  id: string;
  nome: string;
  corHex: string;
}

export interface PerguntaEditor {
  id: string;
  tipo: TipoPergunta;
  categoriaId: string;
  enunciado: string;
  peso: number;
  obrigatoria: boolean;
  configuracao: Record<string, unknown>;
  opcoes: OpcaoPerguntaEditor[];
  ordem: number;
  chaveClinica?: string;
  visivelBiblioteca?: boolean;
}

export interface OpcaoPerguntaEditor {
  id?: string;
  rotulo: string;
  valor: string;
  imagemUrl?: string;
  ordem: number;
}
