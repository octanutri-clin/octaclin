import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const matriz = resolve(raiz, 'MATRIZ_CONFIABILIDADE_TESTES.md');
const conteudo = readFileSync(matriz, 'utf8');

const referenciasObrigatorias = [
  'octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts',
  'octaclin-backend/src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts',
  'octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts',
  'octaclin-backend/src/modulos/auth/aplicacao/servico-auth.spec.ts',
  'octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts',
  'octaclin-web/scripts/test-autorizacao-rotas.mjs',
  'octaclin-web/scripts/smoke-e2e-bff.mjs',
  'octaclin-backend/src/modulos/clientes/aplicacao/servico-usuarios-cliente.spec.ts',
  'octaclin-backend/src/modulos/comunicacoes/apresentacao/controlador-comunicacoes.spec.ts',
  'octaclin-web/tests/visual/fase-196-comunicacoes-equipe.spec.mjs',
  'octaclin-backend/src/modulos/ia/aplicacao/servico-ia.spec.ts',
  'octaclin-backend/src/modulos/automacoes/aplicacao/servico-automacoes.spec.ts',
  'octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.spec.ts',
  'octaclin-backend/src/modulos/gamificacao/aplicacao/servico-gamificacao.spec.ts',
  'octaclin-web/tests/visual/fase-197-modulos-avancados.spec.mjs',
  'octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts'
];

for (const referencia of referenciasObrigatorias) {
  if (!conteudo.includes(`\`${referencia}\``)) {
    throw new Error(`A matriz nao referencia o teste critico: ${referencia}`);
  }
  if (!existsSync(resolve(raiz, referencia))) {
    throw new Error(`O teste referenciado nao existe: ${referencia}`);
  }
}

for (const risco of ['Isolamento multi-tenant', 'Autenticacao e autorizacao', 'Integracoes externas', 'BFF e sessao']) {
  if (!conteudo.includes(risco)) throw new Error(`Risco critico ausente da matriz: ${risco}`);
}

console.log(`Matriz de confiabilidade valida: ${referenciasObrigatorias.length} referencias criticas.`);
