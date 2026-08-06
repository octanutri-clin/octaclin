/**
 * Montagem de CSV para todas as exportacoes do produto.
 *
 * Existia um mecanismo por modulo — `campoCsv` em `servico-usuarios-cliente` e
 * `montarCsv`/`escaparCsv` em `servico-operacoes` — com regras diferentes de
 * citacao e de newline final. Este modulo consolida os dois; nao criar um
 * terceiro.
 */

/** Caracteres que fazem a planilha tratar a celula como formula. */
const INICIO_DE_FORMULA = /^[=+@\t\r-]/;

function ehNumero(valor: string): boolean {
  return valor.trim() !== '' && Number.isFinite(Number(valor));
}

/**
 * Escapa uma celula.
 *
 * Alem da citacao normal de CSV, neutraliza injecao de formula: nome de paciente
 * e observacao vem de input do usuario e vao parar numa planilha, entao um campo
 * comecando com `=`, `+`, `@` ou tab e executado pelo Excel/Sheets quando a
 * clinica abre o arquivo. O apostrofo a frente e a mitigacao padrao (OWASP).
 *
 * Numero negativo escapa da regra do hifen de proposito: `-50` e dado, nao
 * formula, e prefixa-lo quebraria qualquer coluna numerica.
 */
export function campoCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  const neutralizado = INICIO_DE_FORMULA.test(texto) && !ehNumero(texto) ? `'${texto}` : texto;

  const precisaCitar =
    neutralizado !== texto || /[",\n\r\t]/.test(neutralizado) || neutralizado.trim() !== neutralizado;

  return precisaCitar ? `"${neutralizado.replace(/"/g, '""')}"` : neutralizado;
}

export function montarCsv(cabecalho: readonly string[], linhas: readonly unknown[][]): string {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(','));
  return `${conteudo.join('\n')}\n`;
}
