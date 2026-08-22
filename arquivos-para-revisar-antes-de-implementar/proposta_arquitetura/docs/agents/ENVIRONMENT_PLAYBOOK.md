# OctaClin — Environment Playbook

> Status: ativo  
> Fonte de verdade para: shell, Windows, CRLF e execução local

## 1. Objetivo

Concentrar peculiaridades de ambiente fora do `AGENTS.md` raiz.

## 2. Line endings

O repositório pode apresentar diferenças CRLF/LF entre checkout e Git.

Ao editar por script:

```js
let s = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

if (!s.includes(expected)) {
  console.error('TRECHO NAO ENCONTRADO');
  process.exit(1);
}
```

Não faça substituição silenciosa quando o contexto não casar.

## 3. Não normalize arquivos conhecidos apenas para “consertar” checkout local

Se um teste/fixture tiver comportamento conhecido específico de CRLF no Windows e CI estiver correto, não normalize o artefato sem entender o contrato.

Mudança de line ending pode produzir regressão no CI.

## 4. Git Bash × PowerShell

Não presuma que sintaxe de um shell funciona no outro.

### Evitar no PowerShell

- expansão `{a,b}` no estilo Bash;
- depender de expansão automática de `*.md` em comandos que não a fazem;
- comandos copiados sem conferir quoting.

### Para `rg`

Prefira:

```sh
rg "padrao" arquivo1.md arquivo2.md
```

a globs ambíguos.

## 5. `node -e`

Evite `node -e` com:

- template literals;
- muitas aspas;
- backticks;
- script ESM complexo;
- código que usa `process.argv`.

Prefira criar um arquivo `.mjs` temporário dentro do pacote apropriado, executar e remover depois.

## 6. `sed`

Evite `sed` para conteúdo com regex/backslashes complexos quando houver risco de transformar o texto.

Prefira Node para patch programático verificável.

## 7. Scripts que usam dependências do projeto

O script deve executar no contexto do pacote que possui a dependência.

Não assuma resolução de módulo a partir de scratchpad externo.

## 8. TypeScript/backend

Respeite configuração real do backend.

Se `esModuleInterop` estiver desligado, copie o padrão de import já utilizado no repositório.

Não imponha estilo incompatível com o tsconfig.

## 9. Runtime

Não presuma que `python3`, `node`, `pnpm`, `git` ou outro binário está no PATH.

Antes de desistir:

- verifique runtimes já fornecidos pelo ambiente/agente;
- use o runtime do projeto;
- não instale globalmente sem necessidade.

## 10. Prefixo `!`

Quando o ambiente do usuário tratar `!` como Git Bash, forneça comandos POSIX para esse contexto.

Não entregue PowerShell como se fosse executado pelo mesmo prefixo.

## 11. Servidor local

Antes de iniciar Next/Playwright:

- confira portas relevantes;
- identifique processo antes de matar;
- encerre apenas processo pertencente ao checkout atual.

Evite PTY para servidor que não exige interação.

## 12. Browser mocks

Ao interceptar `fetch`, normalize os formatos possíveis:

- `string`;
- `URL`;
- `Request`.

Não suponha que todo argumento possui a mesma estrutura.

## 13. Dependências

Antes de bump de TypeScript/compilador:

- rode versão alvo localmente;
- não conclua a partir do primeiro erro de CI;
- erros de configuração podem esconder milhares de erros de arquivo.

## 14. Lockfile

Após qualquer alteração de dependência:

```sh
git diff -- <caminho-do-lockfile>
```

Procure ruído causado por versão diferente do package manager.

Após merge/rebase concorrente, regenere/valide o lockfile; “Git clean” não prova consistência semântica.

## 15. CI

Não aguarde por nome/listagem aproximada.

Use run ID específico:

```sh
gh run view <id> --json status
gh run view <id> --json jobs
```

## 16. Patches

Para mudança ampla:

1. leia trecho atual;
2. faça patch pequeno;
3. confirme resultado;
4. siga para próximo bloco.

Não aplique substituição global baseada em contexto lembrado.

## 17. Segurança durante diagnóstico

Nunca resolva problema de ambiente imprimindo:

- `.env`;
- token;
- connection string;
- payload clínico.

Extraia apenas identificadores mínimos necessários.
