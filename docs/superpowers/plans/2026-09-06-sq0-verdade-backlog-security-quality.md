# SQ-0 Verdade do Backlog de Security & Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um inventario ativo, reproduzivel e validado que cubra exatamente uma vez cada alerta aberto do GitHub e atribua causa, responsavel e onda de destino sem alterar ou ocultar o snapshot historico do PR 37.

**Architecture:** Separar captura externa e validacao pura. Um comando local consulta a API por meio do GitHub CLI, normaliza apenas metadados nao sensiveis e grava o inventario; um modulo sem rede valida schema, cobertura, agrupamento, destino e prazos no CI. Os alertas sao itens observados e cada um aponta para uma unica causa planejada.

**Tech Stack:** Node.js 22, ECMAScript modules, `node:test`, GitHub CLI/REST API, JSON, pnpm 11.25.0 e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-security-quality-e-retomada-produto-design.md`

## Global Constraints

- Runtime de CI: Node `>=22.0.0 <23.0.0`; nao alinhar este trabalho ao Node 24 local nem antecipar Node 26.
- O validador executado no CI nao acessa rede e nao exige token do GitHub.
- O capturador nunca persiste valor, localizacao, token ou metadado de um alerta de Secret Scanning; total diferente de zero interrompe a captura com instrucao de resposta a incidente.
- Cada referencia no formato `code-scanning:123` ou `dependabot:456` aparece exatamente uma vez em uma causa.
- `docs/governance/triagem-seguranca-pr37.json` permanece historico e nao e reescrito.
- Alertas sem fixed version continuam visiveis; SQ-0 atribui destino, mas nao os declara corrigidos.
- Mobile permanece NO-GO e a excecao `SC-2026-005` continua sendo a fonte para os dois advisories de `image-size`.
- A falha do monitor de producao na execucao `34045002742`/issue `#206` e um fato operacional paralelo; nao alterar `scripts/monitor-producao.mjs` neste plano.
- Uma branch, um PR e um escritor ativo; nenhum push direto ou bypass na `main`.

## File Map

- Create: `scripts/capturar-inventario-security-quality.mjs` — consulta e normaliza os alertas, sem validar decisoes humanas.
- Create: `scripts/capturar-inventario-security-quality.spec.mjs` — prova normalizacao, agrupamento deterministico e ausencia de dados de secret scanning.
- Create: `scripts/validar-inventario-security-quality.mjs` — valida schema, cobertura, destinos, owners e prazos sem rede.
- Create: `scripts/validar-inventario-security-quality.spec.mjs` — mutacoes negativas do contrato.
- Create: `docs/governance/inventario-security-quality.json` — estado ativo observado e roteado.
- Modify: `package.json` — comandos de captura e gate.
- Modify: `.github/workflows/ci.yml` — gate puro no job de governanca.
- Modify: `MATRIZ_CONFIABILIDADE_TESTES.md` — propriedade protegida e comando bloqueador.
- Modify: `STATUS_ATUAL_PROJETO.md` — snapshot atual, mutirao ativo e fato do monitor.
- Modify: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` — registrar SQ-0 como primeiro item do mutirao aprovado.

---

### Task 1: Validador puro do inventario ativo

**Files:**

- Create: `scripts/validar-inventario-security-quality.mjs`
- Create: `scripts/validar-inventario-security-quality.spec.mjs`

**Interfaces:**

- Produces: `validarInventario(inventario, { hoje }): string`
- Produces: `carregarEValidarInventario(caminho?, { hoje? }): string`
- Produces: `CAMINHO_INVENTARIO_PADRAO: string`
- Consumes later: o capturador e o comando `pnpm test:inventario-security-quality` usam o mesmo schema.

- [ ] **Step 1: Escrever a fixture valida e os primeiros testes que devem falhar**

Criar `scripts/validar-inventario-security-quality.spec.mjs` com a fixture minima abaixo e testes para aceite, alerta omitido, alerta duplicado, owner ausente, destino ausente, revisao vencida e secret scanning ativo:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validarInventario,
} from './validar-inventario-security-quality.mjs';

const HOJE = new Date('2026-09-06T00:00:00.000Z');

function inventarioValido() {
  return {
    schemaVersion: 1,
    repositorio: 'octanutri-clin/octaclin',
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-09-06T12:00:00.000Z',
    snapshot: {
      codeScanning: {
        total: 2,
        alertas: [
          {
            numero: 10,
            ferramenta: 'Trivy',
            regra: 'CVE-2026-0001',
            categoria: 'trivy-imagem-web',
            caminho: 'library/octaclin-web',
            pacote: 'libssl3',
            versaoInstalada: '1.0.0',
            versaoCorrigida: '1.0.1',
            severidade: 'high',
          },
          {
            numero: 11,
            ferramenta: 'Semgrep OSS',
            regra: 'javascript.lang.security.audit.example',
            categoria: 'semgrep',
            caminho: 'src/exemplo.spec.ts',
            pacote: null,
            versaoInstalada: null,
            versaoCorrigida: null,
            severidade: 'none',
          },
        ],
        porFerramenta: { Trivy: 1, 'Semgrep OSS': 1 },
      },
      dependabot: {
        total: 1,
        alertas: [
          {
            numero: 20,
            advisory: 'GHSA-aaaa-bbbb-cccc',
            severidade: 'high',
            ecossistema: 'npm',
            pacote: 'image-size',
            manifesto: 'octaclin-mobile/pnpm-lock.yaml',
            versaoCorrigida: null,
          },
        ],
      },
      secretScanning: { total: 0 },
    },
    causas: [
      {
        id: 'SQ-2026-001',
        titulo: 'Base Alpine com OpenSSL corrigivel',
        alertas: ['code-scanning:10'],
        disposicao: 'corrigir',
        severidadeContextual: 'high',
        owner: 'octanutri-clin/octaclin',
        revisarEm: '2026-09-13',
        ondaDestino: 'SQ-1A',
        evidencia: ['Dockerfile da imagem final e mensagem do Trivy'],
        preCondicoes: ['a imagem final contem o pacote vulneravel'],
        mitigacoes: ['runtime non-root e read-only'],
        impacto: 'biblioteca vulneravel presente no artefato final',
        condicaoSaida: 'novo scan da main fecha todos os alertas agrupados',
      },
      {
        id: 'SQ-2026-002',
        titulo: 'Regra Semgrep exige analise fonte-sink',
        alertas: ['code-scanning:11'],
        disposicao: 'investigar',
        severidadeContextual: 'informational',
        owner: 'octanutri-clin/octaclin',
        revisarEm: '2026-09-13',
        ondaDestino: 'SQ-3',
        evidencia: ['alerta Semgrep no arquivo e linha informados'],
        preCondicoes: ['entrada precisa ser controlavel para existir cadeia'],
        mitigacoes: ['nenhuma conclusao antes da leitura do call site'],
        impacto: 'nao classificado nesta onda; SQ-3 mede alcance antes de qualquer encerramento',
        condicaoSaida: 'corrigir com teste negativo ou classificar com evidencia',
      },
      {
        id: 'SQ-2026-003',
        titulo: 'image-size sem patch no Mobile bloqueado',
        alertas: ['dependabot:20'],
        disposicao: 'aguardando_upstream',
        severidadeContextual: 'high',
        owner: 'octanutri-clin/octaclin',
        revisarEm: '2026-12-01',
        ondaDestino: 'SQ-3',
        excecao: 'SC-2026-005',
        evidencia: ['advisory sem first patched version'],
        preCondicoes: ['asset malicioso precisa entrar no Metro em build'],
        mitigacoes: ['Mobile NO-GO para distribuicao'],
        impacto: 'negacao de servico do toolchain Mobile',
        condicaoSaida: 'upstream publica versao corrigida alcancavel pelo Metro',
      },
    ],
  };
}

test('aceita inventario com cobertura exata e destinos revisaveis', () => {
  assert.match(validarInventario(inventarioValido(), { hoje: HOJE }), /3 alertas cobertos/);
});

test('rejeita alerta omitido', () => {
  const inventario = inventarioValido();
  inventario.causas[0].alertas = [];
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /cobertura/);
});

test('rejeita alerta atribuido a duas causas', () => {
  const inventario = inventarioValido();
  inventario.causas[1].alertas.push('code-scanning:10');
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /mais de uma causa/);
});

test('rejeita causa sem owner, destino ou revisao vigente', () => {
  for (const campo of ['owner', 'ondaDestino', 'revisarEm']) {
    const inventario = inventarioValido();
    inventario.causas[0][campo] = '';
    assert.throws(() => validarInventario(inventario, { hoje: HOJE }), new RegExp(campo));
  }
  const vencido = inventarioValido();
  vencido.causas[0].revisarEm = '2026-09-05';
  assert.throws(() => validarInventario(vencido, { hoje: HOJE }), /vencida/);
});

test('secret scanning ativo exige incidente e nao entra no inventario', () => {
  const inventario = inventarioValido();
  inventario.snapshot.secretScanning.total = 1;
  assert.throws(() => validarInventario(inventario, { hoje: HOJE }), /resposta a incidente/);
});

```

- [ ] **Step 2: Executar o teste e confirmar a falha pela ausencia do modulo**

Run:

```powershell
node --test scripts/validar-inventario-security-quality.spec.mjs
```

Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `validar-inventario-security-quality.mjs`.

- [ ] **Step 3: Implementar o validador minimo e fail-closed**

Criar `scripts/validar-inventario-security-quality.mjs`. O modulo deve exportar as tres interfaces declaradas e aplicar estas taxonomias literais:

```js
const DISPOSICOES = new Set([
  'corrigir',
  'investigar',
  'falso_positivo',
  'mitigado',
  'aguardando_upstream',
]);
const SEVERIDADES = new Set([
  'critical',
  'high',
  'medium',
  'low',
  'informational',
  'none',
]);
const ONDAS = new Set(['SQ-1A', 'SQ-1B', 'SQ-1C', 'SQ-2', 'SQ-3']);
const REF_ALERTA = /^(?:code-scanning|dependabot):\d+$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
```

A cobertura esperada deve ser derivada somente do snapshot, e a cobertura observada somente de `causas[].alertas`:

```js
function referenciasEsperadas(snapshot) {
  return [
    ...snapshot.codeScanning.alertas.map(({ numero }) => `code-scanning:${numero}`),
    ...snapshot.dependabot.alertas.map(({ numero }) => `dependabot:${numero}`),
  ].sort();
}

function referenciasObservadas(causas) {
  const vistas = new Set();
  for (const causa of causas) {
    for (const referencia of causa.alertas) {
      if (!REF_ALERTA.test(referencia)) throw new Error(`referencia invalida: ${referencia}`);
      if (vistas.has(referencia)) throw new Error(`alerta em mais de uma causa: ${referencia}`);
      vistas.add(referencia);
    }
  }
  return [...vistas].sort();
}
```

Validar ainda:

- `schemaVersion === 1`, repositorio exato e SHA completo;
- timestamps/data parseaveis e `revisarEm >= hoje`;
- IDs `SQ-AAAA-NNN` unicos;
- listas de evidencia, pre-condicoes e mitigacoes nao vazias;
- textos `titulo`, `impacto` e `condicaoSaida` nao vazios;
- totais e `porFerramenta` iguais ao comprimento das listas;
- numeros de alerta unicos dentro de cada fonte;
- `aguardando_upstream` exige `versaoCorrigida: null` em todos os alertas associados;
- `corrigir` exige pelo menos um alerta com versao corrigida ou justificativa explicita `correcaoSemBump`;
- `excecao` informada precisa seguir `SC-AAAA-NNN`;
- Secret Scanning diferente de zero falha sem carregar detalhes do alerta.

O CLI deve executar `carregarEValidarInventario()` quando o arquivo for chamado diretamente.

- [ ] **Step 4: Executar os testes e confirmar PASS das mutacoes**

Run:

```powershell
node --test scripts/validar-inventario-security-quality.spec.mjs
```

Expected: todos os testes PASS. O teste do inventario ativo real ainda nao existe;
ele sera adicionado somente na Task 3, depois da materializacao do arquivo canonico.

- [ ] **Step 5: Commitar o contrato puro**

```powershell
git add scripts/validar-inventario-security-quality.mjs scripts/validar-inventario-security-quality.spec.mjs
git commit -m "test(security): define contrato do inventario security quality"
```

---

### Task 2: Capturador seguro e deterministico da API do GitHub

**Files:**

- Create: `scripts/capturar-inventario-security-quality.mjs`
- Create: `scripts/capturar-inventario-security-quality.spec.mjs`

**Interfaces:**

- Produces: `normalizarCodeScanning(alertas): AlertaCodeScanning[]`
- Produces: `normalizarDependabot(alertas): AlertaDependabot[]`
- Produces: `criarSnapshot({ codeScanning, dependabot, secretScanning, commitBase, capturadoEm }): Snapshot`
- Produces: `consultarPaginasGh(endpoint, { executar? }): object[]`
- Consumes: o schema de `snapshot` validado na Task 1.

- [ ] **Step 1: Escrever testes com payloads sinteticos**

Criar testes que provem:

```js
test('normaliza Code Scanning sem copiar mensagem ou help inseguro', () => {
  const [alerta] = normalizarCodeScanning([{
    number: 396,
    tool: { name: 'Trivy' },
    rule: { id: 'CVE-2026-78410', security_severity_level: 'high', severity: 'error' },
    most_recent_instance: {
      category: 'trivy-imagem-ia-service',
      location: { path: 'library/octaclin-ia-service' },
      message: { text: 'Package: util-linux\\nInstalled Version: 2.41.5\\nFixed Version: ' },
    },
  }]);
  assert.deepEqual(alerta, {
    numero: 396,
    ferramenta: 'Trivy',
    regra: 'CVE-2026-78410',
    categoria: 'trivy-imagem-ia-service',
    caminho: 'library/octaclin-ia-service',
    pacote: 'util-linux',
    versaoInstalada: '2.41.5',
    versaoCorrigida: null,
    severidade: 'high',
    severidadeQualidade: 'error',
  });
  assert.equal('message' in alerta, false);
});

test('secret scanning persiste somente o total', () => {
  const snapshot = criarSnapshot({
    codeScanning: [],
    dependabot: [],
    secretScanning: [],
    commitBase: 'a'.repeat(40),
    capturadoEm: '2026-09-06T12:00:00.000Z',
  });
  assert.deepEqual(snapshot.secretScanning, { total: 0 });
});

test('secret scanning ativo interrompe sem serializar segredo', () => {
  assert.throws(
    () => criarSnapshot({
      codeScanning: [],
      dependabot: [],
      secretScanning: [{ number: 9, secret: 'valor-que-nao-pode-sair' }],
      commitBase: 'a'.repeat(40),
      capturadoEm: '2026-09-06T12:00:00.000Z',
    }),
    (erro) => erro.message.includes('1 alerta de Secret Scanning'),
  );
});
```

Adicionar teste de ordenacao crescente por numero e teste de `consultarPaginasGh` com executor injetado, provando uso de argumentos separados e sem shell:

```js
assert.deepEqual(chamada, {
  comando: 'gh',
  argumentos: ['api', '--paginate', '--slurp', endpoint],
});
```

- [ ] **Step 2: Executar o teste e confirmar `ERR_MODULE_NOT_FOUND`**

```powershell
node --test scripts/capturar-inventario-security-quality.spec.mjs
```

Expected: FAIL pela ausencia do capturador.

- [ ] **Step 3: Implementar captura sem shell e normalizacao por allowlist**

Usar `spawnSync`, nunca string de shell:

```js
import { spawnSync } from 'node:child_process';

export function consultarPaginasGh(endpoint, { executar = spawnSync } = {}) {
  const resultado = executar(
    'gh',
    ['api', '--paginate', '--slurp', endpoint],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (resultado.status !== 0) {
    throw new Error(`GitHub API falhou para ${endpoint}; reautentique com gh auth login.`);
  }
  const paginas = JSON.parse(resultado.stdout);
  return paginas.flat();
}
```

Fixar o repositorio no CLI como `octanutri-clin/octaclin`. Consultar:

```text
/repos/octanutri-clin/octaclin/branches/main
/repos/octanutri-clin/octaclin/code-scanning/alerts?state=open&per_page=100
/repos/octanutri-clin/octaclin/dependabot/alerts?state=open&per_page=100
/repos/octanutri-clin/octaclin/secret-scanning/alerts?state=open&per_page=100
```

Normalizar somente os campos declarados na fixture. Extrair `Package`,
`Installed Version` e `Fixed Version` da mensagem Trivy e descartar a mensagem
bruta. Para ferramentas sem esse formato, usar `null`. Dependabot deve guardar
numero, advisory, severidade, ecossistema, pacote, manifesto e a menor versao
corrigida disponivel ou `null`.

O CLI imprime o JSON normalizado em stdout. Ele nao escreve o arquivo por
padrao; a gravacao deliberada ocorre na Task 3 por redirecionamento para um
arquivo temporario revisavel.

- [ ] **Step 4: Rodar os testes do capturador**

```powershell
node --test scripts/capturar-inventario-security-quality.spec.mjs
```

Expected: PASS para normalizacao, ordenacao, segredo fail-closed e chamada sem shell.

- [ ] **Step 5: Commitar o capturador**

```powershell
git add scripts/capturar-inventario-security-quality.mjs scripts/capturar-inventario-security-quality.spec.mjs
git commit -m "feat(security): captura inventario security quality sem dados sensiveis"
```

---

### Task 3: Materializar e rotear o inventario real

**Files:**

- Create: `docs/governance/inventario-security-quality.json`
- Modify: `scripts/validar-inventario-security-quality.spec.mjs`

**Interfaces:**

- Consumes: JSON produzido pelo capturador da Task 2.
- Produces: inventario ativo aceito por `carregarEValidarInventario()`.

- [ ] **Step 1: Capturar o snapshot em arquivo temporario fora do repositorio**

No PowerShell, usar um caminho temporario explicito e nao imprimir o conteudo:

```powershell
$sq0Temp = Join-Path ([System.IO.Path]::GetTempPath()) 'octaclin-security-quality-snapshot.json'
node scripts/capturar-inventario-security-quality.mjs | Set-Content -LiteralPath $sq0Temp -Encoding utf8
$snapshotSq0 = Get-Content -Raw -LiteralPath $sq0Temp | ConvertFrom-Json
[pscustomobject]@{
  commitBase = $snapshotSq0.commitBase
  codeScanning = $snapshotSq0.snapshot.codeScanning.total
  dependabot = $snapshotSq0.snapshot.dependabot.total
  secretScanning = $snapshotSq0.snapshot.secretScanning.total
  porFerramenta = $snapshotSq0.snapshot.codeScanning.porFerramenta
} | ConvertTo-Json -Compress
```

Expected no snapshot de planejamento: commit `56afc7c2f3dbe3fc2d60120782b70c2062d66bde`, 238 Code Scanning, 2 Dependabot, 0 Secret Scanning, 235 Trivy e 3 Semgrep. Se a `main` ou os totais mudarem, interromper a materializacao e registrar a nova captura factual; nunca editar o JSON para forcar os numeros antigos.

- [ ] **Step 2: Criar o inventario ativo a partir do snapshot normalizado**

Copiar os campos normalizados para `docs/governance/inventario-security-quality.json` e adicionar `causas`. O roteamento inicial precisa cobrir exatamente estas classes observadas:

| Classe | Disposicao | Onda | Owner/revisao |
| --- | --- | --- | --- |
| 40 alertas `libssl3`/`libcrypto3` em backend/web com fix | `corrigir` | `SQ-1A` | proprietario, 2026-09-13 |
| 19 alertas sob `/usr/local/lib/node_modules/npm` na imagem web | `corrigir` | `SQ-1B` | proprietario, 2026-09-13 |
| 3 alertas `Python` na imagem de IA com fix | `investigar` | `SQ-1C` | proprietario, 2026-09-13 |
| 173 alertas sem fixed version na imagem de IA | `investigar` | `SQ-2` | proprietario, 2026-09-20 |
| 3 alertas Semgrep | `investigar` | `SQ-3` | proprietario, 2026-09-20 |
| 2 alertas Dependabot `image-size` | `aguardando_upstream` | `SQ-3` | proprietario, 2026-12-01, `SC-2026-005` |

Agrupar repeticoes somente quando ferramenta, regra, categoria, caminho, pacote,
versao instalada, versao corrigida e destino forem iguais. CVEs diferentes nao
podem ser fundidas numa causa generica apenas por pertencerem ao mesmo pacote.

Para `investigar`, a evidencia registra o artefato e os metadados do scanner,
as pre-condicoes registram o que ainda precisa ser demonstrado e a condicao de
saida aponta para a onda concreta. Nao usar `falso_positivo`, `mitigado` ou
`aguardando_upstream` para a imagem de IA antes de SQ-2.

- [ ] **Step 3: Reativar o teste do arquivo real**

Atualizar o import existente para incluir `carregarEValidarInventario` e
adicionar ao fim de `scripts/validar-inventario-security-quality.spec.mjs`:

```js
test('valida o inventario ativo real', () => {
  assert.match(
    carregarEValidarInventario(undefined, { hoje: new Date('2026-09-06T00:00:00.000Z') }),
    /240 alertas cobertos/,
  );
});
```

Se a captura atual tiver outro total, usar o total factual retornado pelo
capturador e registrar a mudanca na mensagem do commit; nao preservar `240`
como constante historica falsa.

- [ ] **Step 4: Executar o validador contra o inventario real**

```powershell
node --test scripts/validar-inventario-security-quality.spec.mjs
node scripts/validar-inventario-security-quality.mjs
```

Expected: PASS e mensagem com o numero atual de alertas cobertos exatamente uma vez.

- [ ] **Step 5: Provar por mutacao que omissao e duplicacao reprovam o arquivo real**

Copiar o inventario para o diretorio temporario, remover uma referencia em uma
copia e duplicar outra em uma segunda copia. Invocar
`carregarEValidarInventario(caminhoTemporario)` e exigir exit diferente de zero
nos dois casos. A prova deve ser automatizada em
`validar-inventario-security-quality.spec.mjs`, sem editar o arquivo canonico.

- [ ] **Step 6: Commitar o inventario factual**

```powershell
git add docs/governance/inventario-security-quality.json scripts/validar-inventario-security-quality.spec.mjs
git commit -m "docs(security): materializa e roteia backlog security quality"
```

---

### Task 4: Integrar o gate ao CI e as fontes canonicas

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `MATRIZ_CONFIABILIDADE_TESTES.md`
- Modify: `STATUS_ATUAL_PROJETO.md`
- Modify: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- Modify: `scripts/test-matriz-confiabilidade.mjs`

**Interfaces:**

- Produces: `pnpm test:inventario-security-quality`
- Produces: `pnpm security:capturar-inventario` para captura deliberada local.
- CI consumes: apenas o comando de teste sem rede.

- [ ] **Step 1: Escrever primeiro a assercao de governanca que deve falhar**

Em `scripts/test-matriz-confiabilidade.mjs`, adicionar referencias obrigatorias
ao inventario e ao comando:

```js
// Adicionar ao array referenciasObrigatorias:
'docs/governance/inventario-security-quality.json',

// Criar ao lado das referencias de arquivo:
const comandosObrigatorios = [
'pnpm test:inventario-security-quality',
];

for (const comando of comandosObrigatorios) {
  if (!conteudo.includes(`\`${comando}\``)) {
    throw new Error(`A matriz nao referencia o comando critico: ${comando}`);
  }
}
```

O loop existente de `referenciasObrigatorias` continua validando citacao e
existencia do arquivo. O novo array separa comandos de caminhos e evita uma
excecao implicita no teste de existencia.

- [ ] **Step 2: Executar a matriz e confirmar FAIL**

```powershell
pnpm test:confiabilidade
```

Expected: FAIL porque `MATRIZ_CONFIABILIDADE_TESTES.md` ainda nao referencia o novo gate.

- [ ] **Step 3: Adicionar scripts e o passo de CI**

Adicionar a `package.json`:

```json
"security:capturar-inventario": "node scripts/capturar-inventario-security-quality.mjs",
"test:inventario-security-quality": "node --test scripts/validar-inventario-security-quality.spec.mjs scripts/capturar-inventario-security-quality.spec.mjs"
```

No job `governanca` de `.github/workflows/ci.yml`, imediatamente depois de
`pnpm test:triagem-seguranca`, adicionar:

```yaml
- run: pnpm test:inventario-security-quality
```

Nao adicionar `gh`, token ou permissao `security-events` ao job: o CI valida o
snapshot versionado e a cobertura, mas a captura continua deliberada e externa.

- [ ] **Step 4: Atualizar a matriz e o estado sem duplicar norma**

Adicionar uma linha em `MATRIZ_CONFIABILIDADE_TESTES.md` declarando:

- propriedade: todo alerta aberto esta coberto exatamente uma vez, possui owner,
  revisao e onda de destino; segredo ativo falha fechado;
- teste: `pnpm test:inventario-security-quality`;
- efeito: bloqueia merge no job de governanca.

Em `STATUS_ATUAL_PROJETO.md`, atualizar data e snapshot observado, declarar SQ-0
como fase ativa e registrar separadamente:

- execucao `34045002742` do monitor falhou por tres timeouts antes de concluir o
  primeiro readiness;
- issue `#206` foi aberta automaticamente;
- verificacao read-only posterior retornou readiness 200 em 0,84 s, detalhado
  200 em 0,31 s e web 200 em 43,33 s;
- causa externa exata nao foi provada porque o log nao identifica check/tentativa.

Em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, inserir o programa SQ-0 a SQ-4 antes da
Fase 256 e marcar somente o que foi comprovado neste PR. Nao marcar o incidente
de producao como resolvido ate a issue ser fechada por uma execucao verde do
monitor.

- [ ] **Step 5: Executar os gates documentais e de governanca**

```powershell
pnpm test:inventario-security-quality
pnpm test:triagem-seguranca
pnpm test:excecoes-supply-chain
pnpm test:confiabilidade
pnpm validate:docs
pnpm security:secrets
git diff --check
```

Expected: todos PASS. O aviso de engine sob Node 24 local deve ser reportado,
nao ocultado; a execucao oficial do CI deve ocorrer em Node 22.

- [ ] **Step 6: Commitar a integracao do gate**

```powershell
git add package.json .github/workflows/ci.yml MATRIZ_CONFIABILIDADE_TESTES.md STATUS_ATUAL_PROJETO.md CHECKLIST_FASES_FUTURAS_PRODUCAO.md scripts/test-matriz-confiabilidade.mjs
git commit -m "chore(security): bloqueia backlog security quality sem destino"
```

---

### Task 5: Revisao final e handoff para SQ-1A

**Files:**

- Review only: todos os arquivos deste plano.
- Modify only if evidence changed: `docs/governance/inventario-security-quality.json`, `STATUS_ATUAL_PROJETO.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

**Interfaces:**

- Produces: baseline aprovada para o plano SQ-1A.
- Produces: lista exata de alertas e causa `SQ-1A` consumida pelo proximo plano.

- [ ] **Step 1: Revalidar a API imediatamente antes do push**

```powershell
pnpm security:capturar-inventario
```

Comparar apenas commit, totais, numeros, ferramentas, regras, categorias,
caminhos, pacotes e versoes com o arquivo versionado. Se houver alerta novo ou
fechado durante o PR, recapturar, rotear e repetir os testes; nao publicar um
snapshot sabidamente obsoleto.

- [ ] **Step 2: Executar a suite final da SQ-0**

```powershell
pnpm test:inventario-security-quality
pnpm test:triagem-seguranca
pnpm test:excecoes-supply-chain
pnpm test:confiabilidade
pnpm test:workflows-seguros
pnpm validate:docs
pnpm security:secrets
git diff --check
```

Expected: PASS em todos os comandos. Registrar Node local fora da engine como
limitacao se a maquina ainda estiver no Node 24.

- [ ] **Step 3: Revisar o diff e a ausencia de dados indevidos**

```powershell
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git log --oneline origin/main..HEAD
```

Confirmar que nenhum payload bruto de Secret Scanning, token, URL com
credencial, PII ou PHI foi versionado.

- [ ] **Step 4: Preparar o PR sem declarar alertas corrigidos**

O corpo do PR deve registrar:

```markdown
## Objetivo
Materializar a verdade atual do backlog de Security & Quality e atribuir cada alerta a uma unica causa e onda.

## Resultado
- Code Scanning: 238
- Dependabot: 2
- Secret Scanning: 0
- Alertas cobertos exatamente uma vez: 240
- Alertas corrigidos por este PR: 0

## Validacoes
- PASS — test:inventario-security-quality
- PASS — test:triagem-seguranca
- PASS — test:excecoes-supply-chain
- PASS — test:confiabilidade
- PASS — test:workflows-seguros
- PASS — validate:docs
- PASS — security:secrets
- PASS — git diff --check

## Proxima acao
Executar o plano SQ-1A contra os alertas de libssl3/libcrypto3 identificados no inventario aprovado.
```

Os numeros acima sao o snapshot factual de planejamento. Se a recaptura da
Step 1 mudar qualquer total, atualizar as tres linhas numericas do corpo com os
valores impressos no mesmo ciclo e repetir os gates; nao preservar 238/2/240
como constantes historicas falsas.

- [ ] **Step 5: Solicitar checks e revisao humana**

Push e abertura do PR seguem o ruleset normal. Nao fazer merge enquanto o job
`Governanca de repositorio` ou qualquer scanner obrigatorio estiver pendente ou
falhando. Depois do merge, executar os scanners na `main` e usar o inventario
aprovado como entrada para escrever o plano SQ-1A.
