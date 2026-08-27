import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHA_COMPLETO = /^[0-9a-f]{40}$/i;
const LINHA_USES = /^\s*(?:-\s*)?uses:\s*(.*?)\s*$/;

export const DIRETORIO_WORKFLOWS = resolve(import.meta.dirname, '..', '.github', 'workflows');

export function validarReferenciaAction(referencia, comentario, origem) {
  const valor = referencia.replace(/^['"]|['"]$/g, '');

  if (valor.startsWith('./')) return;

  const separador = valor.lastIndexOf('@');
  const revisao = separador >= 0 ? valor.slice(separador + 1) : '';

  if (!SHA_COMPLETO.test(revisao)) {
    throw new Error(`${origem}: action remota deve usar SHA completo de 40 caracteres: ${valor}`);
  }

  if (!comentario?.trim()) {
    throw new Error(`${origem}: action fixada deve manter comentario de versao para o Dependabot: ${valor}`);
  }
}

export function validarConteudoWorkflow(conteudo, arquivo = 'workflow.yml') {
  const linhas = conteudo.split(/\r?\n/);
  let referencias = 0;

  for (const [indice, linha] of linhas.entries()) {
    if (!linha.includes('uses:') || linha.trimStart().startsWith('#')) continue;

    const correspondencia = linha.match(LINHA_USES);
    if (!correspondencia) {
      throw new Error(`${arquivo}:${indice + 1}: declaracao uses deve ocupar uma linha propria`);
    }

    const separadorComentario = correspondencia[1].indexOf(' #');
    const referencia = separadorComentario >= 0
      ? correspondencia[1].slice(0, separadorComentario).trim()
      : correspondencia[1].trim();
    const comentario = separadorComentario >= 0
      ? correspondencia[1].slice(separadorComentario + 2).trim()
      : undefined;

    referencias += 1;
    validarReferenciaAction(referencia, comentario, `${arquivo}:${indice + 1}`);
  }

  return referencias;
}

export function validarWorkflows(diretorio = DIRETORIO_WORKFLOWS) {
  const arquivos = readdirSync(diretorio)
    .filter((arquivo) => /\.ya?ml$/i.test(arquivo))
    .sort();
  let referencias = 0;

  for (const arquivo of arquivos) {
    referencias += validarConteudoWorkflow(readFileSync(resolve(diretorio, arquivo), 'utf8'), arquivo);
  }

  return `Actions imutaveis validas: ${referencias} referencias em ${arquivos.length} workflows.`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(validarWorkflows());
}
