import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const WORKFLOWS_DEPLOY = [
  resolve(import.meta.dirname, '..', '.github', 'workflows', 'deploy-aws.yml'),
  resolve(import.meta.dirname, '..', '.github', 'workflows', 'deploy-azure.yml'),
];

const EXPRESSAO_GITHUB = /\$\{\{/;
const INICIO_RUN = /^(\s*)(?:-\s*)?run:\s*(.*)$/;

function indentacao(linha) {
  return linha.match(/^\s*/)?.[0].length ?? 0;
}

export function expressoesGithubEmScripts(conteudo) {
  const linhas = conteudo.split(/\r?\n/);
  const ocorrencias = [];

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const inicio = linhas[indice].match(INICIO_RUN);
    if (!inicio) continue;

    const indentacaoRun = inicio[1].length;
    const valorInline = inicio[2].trim();

    if (valorInline && !/^[>|][+-]?$/.test(valorInline) && EXPRESSAO_GITHUB.test(valorInline)) {
      ocorrencias.push(indice + 1);
    }

    if (!/^[>|][+-]?$/.test(valorInline)) continue;

    for (let cursor = indice + 1; cursor < linhas.length; cursor += 1) {
      const linha = linhas[cursor];
      if (linha.trim() && indentacao(linha) <= indentacaoRun) break;
      if (EXPRESSAO_GITHUB.test(linha)) ocorrencias.push(cursor + 1);
    }
  }

  return ocorrencias;
}

export function validarConteudoWorkflowSemInjecao(conteudo, arquivo = 'workflow.yml') {
  const ocorrencias = expressoesGithubEmScripts(conteudo);
  if (ocorrencias.length > 0) {
    throw new Error(
      `${arquivo}: expressoes GitHub nao podem ser interpoladas diretamente em run (linhas ${ocorrencias.join(', ')})`,
    );
  }
}

export function validarWorkflowsDeploy(caminhos = WORKFLOWS_DEPLOY) {
  for (const caminho of caminhos) {
    validarConteudoWorkflowSemInjecao(readFileSync(caminho, 'utf8'), caminho);
  }

  return `Workflows de deploy sem interpolacao direta em scripts: ${caminhos.length}.`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(validarWorkflowsDeploy());
}
