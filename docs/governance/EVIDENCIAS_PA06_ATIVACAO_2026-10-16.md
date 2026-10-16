# PA06 — checkpoint backend da ativação

Base e2cb9cdd, branch feat/pos320-pa06-ativacao. Risco R4. Autorização do
proprietário para continuar após merge420; migrations anteriores aplicadas
segundo seu relato. Nenhum banco externo foi consultado/alterado neste ciclo.
A nova1074 permanece pendente de implantação autorizada. UI intocada neste
checkpoint; pausa obrigatória antes de passar T08b ao Luna alto.

## Entrega técnica

- Estados/revisão operacional e eventos separados de snapshots/hashes.
- Identidades lógicas cifradas, raízes inclusive para edição parcial, vínculos
  explícitos por versão. OFF sobrevive a save, reorder, remoção/reinserção e clone.
- Tenant e carteira revalidados; paciente/plano bloqueados antes da decisão.
  Plano OFF prevalece; ON não muda os flags individuais. Primeira publicação
  avança revisão/evento e respeita OFF prévio. Replays obsoletos409.
- Portal singular compatível filtra estados; plural paginado e detalhe negam
  OFF/arquivados/outro paciente. Escolhas revalidam estado na mesma transação.
- Totais vigentes e históricos separados. Prévia/PDF de entrega filtra OFF;
  publicada antiga/OFF bloqueada nesse fluxo, permanecendo no histórico interno.
- Sem pacote externo, alteração do runtime de outras fases ou nova integração.

## TDD e falhas observadas

| Superfície | RED observado | Correção/prova |
| --- | --- | --- |
| Backfill | Dois testes SQL falharam: sem contexto por tenant e desempate UUID | Loop tenant/restauração + empate fail-closed; owner real sob FORCE RLS |
| Writer legado | Trigger de identidade/guard ausente | Trigger aditivo; prova de rejeição depois da decisão |
| Identidade | PostgreSQL rejeitou segundo save sem identidade após OFF | Save/clone informam UUID lógico; parcial e tombstones preservados |
| Portal OFF | Dois negativos falharam: plano e refeição ainda entregues | Filtro backend + escolhas negadas por ID conhecido |
| Publicação inicial | Baseline operacional antigo aceito após publicar | Revisão/evento inicial transacionais; corridas nas duas ordens |
| Erro de banco | Leitura de identidade convertia falha de banco em409 | I/O fora do tratamento de dados inválidos; erro real propagado |
| Total portal | Total vigente ausente; vínculo ausente mostrava zero | Allowlist de nutrientes, parcial por campo e indisponibilidade |
| Limite Unicode | Novo mapa maior que1MiB era aceito | Validação em bytes antes de cifrar/persistir |
| Rascunho parcial | Zero raízes antes da materialização | Raízes criadas ao salvar; chave atual autoriza toggle; remoção nega replay |
| ACK editorial | Faltava revisão operacional no retorno | Flag/revisão explícitas permitem descartar ACK operacional obsoleto |
| Inventário RLS | Exigia policy ALL para evento append-only | Exceção nominal exige exatamente SELECT/INSERT; UPDATE/DELETE continuam negados |

Falhas iniciais de compilação por símbolo ainda ausente (DTOs/métodos novos)
são registradas como scaffolding, não como reprodução comportamental. Os três
testes iniciais do helper puro passaram após criação do arquivo, sem RED
comportamental separado; o limite de bytes teve RED reproduzido posteriormente.
Uma execução PostgreSQL sob carga paralela também teve timeout5s em caso legado;
reexecução serial passou, sem elevar timeout. A primeira suíte integral durante
integração do campo novo do portal teve duas asserts falhando; não é gate final.

## Verificações

- PASS: PostgreSQL15 descartável, schema/migrations reais com quatro adaptações
  explícitas de extensões. Backfill:2 tenants,4 pacientes,8 planos; owner sem
  superuser/BYPASSRLS, contexto restaurado, nenhuma entrega arbitrária em empate.
- PASS:19 casos focados PA04–PA06 + inventário global/RLS sem contexto;
  29 casos fora do filtro SKIPPED. Runtime NOBYPASSRLS e distinto do owner.
- PASS: revisão cruzada estática automatizada por agente diferente da autoria.
  Corrigidos os dois achados e reinspecionadas raízes de edições parciais/policies.
  O revisor não executou testes nem confirmou os resultados locais.
- PASS: suíte integral consolidada332 suítes/2938 testes;6 suítes/118 testes
  SKIPPED por gates/infraestrutura fora da execução unitária local. Nenhum SKIPPED
  é contado como prova de PostgreSQL, provider ou produção.
- PASS: typecheck/build do backend após últimos ajustes, artefato dist/main.js.
- PASS: secrets/diff locais. Governança proporcional e checkpoint no Git ao final;
  resultados complementares abaixo.
- SKIPPED: UI/BFF/Playwright/CI desta entrega — T08b ainda não iniciada.
- SKIPPED: Timescale/pgvector integrais locais; CI continua gate obrigatório.
- SKIPPED: migrations externas, deploy, merge e ativação — sem execução/autorização.

## Comandos reproduzíveis

Node22.21.1/pnpm11.25.0. Ambiente Docker local confirmado pelo socket gerenciado.
Somente dados sintéticos em instâncias descartáveis:

```sh
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
node octaclin-backend/scripts/test-pa05-postgres-local.cjs --ativacao --inventario
pnpm security:secrets
pnpm test:confiabilidade
pnpm test:migracoes-fora-de-banda
pnpm test:guardas-controladores
pnpm test:redacao-auditoria
pnpm test:resposta-auditoria
git diff --check
```

Logs temporários sanitizados desta rodada: /tmp/pa06b-*.log. Não são artefatos
versionados nem prova de ambientes externos. Runbook define rollout e o limite
que proíbe voltar a backend que ignore OFF. A entrega ainda requer UI, CI e
aprovação do proprietário para implantação.

## Governança local do checkpoint

PASS: `test:confiabilidade`, `test:migracoes-fora-de-banda`,
`test:guardas-controladores`, `test:redacao-auditoria` e
`test:resposta-auditoria`. Não substituem os checks de CI da futura PR completa.

## Segundo checkpoint — UI/BFF de ativação

Escopo: T08b concluída localmente na mesma worktree/branch. Os quatro endpoints
BFF novos reutilizam sessão e permissões; consultas do portal usam `no-store` e
allowlist de paginação. O editor usa switches acessíveis com CAS, sem atualização
otimista ou gravação/publicação editorial. Conflito409 reconcilia; resposta
incerta não confirma estado e exige consulta explícita. O portal lista os planos
ativos paginados e mantém o detalhe selecionado oculto durante troca de contexto.

### Verificações executadas

- PASS: `pnpm test:planos-alimentares:bff` —37/37.
- PASS: Playwright `tests/visual/fase-320-pa06-ativacao.spec.mjs` —6/6 em
  desktop-chromium e mobile-chromium; inclui teclado, conflito409, resposta503
  incerta, consulta explícita e paginação/detalhe de 11 planos sintéticos.
- PASS: `tests/visual/pa02-copia-refeicoes.spec.mjs` —24/24 por projeto desktop
  e mobile; `tests/visual/fase-320-pa05-apresentacao.spec.mjs` —4/4 por projeto.
- PASS: `pnpm typecheck` Web. ESLint direcionado: zero erros,10 warnings; 8 em
  padrões preexistentes do editor e2 em efeitos do novo componente de portal.
- PASS: `pnpm build` Web; compilação, TypeScript, 186 páginas estáticas e coleta
  final de traces concluídos. Aviso existente do Next sobre convenção middleware.
- PENDENTE: T09/R4 independente, CI e governança do HEAD continuam pendentes.
- NÃO EXECUTADO: teste de PostgreSQL novo (T08b não altera schema), migration
  externa1074, banco staging/produção, merge, deploy ou ativação.

Comandos reproduzíveis (Node22.21.1/pnpm11.25.0):

```sh
pnpm test:planos-alimentares:bff
pnpm exec playwright test tests/visual/fase-320-pa06-ativacao.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm exec playwright test tests/visual/pa02-copia-refeicoes.spec.mjs --project=desktop-chromium --reporter=list
pnpm exec playwright test tests/visual/pa02-copia-refeicoes.spec.mjs --project=mobile-chromium --reporter=list
pnpm exec playwright test tests/visual/fase-320-pa05-apresentacao.spec.mjs --project=desktop-chromium --reporter=list
pnpm exec playwright test tests/visual/fase-320-pa05-apresentacao.spec.mjs --project=mobile-chromium --reporter=list
pnpm typecheck
pnpm build
```

## Terceiro checkpoint — correções R4 da ativação

A revisão R4 independente identificou dois defeitos concretos. (1) A listagem
profissional não selecionava `ativoParaPaciente` nem `ativacaoRevisao`; o ORM
projetava `false/0` apesar do estado persistido ON. (2) Prévia/impressão carregada
ou em voo podia sobreviver à desativação do plano/refeição e continuar mostrando
conteúdo ao paciente. A investigação local também encontrou reconciliação de GET
operacional atrasado capaz de regredir o mapa de refeições da revisão editorial.

### RED/GREEN

- RED: integração PostgreSQL descartável falhou na asserção da listagem: ON
  persistido foi retornado como `false`, revisão `0`. GREEN: seleção explícita dos
  dois campos e a mesma prova PostgreSQL passou.
- RED: Playwright reproduziu conteúdo de prévia/impressão permanecendo após OFF;
  a resposta tardia também podia imprimir conteúdo obsoleto. GREEN: OFF aborta e
  invalida a projeção, incrementa a sequência, limpa estado local e bloqueia a
  renderização/impressão quando a revisão de ativação não coincide.
- RED: teste BFF de reconciliação observou o mapa antigo após uma resposta
  operacional atrasada. GREEN: ACK atrasado não substitui estado editorial mais
  recente; combinação de revisões contraditórias falha fechada, removendo mapas e
  marcando o resumo de refeições indisponível.
- Evidência de autoria dos testes: BFF `38/38`; PostgreSQL descartável `19 PASS,
  29 SKIPPED` (fixture não cobre Timescale/pgvector); Playwright PA06+PA05
  `22/22` em desktop/mobile. O resultado inclui teste para OFF do plano e da
  refeição, prévia carregada, impressão carregada e resposta de impressão em voo.

### Limites e estado

- Duas leituras R4 independentes, read-only, foram concluídas. A primeira reportou
  os dois achados acima; a segunda confirmou ambos fechados e não encontrou novo
  risco concreto no diff. A segunda leitura verificou BFF/controller/serviços,
  reconciliação, projeção do portal e testes; não executou testes nem consultou
  ambientes. Uma leitura adicional focada no ajuste final de chaves do portal
  confirmou que a guarda não reabre detalhe obsoleto; sem achado. Esta revisão
  estática não substitui os gates dinâmicos abaixo.
- Typecheck Web e teste unitário focado NestJS PASS (`89/89`). `pnpm test:authz`,
  lint Web e typecheck Backend estão em execução; builds e CI do HEAD ainda são
  gates distintos.
- Nenhum teste consultou pacientes ou bancos externos. Migration 1074 não foi
  aplicada; sem merge, deploy ou ativação operacional.

### Fechamento de verificações locais

- PASS: build NestJS e verificação do artefato `dist/main.js`; build Next/Web
  (TypeScript e 186 rotas/páginas geradas); typecheck dos dois projetos.
- PASS: lint global Web sem erros (70 warnings existentes no repositório); lint
  direcionado do componente `plano-alimentar-paciente.tsx` sem warnings.
- PASS: Playwright final PA06 + PA05 `22/22`, desktop e mobile, após os guards de
  revisão de ativação e contexto do detalhe.
- PASS: testes unitários NestJS `servico-planos-alimentares.spec.ts` `89/89`,
  BFF `38/38`, PostgreSQL descartável `19 PASS/29 SKIPPED` e `security:secrets`.
- PASS: matriz de confiabilidade (40 referências), migrations fora de banda
  (13/13), guardas de controladores (11/11), redação de auditoria (24/24),
  runbook de resposta de auditoria e `git diff --check`.
- PASS: `pnpm test:authz` integral; todas as 26 suítes encadeadas concluíram com
  exit 0. Avisos de `headers()` fora do contexto Next foram emitidos pelos testes
  que validam precisamente a chamada isolada; esses casos e o gate passaram.
- Limite de ambiente: Node `v24.19.0`/pnpm `11.19.0`; os manifests pedem Node
  22/pnpm 11.25. Os comandos terminaram nos resultados indicados, mas CI com a
  toolchain declarada ainda é obrigatório.

### Correção do smoke visual do HEAD da PR #421

- RED: o primeiro `Demo local smoke` do HEAD `b7f7d046` executou 878 testes;
  874 passaram e os cenários desktop/mobile do teste de reordenação falharam.
  A falha era no fixture legado: ele não informava `ativoParaPaciente` nem
  `ativacaoEdicao`, então o componente, corretamente, mostrava “A visibilidade
  de uma ou mais refeições não pôde ser confirmada” em vez do estado de cálculo
  indisponível esperado depois de salvar um rascunho pendente.
- Correção: fixture agora representa plano ativo e declara explicitamente as
  identidades/estados ativos das refeições nas versões publicada e rascunho.
  Nenhum comportamento de runtime foi alterado.
- RED local antes da correção: Playwright focal, desktop `1 falhou`, mobile
  `1 passou`, reproduzindo a expectativa incompatível. GREEN após a correção:
  mesmo teste focal `2/2`, desktop e mobile.
- O `Demo local smoke` integral precisa ser executado novamente pelo CI no
  commit corrigido. Não considerar a PR inteiramente green até esse resultado.
