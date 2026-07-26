import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const arquivos = [
  'PACOTE_JURIDICO_COMERCIAL.md',
  'MODELO_CONTRATO_CLIENTE.md',
  'POLITICA_PRIVACIDADE_RASCUNHO.md',
  'SLA_SUPORTE.md',
  'CHECKLIST_ONBOARDING_COMERCIAL.md',
  'MAPA_DADOS_E_RESPONSABILIDADES.md',
  'fase-133-checklist-juridico-comercial.md'
];

async function exigirArquivo(caminho) {
  await access(caminho, constants.R_OK);
  return readFile(caminho, 'utf8');
}

async function exigirTrechos(caminho, trechos) {
  const conteudo = await exigirArquivo(caminho);
  for (const trecho of trechos) {
    if (!conteudo.toLowerCase().includes(trecho.toLowerCase())) {
      throw new Error(`${caminho} deve incluir: ${trecho}`);
    }
  }
}

for (const arquivo of arquivos) {
  await exigirArquivo(arquivo);
}

await exigirTrechos('PACOTE_JURIDICO_COMERCIAL.md', [
  'Revisao juridica obrigatoria',
  'Nao autoriza o go-live',
  'Lei Geral de Protecao de Dados'
]);
await exigirTrechos('MODELO_CONTRATO_CLIENTE.md', [
  'MINUTA',
  'Revisao juridica obrigatoria',
  'tratamento de dados'
]);
await exigirTrechos('POLITICA_PRIVACIDADE_RASCUNHO.md', [
  'RASCUNHO',
  'dados pessoais sensiveis',
  'direitos do titular'
]);
await exigirTrechos('SLA_SUPORTE.md', [
  'P1',
  'P2',
  'P3',
  'P4'
]);
await exigirTrechos('MAPA_DADOS_E_RESPONSABILIDADES.md', [
  'controlador',
  'operador',
  'Revisao juridica obrigatoria'
]);

console.log('Pacote juridico/comercial documental OK.');
