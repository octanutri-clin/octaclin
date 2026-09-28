# CI por impacto do PR

## Contrato

O workflow `.github/workflows/ci.yml` inicia em todo PR, sem `paths` ou
`paths-ignore`. `detectar-impacto` compara o SHA base e o SHA head com
`git diff --name-status -z --find-renames`. O classificador versionado em
`scripts/classificar-impacto-pr.mjs` produz flags, arquivos, regras, tipos,
risco e motivo. Não usa o autor do PR como sinal de impacto: Dependabot e
contribuidores recebem a mesma classificação. Push em `main` e execução
manual continuam com suite completa.

`Rollout seguro`, `Operacao de lancamento` e `Governanca de repositorio` rodam
sempre. A governança inclui secrets, políticas de workflows, locks, licenças,
versões e contratos de segurança. Backend, Web, Mobile, AI e Demo só rodam
quando classificados. O smoke usa Next.js real com `next start` e a API
sintética `octaclin-backend/scripts/api-demo-local.mjs`; ele testa jornadas
Web/BFF, acessibilidade e regressão visual. Ele não executa NestJS real,
PostgreSQL, Redis, migrations ou RLS. Por isso, backend isolado não aciona Demo.
Alterar a API sintética aciona Backend, Web e Demo.

`PR Gate` usa `if: always()` e verifica cada resultado de `needs`. Job
necessário deve ser `success`; job N/A deve ser `skipped`. `failure`,
`cancelled`, `skipped` necessário, resultado desconhecido, detector ausente ou
classificação inválida reprovam. Seu script é
`scripts/validar-pr-gate.mjs`. O resumo do detector lista arquivos,
domínios, jobs necessários, N/A e razão; o gate resume os resultados.
O gate recalcula a classificação a partir da lista de arquivos e rejeita
flags inconsistentes. Em PR, faz seu próprio checkout com histórico completo
e confronta a lista recebida com um segundo `git diff` base/head; diff
indisponível, SHA inválido ou lista incompleta falham. Também rejeita resultado
de job não previsto. Um teste
de contrato compara todos os jobs de `ci.yml` com a lista `needs` do gate;
ao criar job novo, atualize também a lista e a validação.

## Regras e fail-safe

| Diff | Jobs de aplicação |
| --- | --- |
| `octaclin-backend/**` | Backend; API demo também Web + Demo |
| `octaclin-web/**` | Web + Demo |
| `octaclin-mobile/**` | Mobile |
| `octaclin-ai-service/**` | AI |
| Workflow isolado em `.github/workflows/**` | Governança sempre; scanners existentes mantidos |
| Action local em `.github/actions/**` | Suite completa |
| `ci.yml`, detector, gate, script raiz ou configuração compartilhada | Suite completa |
| Docs e metadados reconhecidos | Governança sempre |
| Arquivo desconhecido, diff vazio ou caminho inválido | Suite completa |

Manifest, lock e Dockerfile marcam Dependency Review como relevante. Quando o
manifest npm pode ser lido em ambos os commits, a versão das dependências
alteradas recebe `patch`, `minor` ou `major`; versão não interpretável fica
`unknown`. Isso é informação para revisão: não reduz os jobs exigidos.
Migration, banco, RLS e tenant seguem a suite Backend existente, incluindo
PostgreSQL de CI e a prova RLS. Alterações de auth/BFF Web seguem Web + Demo.

Para adicionar uma regra, edite o classificador, acrescente um cenário em
`scripts/classificar-impacto-pr.spec.mjs` e verifique o gate correspondente
em `scripts/validar-pr-gate.spec.mjs`. O padrão é ampliar o impacto quando o
consumidor do arquivo não for claro. Execute:

```sh
node --test scripts/classificar-impacto-pr.spec.mjs scripts/validar-pr-gate.spec.mjs
node scripts/classificar-impacto-pr.mjs --files-json '["octaclin-backend/package.json"]'
```

## Scanners, Ruleset e rollback

Dependency Review permanece em workflow separado, com severidade high,
licenças negadas e comparação base/head intactas. Ele continua rodando em
todo PR; a flag do detector informa relevância, mas o `PR Gate` **não**
atesta o resultado de outro workflow. CodeQL, Semgrep e Trivy mantêm seus
gatilhos, políticas e comportamento atual para Dependabot. Esta etapa não
altera o Ruleset remoto. Os required checks antigos continuam configurados;
um job condicional `skipped` pode ser aceito pelo GitHub, portanto o `PR Gate`
deve ser observado em PR real antes da migração. Até ele se tornar required,
uma falha isolada dele ainda não bloqueia o merge pelo Ruleset.

Para migrar o Ruleset em etapa posterior, siga esta ordem:

1. Abra o PR de CI e confira no GitHub os nomes e conclusões dos sete checks
   atuais, de `PR Gate` e de `Dependency Review (critical/high e licencas)`.
   Esse PR aciona `full=true`, pois altera o próprio workflow e os scripts.
2. **Antes do merge desse PR**, adicione `PR Gate` e Dependency Review à lista
   de required checks, mantendo os sete checks antigos e `strict`. Exija
   revisão cruzada da mudança, salve o payload anterior do Ruleset para
   rollback e confirme que todos os checks exigidos passaram.
3. Após o merge, valide PRs reais de cada classe crítica, inclusive full e
   N/A, e uma falha deliberada de job necessário que deve reprovar `PR Gate`.
   Só então remova os sete checks antigos em outra atualização aprovada do
   Ruleset, preservando os dois novos, `strict` e todas as demais regras.

Adicionar os novos checks antes do merge evita a janela em que um job antigo
condicional `skipped` satisfaz o Ruleset enquanto uma falha isolada de
`PR Gate` não bloqueia o merge. Durante a transição, PRs anteriores podem
precisar de novo run para produzir os checks adicionados. Se a política causar
problemas, restaure o payload anterior e trate a exposição resultante antes
de novos merges; para desabilitar temporariamente o roteamento por PR,
introduza por PR uma regra versionada que force `full=true`, ou reverta o PR
de CI, mantendo os checks antigos até o workflow anterior voltar a produzir
todos os nomes.
Nenhuma mudança de produção ou migration integra este procedimento.

Alterações no próprio workflow, detector ou gate ativam `full=true`. Como
esses arquivos vêm do PR, o autor ainda pode tentar modificar o mecanismo de
validação no mesmo PR; revisão humana independente continua necessária para
mudanças de CI. `merge_group` não está habilitado: Merge Queue exige gatilho
e cálculo de diff próprios, inclusive no workflow de Dependency Review, antes
de qualquer mudança de Ruleset nessa direção.
