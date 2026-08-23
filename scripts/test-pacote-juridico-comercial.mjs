import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const arquivos = [
  'PACOTE_JURIDICO_COMERCIAL.md',
  'MODELO_CONTRATO_CLIENTE.md',
  'TERMO_DE_USO_RASCUNHO.md',
  'POLITICA_PRIVACIDADE_RASCUNHO.md',
  'ANEXO_TRATAMENTO_DADOS_RASCUNHO.md',
  'REVISAO_JURIDICO_OPERACIONAL_FASE_159.md',
  'SLA_SUPORTE.md',
  'CHECKLIST_ONBOARDING_COMERCIAL.md',
  'MAPA_DADOS_E_RESPONSABILIDADES.md',
  'docs/history/phases/fase-133-checklist-juridico-comercial.md'
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
await exigirTrechos('TERMO_DE_USO_RASCUNHO.md', [
  'RASCUNHO',
  'Menores de idade',
  'Revisao juridica'
]);
await exigirTrechos('POLITICA_PRIVACIDADE_RASCUNHO.md', [
  'RASCUNHO',
  'dados pessoais sensiveis',
  'direitos do titular'
]);
await exigirTrechos('ANEXO_TRATAMENTO_DADOS_RASCUNHO.md', [
  'RASCUNHO',
  'transferencias internacionais',
  'incidentes'
]);
await exigirTrechos('REVISAO_JURIDICO_OPERACIONAL_FASE_159.md', [
  'Nao e parecer',
  'juridico',
  'Achados bloqueadores',
  'Aceite externo pendente'
]);
await exigirTrechos('SLA_SUPORTE.md', [
  'P0',
  'P1',
  'P2',
  'P3'
]);
await exigirTrechos('MAPA_DADOS_E_RESPONSABILIDADES.md', [
  'controlador',
  'operador',
  'Revisao juridica obrigatoria'
]);

console.log('Pacote juridico/comercial documental OK.');
