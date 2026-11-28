export type SecaoErroCadastro = 'basicos' | 'identificacao' | 'contato' | 'operacao' | 'fiscal';
export interface ErroCampoCadastro { campo: string; mensagem: string; }
export interface FalhaPublicaCadastro {
  status?: number;
  mensagem: string;
  campos: ErroCampoCadastro[];
  temErrosGerais: boolean;
}
export const CAMPOS_CADASTRO: ReadonlyArray<Readonly<{ campo: string; rotulo: string }>>;
export function projetarFalhaCadastro(status: number | undefined, corpo?: unknown, secao?: SecaoErroCadastro): FalhaPublicaCadastro;
