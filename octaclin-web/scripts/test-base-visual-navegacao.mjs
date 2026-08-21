import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arquivo) => readFileSync(resolve(raiz, arquivo), 'utf8');

const consoleShell = ler('components/app/console-shell.tsx');
const portalShell = ler('components/app/portal-shell.tsx');
const catalogoNavegacao = ler('lib/navegacao-console.ts');
const portalPaciente = ler('components/portal/portal-paciente.tsx');
const botao = ler('components/ui/botao.tsx');
const campo = ler('components/ui/campo.tsx');

for (const grupo of ['Clínica', 'Relacionamento', 'Administração']) {
  assert.match(catalogoNavegacao, new RegExp(`'${grupo}'`), `grupo ${grupo} ausente no catalogo`);
}

for (const rotaAvancada of ['/ia', '/gamificacao']) {
  assert.match(
    catalogoNavegacao,
    new RegExp(`href: '${rotaAvancada}'`),
    `${rotaAvancada} deve estar acessivel no grupo Ferramentas`
  );
}

for (const rotaRetirada of ['/mobile']) {
  assert.doesNotMatch(
    catalogoNavegacao,
    new RegExp(`href: '${rotaRetirada}'`),
    `${rotaRetirada} nao deve ocupar a navegacao principal`
  );
}

assert.match(portalShell, /grupo\?: string/, 'shell deve aceitar grupos de navegacao');
assert.match(portalShell, /aria-current/, 'navegacao deve expor a pagina ativa');
assert.match(portalShell, /<details/, 'navegacao mobile deve usar divulgacao nativa');
assert.match(portalShell, /Módulos/, 'navegacao mobile deve nomear o menu de modulos');
assert.match(portalShell, /contextoUsuario/, 'shell deve apresentar o contexto da sessao');
assert.match(consoleShell, /#novo-agendamento/, 'console deve oferecer atalho real para novo agendamento');
assert.match(consoleShell, /#novo-paciente/, 'console deve oferecer atalho real para novo paciente');
assert.match(botao, /min-h-11/, 'botao deve atingir alvo de toque de 44px');
assert.match(campo, /min-h-11/, 'campo deve atingir alvo de toque de 44px');
assert.doesNotMatch(portalPaciente, /scoreRisco/, 'portal do paciente nao deve expor score clinico');

console.log('Base visual e navegacao: contrato aprovado.');
