# PR 35 - Hardening da supply chain dos workflows

Data: 2026-08-27

## Escopo

- Fixar todas as actions remotas em `.github/workflows` por SHA completo.
- Manter a versao humana em comentario na mesma linha para o Dependabot.
- Bloquear novas referencias por tag, branch ou SHA abreviado.
- Reduzir o ruido das atualizacoes rotineiras sem atrasar security updates.

Nao fazem parte deste PR: shell injection nos deploys, achados de runtime,
containers, tooling de agentes e migracoes coordenadas de frameworks.

## Baseline e correcao

O inventario encontrou 44 referencias mutaveis e 3 referencias ja fixadas. O teste foi criado antes da
substituicao e reprovou em `backup-producao.yml:50`, que usava
`actions/checkout@v7`. Depois da correcao, todas as referencias remotas usam SHA
completo e o mesmo teste passa.

Os SHAs foram resolvidos em 2026-08-27 com `git ls-remote` nos repositorios
oficiais. Tags anotadas usam o commit desreferenciado:

| Action | Versao | SHA |
| --- | --- | --- |
| `actions/checkout` | v7 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7 | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/setup-python` | v7 | `5fda3b95a4ea91299a34e894583c3862153e4b97` |
| `actions/upload-artifact` | v7 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `pnpm/action-setup` | v6 | `f520eceda224fe1a4aed5a2a27a194379a409996` |
| `github/codeql-action` | v4 | `cdf488f595d80d6e07e03d4674febd5ab45fa938` |
| `aquasecurity/trivy-action` | v0.36.0 | `ed142fd0673e97e23eac54620cfb913e5ce36c25` |
| `aws-actions/configure-aws-credentials` | v6 | `e6de054238d6b7531b4efff3b6587d9aade6a06c` |
| `aws-actions/amazon-ecr-login` | v2 | `03f1aad4c6c7ffd436567f42f9384779290529bd` |
| `azure/login` | v3 | `7ddb5af1ef8758cf1353cf3b42f940aee27ba21c` |
| `neondatabase/create-branch-action` | v6 | `fb620d43d4c565abaf088b848a4e28e5c4ea4d9c` |
| `neondatabase/delete-branch-action` | v3 | `4468d825d5a88ef4012f1705a82f02ec3072f776` |

## Gate e manutencao

`pnpm test:actions-imutaveis` valida os workflows versionados e casos negativos
para tag, branch, SHA abreviado e ausencia do comentario de versao. O comando
roda no job `Governanca de repositorio` antes dos jobs mais caros.

O Dependabot usa cooldown padrao de 7 dias para GitHub Actions e pip. npm usa
30 dias para major, 7 para minor e 3 para patch. Atualizacoes de seguranca nao
sao afetadas pelo cooldown.

## Riscos residuais

- A imagem `semgrep/semgrep` do container do workflow continua por tag e sera
  tratada junto ao hardening de containers no PR 40.
- Expressoes GitHub interpoladas em shell nos deploys AWS/Azure permanecem para
  o PR 36; este PR nao altera comportamento de deploy.
- A validade dos SHAs depende da disponibilidade e politica dos repositorios
  oficiais, mas deixa de depender de tags mutaveis no momento da execucao.
