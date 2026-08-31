# Auditoria de tooling de agentes — 2026-08-23

> Estado posterior: os riscos residuais de hooks, scanner e skills operacionais
> foram reavaliados e reduzidos no PR 48. Fonte atual:
> `docs/governance/RELATORIO_SEGURANCA_PR48_2026-08-31.md`.

> Escopo: PR 3 da `DECISAO_FINAL_GOVERNANCA_AGENTES_OCTACLIN.md` (secoes 30, 31 e 43).
> Natureza: registro de auditoria com evidencia. Nao e norma; norma fica em `AGENTS.md`
> e nos documentos indicados por ele.
> Base: `main` em `4cde560`, apos o merge dos PRs #106 e #107.

Toda afirmacao abaixo foi obtida no mesmo ciclo da auditoria. Onde nao houve
medicao, o item esta marcado como **nao medido**.

---

## 1. `.mcp.json` — item 43.PR3.1 e 43.PR3.2

### Estado observado

```json
{ "mcpServers": { "postgres-staging": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"] } } }
```

Arquivo versionado desde `2426d18`, sem alteracao posterior.

### Achados

| # | Achado | Evidencia |
|---|---|---|
| 1 | O nome `postgres-staging` promete staging, mas a credencial e `${DATABASE_URL}` — a variavel generica. Quem exportar `DATABASE_URL` de producao no shell abre um servidor MCP contra producao sem nenhum aviso. | leitura do proprio arquivo |
| 2 | O pacote esta descontinuado. | `npm view @modelcontextprotocol/server-postgres` retorna `deprecated = 'Package no longer supported.'`, `version = 0.6.2`, `time.modified = 2026-07-03` |
| 3 | `npx -y` sem versao fixa resolve o pacote no momento da execucao. Superficie de supply chain em um processo que recebe credencial de banco. | leitura do proprio arquivo |
| 4 | O modo somente-leitura do `server-postgres` e imposto pelo proprio servidor (transacao `READ ONLY`), nao por `GRANT`. Nao ha role dedicada nem restricao no banco. | leitura do arquivo; nenhuma role dedicada configurada |

Os achados 1 e 3 violam diretamente a secao 30 (`nunca DATABASE_URL generica`,
`versao exata`, `role dedicada`, `read-only`).

### Decisao

A secao 46.2 reserva esta decisao ao proprietario. Consultado em 2026-08-23, o
proprietario decidiu: **remover a configuracao compartilhada**.

O servidor foi removido de `.mcp.json` e o arquivo, que nao continha outra
entrada, foi excluido. Nenhuma referencia funcional apontava para ele — o
`grep` por `mcp.json`, `server-postgres` e `mcpServers` retornou apenas o
proprio arquivo, a decisao de governanca e documentacao nao relacionada da
skill do Google.

O padrao operacional vigente permanece: o agente escreve runbook, o
proprietario ou o Codex executam no banco.

### Condicoes para reintroduzir

Reintroduzir um MCP com acesso a banco exige, cumulativamente:

- pacote mantido (nao descontinuado), com versao exata fixada — sem `npx -y`;
- `STAGING_DATABASE_URL` propria, nunca `DATABASE_URL` generica;
- role dedicada, read-only, sem ownership e sem `BYPASSRLS`;
- nunca a credencial de owner de producao;
- o MCP entra no threat model antes de ser versionado.

---

## 2. Hooks do Claude — item 43.PR3.4

Tres hooks em `.claude/settings.json`, todos `powershell -File` com path relativo:

| Hook | Evento | Matcher | Papel |
|---|---|---|---|
| `block-env-edit.ps1` | PreToolUse | `Edit`/`Write` | bloquear edicao de `.env` |
| `guard-google-actions.ps1` | PreToolUse | `Bash` | pedir confirmacao em acoes reais no Google Workspace |
| `typecheck-on-edit.ps1` | PostToolUse | `Edit`/`Write` | avisar sobre quebra de typecheck |

### Contrato de saida (fonte: documentacao do Claude Code, consultada em 2026-08-23)

> "Exit 2 means a blocking error. (...) Without valid JSON on stdout, Claude Code
> treats exit code 1 as a non-blocking error and proceeds with the action."

Ou seja: **apenas exit 2 bloqueia pelo codigo de saida**. Qualquer outro codigo
— inclusive falha de execucao — deixa a ferramenta prosseguir.

### 2.1 Achados medidos

| # | Achado | Severidade | Como foi medido |
|---|---|---|---|
| H1 | `block-env-edit.ps1` tinha `catch { exit 0 }`: payload nao parseavel liberava a escrita em silencio. | Media | stdin `nao-e-json` e stdin vazio devolveram `exit=0` sem nenhuma saida |
| H2 | Path relativo `.claude/hooks/*.ps1`. Com cwd fora da raiz do repositorio, o PowerShell nao encontra o script e sai com **127** — que nao bloqueia. | Media | `-File .claude/hooks/NAO-EXISTE.ps1` devolveu `exit=127` |
| H3 | Interpretador `powershell` (Windows PowerShell 5.1), nao `pwsh`. Em ambiente sem Windows PowerShell o hook nao executa e a protecao desaparece sem aviso. | Media | leitura de `.claude/settings.json`; **nao medido** em Linux/macOS |
| H4 | O bloqueio de `.env` nao alcanca escrita via `Bash` (`echo x > .env`). O matcher e `Edit`/`Write` e o script so le `tool_input.file_path`. | Aceito — ver 3.1 | payload de Bash devolveu `exit=0` sem decisao |
| H5 | `typecheck-on-edit.ps1` le `$LASTEXITCODE` apos `pnpm`. Se `pnpm` nao existir, o PowerShell lanca `CommandNotFoundException` e `$LASTEXITCODE` conserva o valor anterior. | Baixa | comando inexistente deixou `$LASTEXITCODE = 0`, resultando em "nao detectaria falha" |
| H6 | Custo do typecheck: nao e problema. | — | execucao aquecida: backend **5s**, web **3s** (`incremental: true` nos dois `tsconfig.json`), contra timeout de 120s |

H1, H2, H3 e H5 sao todos o mesmo padrao: **fail-open**. Nenhum hook usa exit 2.

### 2.2 Correcao aplicada

Somente `block-env-edit.ps1` foi alterado, e apenas para fechar H1:

- payload nao parseavel ou sem `tool_input.file_path` agora devolve
  `permissionDecision: "ask"` em vez de liberar em silencio;
- a deteccao usa regex sobre o path bruto no lugar de `Split-Path`, que pode
  lancar excecao em caminho malformado — e uma excecao produziria exit != 0,
  que tambem nao bloqueia.

Degradar para `ask` — e nao para `deny`/exit 2 — foi deliberado: um payload
inesperado da ferramenta bloquearia toda edicao do repositorio. `ask` transfere
a decisao para a pessoa sem parar o trabalho, e e o mesmo padrao ja usado por
`guard-google-actions.ps1`.

Bateria executada depois da mudanca (`exit=0` em todos os casos):

| Payload | Decisao |
|---|---|
| `.env` | `deny` |
| `.env.local` | `deny` |
| `.env.example` | liberado |
| `src/app.ts`, `octaclin-backend/src/main.ts` | liberado |
| `src/.environment.ts`, `docs/.env-notas.md` | liberado |
| JSON malformado | `ask` |
| stdin vazio | `ask` |
| payload de Bash (sem `file_path`) | `ask` |

H2, H3 e H5 nao foram alterados: ver secao 3.

---

## 3. Fail-open / fail-closed — item 43.PR3.5

Medicao concluida e registrada em 2.1. Resultado: os tres hooks eram fail-open
por construcao; um deles foi corrigido.

### 3.1 Por que H2, H3, H4 e H5 nao foram corrigidos aqui

Porque nenhum deles e a fronteira de seguranca real, e a fronteira real ja
existe e ja e fail-closed:

- `.gitignore` ignora `.env` e `.env.*`, com excecao explicita para
  `.env.example` (linhas 14-17);
- `git ls-files` confirma que os unicos arquivos rastreados sao
  `octaclin-backend/.env.example` e `octaclin-web/.env.example`;
- `secret_scanning: enabled` e `secret_scanning_push_protection: enabled` no
  repositorio (`gh api repos/octanutri-clin/octaclin`).

O hook impede que um agente edite um `.env` local. O que impede um secret de
chegar ao repositorio e a combinacao acima, que roda no servidor, independe de
sistema operacional e independe de qual agente esta trabalhando.

Fechar H2/H3/H4 exigiria transformar o hook em um controle portavel — o que a
secao 53 desaconselha, porque duplicaria um controle que ja existe.

**Nao medido:** `secret_scanning_validity_checks` esta `disabled`. Nao foi
avaliado nesta auditoria se vale habilitar.

---

## 4. O que migra para Node/CI — item 43.PR3.6

A secao 31 pede que seguranca reutilizavel migre para `Node/script + teste + CI`.
Aplicada aos tres hooks existentes, a resposta e que **nenhum deve migrar agora**:

| Controle | Migra? | Motivo |
|---|---|---|
| Bloqueio de edicao de `.env` | Nao | O equivalente compartilhado ja existe: `.gitignore` + secret scanning + push protection, todos verificados ativos. O hook cobre um risco local que o CI nao observa. Reimplementa-lo no CI criaria um segundo controle sem cobertura nova. |
| Confirmacao de acoes no Google Workspace | Nao | Guarda uma acao externa em tempo de execucao do agente. O CI nao executa `gog` nem `gmail_skill.py`; nao existe equivalente possivel. |
| Typecheck apos edicao | Ja esta no CI | `pnpm typecheck` roda em tres jobs do `ci.yml` (linhas 65, 91 e 120). O hook e atalho de latencia, nao gate. Custo medido de 3-5s justifica manter. |

A regra da secao 31 continua valendo para hooks **novos**: um hook do Claude nao
conta como controle compartilhado, porque o Codex nao o executa.

---

## 5. `ARMAZENAMENTO_S3_IF_NONE_MATCH` — item 43.PR3.7

**NA — resolvido no PR 1 (#106).** O item era condicional ("se necessario para o
ADR-018"). O ADR-018 ja foi corrigido em `d222575` com evidencia do proprietario:
producao usa Backblaze B2 com `ARMAZENAMENTO_S3_IF_NONE_MATCH=false`, e o ADR
deixou de prometer imutabilidade absoluta. Nada restou para o PR 3.

---

## 6. Riscos residuais

1. **Hooks continuam fail-open em H2, H3 e H5.** Aceito: a fronteira real e o
   push protection do GitHub. Se algum dia um hook do Claude for a unica barreira
   de um risco, ele precisa de exit 2 e de equivalente para o Codex.
2. **Nenhum equivalente dos hooks existe para o Codex.** Um agente fica mais
   protegido que o outro contra a edicao de `.env` local.
3. **`secret_scanning_validity_checks` desabilitado.** Nao avaliado.
4. **Remover o MCP nao apaga historico.** O `.mcp.json` continua no historico do
   Git. Nenhuma credencial estava no arquivo — apenas a referencia
   `${DATABASE_URL}` —, entao nao ha secret a rotacionar.
