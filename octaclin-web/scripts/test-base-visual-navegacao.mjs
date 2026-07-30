import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arquivo) => readFileSync(resolve(raiz, arquivo), 'utf8');

const consoleShell = ler('components/app/console-shell.tsx');
const portalShell = ler('components/app/portal-shell.tsx');
const portalPaciente = ler('components/portal/portal-paciente.tsx');
const botao = ler('components/ui/botao.tsx');
const campo = ler('components/ui/campo.tsx');

for (const grupo of ['Clinica', 'Relacionamento', 'Administracao']) {
  assert.match(consoleShell, new RegExp(`grupo: '${grupo}'`), `grupo ${grupo} ausente no console`);
}

assert.match(portalShell, /grupo\?: string/, 'shell deve aceitar grupos de navegacao');
assert.match(portalShell, /aria-current/, 'navegacao deve expor a pagina ativa');
assert.match(botao, /min-h-11/, 'botao deve atingir alvo de toque de 44px');
assert.match(campo, /min-h-11/, 'campo deve atingir alvo de toque de 44px');
assert.doesNotMatch(portalPaciente, /scoreRisco/, 'portal do paciente nao deve expor score clinico');

console.log('Base visual e navegacao: contrato aprovado.');
