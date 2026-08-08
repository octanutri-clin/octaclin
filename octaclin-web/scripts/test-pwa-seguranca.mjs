import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizWeb = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raizRepositorio = resolve(raizWeb, '..');
const lerWeb = (arquivo) => readFileSync(resolve(raizWeb, arquivo), 'utf8');
const lerRepositorio = (arquivo) => readFileSync(resolve(raizRepositorio, arquivo), 'utf8');

const manifest = lerWeb('app/manifest.ts');
const serviceWorker = lerWeb('public/sw.js');
const fila = lerWeb('lib/pwa-private-queue.ts');
const auth = lerWeb('lib/auth-api.ts');
const portalApi = lerWeb('lib/portal-api.ts');
const formularioApi = lerWeb('lib/formularios-publicos-api.ts');
const portalBackend = lerRepositorio('octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts');
const formulariosBackend = lerRepositorio('octaclin-backend/src/modulos/questionarios/aplicacao/servico-questionarios.ts');

assert.match(manifest, /start_url: '\/portal'/, 'manifest deve iniciar no portal do paciente');
assert.match(manifest, /display: 'standalone'/, 'manifest deve permitir instalacao standalone');
assert.match(manifest, /192x192/, 'manifest deve declarar icone 192px');
assert.match(manifest, /512x512/, 'manifest deve declarar icone 512px');

const recursosPreCache = serviceWorker.match(/const RECURSOS_PUBLICOS = \[([\s\S]*?)\];/)?.[1] ?? '';
assert.doesNotMatch(recursosPreCache, /\/portal|\/api\//, 'precache nao pode conter pagina protegida nem API');
assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)\) return/, 'API deve sair antes de qualquer cache');
assert.match(serviceWorker, /requisicao\.mode === 'navigate'[\s\S]*fetch\(requisicao\)\.catch\(\(\) => caches\.match\('\/offline'\)\)/, 'navegacao deve usar rede com fallback neutro');

assert.match(fila, /AES-GCM/, 'fila privada deve ser cifrada com AES-GCM');
assert.match(fila, /indexedDB\.deleteDatabase/, 'fila privada deve ser apagavel no logout');
assert.doesNotMatch(fila, /localStorage|sessionStorage/, 'fila nao pode persistir chave ou dado clinico em Web Storage');
assert.match(fila, /resposta\.status === 401[\s\S]*purgarDadosPrivadosPwa/, 'sessao expirada deve purgar fila privada');
assert.match(auth, /finally[\s\S]*purgarDadosPrivadosPwa/, 'logout deve purgar dados privados mesmo quando a rede falhar');

assert.match(portalApi, /idLocal = criarIdOperacaoPwa\('checkin'\)/, 'check-in offline deve ter chave idempotente');
assert.match(portalBackend, /lock: \{ mode: 'pessimistic_write' \}/, 'check-in deve serializar repeticoes concorrentes');
assert.match(portalBackend, /SincronizacaoMobileOrm/, 'check-in deve registrar idempotencia persistente');
assert.match(portalBackend, /pacienteIdEsperado !== paciente\.id/, 'fila autenticada deve permanecer vinculada ao paciente original');
assert.match(formularioApi, /Reconecte-se antes de enviar um formulario com anexos/, 'anexo nao pode entrar na fila offline');
assert.match(formulariosBackend, /envio\?\.status === 'respondido'/, 'reenvio de formulario deve devolver resposta existente');

console.log('PWA: manifest, cache publico, fila cifrada, logout e idempotencia aprovados.');
