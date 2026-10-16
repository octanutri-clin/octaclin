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
