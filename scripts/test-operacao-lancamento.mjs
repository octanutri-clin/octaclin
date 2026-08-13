import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  avaliarGateLancamento,
  classificarIncidente,
  executarExercicioSintetico
} from './operacao-lancamento.mjs';

const gateSaudavel = avaliarGateLancamento({
  readiness: true,
  dependencias: true,
  web: true,
  backupRecente: true,
  migracoesPendentes: 0,
  incidentesP0P1Abertos: 0,
  responsaveisConfirmados: true,
  juridicoLiberado: true,
  identidadePublicaLiberada: true
});
assert.equal(gateSaudavel.decisao, 'GO');
assert.deepEqual(gateSaudavel.bloqueios, []);

const gateBloqueado = avaliarGateLancamento({
  readiness: true,
  dependencias: false,
  web: true,
  backupRecente: false,
  migracoesPendentes: 1,
  incidentesP0P1Abertos: 1,
  responsaveisConfirmados: false,
  juridicoLiberado: false,
  identidadePublicaLiberada: false
});
assert.equal(gateBloqueado.decisao, 'NO-GO');
assert.deepEqual(gateBloqueado.bloqueios, [
  'dependencias_nao_saudaveis',
  'backup_nao_confirmado',
  'migracoes_pendentes',
  'incidente_critico_aberto',
  'responsaveis_nao_confirmados',
  'juridico_nao_liberado',
  'identidade_publica_nao_liberada'
]);

assert.equal(classificarIncidente({ indisponibilidadeGeral: true }).severidade, 'P0');
assert.equal(classificarIncidente({ suspeitaDados: true }).severidade, 'P0');
assert.equal(classificarIncidente({ tenantCriticoIndisponivel: true }).severidade, 'P1');
assert.equal(classificarIncidente({ degradacaoComAlternativa: true }).severidade, 'P2');
assert.equal(classificarIncidente({ duvidaSemImpacto: true }).severidade, 'P3');

const exercicio = executarExercicioSintetico();
assert.equal(exercicio.sintetico, true);
assert.equal(exercicio.resultado, 'aprovado');
assert.equal(exercicio.severidade, 'P0');
assert.equal(exercicio.acaoPrimaria, 'rollback_deploy');
assert.equal(exercicio.dadosReais, false);
assert.ok(exercicio.marcos.every((marco) => marco.minuto <= marco.limiteMinutos));
assert.equal(exercicio.criterios.recuperacaoConfirmadaPorDuasLeituras, true);
assert.equal(exercicio.criterios.comunicacaoSemDadosSensiveis, true);

const arquivos = await Promise.all([
  readFile(new URL('../RUNBOOK_LANCAMENTO.md', import.meta.url), 'utf8'),
  readFile(new URL('../OPERACAO_LANCAMENTO_CONTROLE.md', import.meta.url), 'utf8'),
  readFile(new URL('../fase-232-operacao-lancamento.md', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);
const [runbook, controle, fase, workflow, pacote] = arquivos;

for (const marcador of [
  'America/Sao_Paulo',
  'T-24h',
  'T-30min',
  'GO',
  'NO-GO',
  'P0',
  'P1',
  '/health/pronto',
  'rollback',
  'comunicacao',
  'duas leituras',
  '48 horas'
]) assert.match(runbook, new RegExp(marcador, 'i'), `Marcador ausente no runbook: ${marcador}`);

for (const marcador of [
  'Responsavel primario',
  'Janela do piloto',
  'Checklist T-24h',
  'Checklist T-30min',
  'Exercicio sintetico',
  'Decisao atual'
]) assert.match(controle, new RegExp(marcador, 'i'), `Marcador ausente no controle: ${marcador}`);

assert.match(fase, /Fase 232/i);
assert.match(fase, /exercicio sintetico/i);
assert.match(workflow, /Operacao de lancamento/);
assert.match(workflow, /node scripts\/test-operacao-lancamento\.mjs/);
assert.equal(JSON.parse(pacote).scripts['test:lancamento'], 'node scripts/test-operacao-lancamento.mjs');

console.log('Contrato da operacao de lancamento validado.');
