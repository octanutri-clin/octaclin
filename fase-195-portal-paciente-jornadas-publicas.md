# Fase 195 - Portal do paciente e jornadas publicas

Status: concluida e validada localmente em 2026-08-01.

## Entregue

- Portal autenticado dividido em nove rotas reais, com um unico carregamento
  compartilhado no layout e navegacao inferior de cinco destinos no celular.
- Inicio reduzido a proxima acao, proxima consulta e andamento do plano;
  indicadores de score e risco clinico foram removidos da interface do
  paciente.
- Agendamento publico com nome e cor segura da clinica, fuso IANA validado e
  etapa de revisao antes de enviar a solicitacao.
- Formulario publico com rascunho no backend, debounce de 800 ms, retomada
  apos recarregar e sem `localStorage` ou `sessionStorage`.
- Concorrencia protegida por `rascunho_versao`: uma versao obsoleta recebe
  conflito e nao sobrescreve o rascunho mais novo.
- Validacao estrutural compartilhada entre rascunho e resposta final, limites
  de payload e de abuso, token reduzido a hash na chave do limitador e BFF
  publico sem cookies ou `Authorization`.
- Rascunhos eliminados ao responder ou expirar o envio.
- Migration `1720000001010-AdicionarRascunhoEnviosQuestionario` registrada
  com `up`, `down` e teste de sequencia.
- `FORMULARIO_PUBLICO_SEGREDO` passou a ser dedicado, obrigatorio em producao
  e com minimo de 32 bytes, sem fallback para JWT.

## Commits funcionais

- `97c98ab` - portal do paciente por jornadas (195A).
- `0da5738` - agendamento publico com identidade e confirmacao (195B).
- `cb6a491` - rascunho publico seguro (195C).

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:next15
pnpm --dir octaclin-web run build
pnpm --dir octaclin-web exec playwright test tests/visual/portal-paciente.spec.mjs tests/visual/agendamento-publico.spec.mjs tests/visual/formulario-publico.spec.mjs --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs --grep "portal do paciente" --reporter=list
pnpm security:secrets
pnpm test:confiabilidade
```

Resultados: backend com 64 suites e 351 testes aprovados; 23 verificacoes de
autorizacao/BFF; 50 rotas dinamicas validadas; build web limpo; 14 jornadas
Playwright aprovadas em desktop e mobile; 2 cenarios de acessibilidade do
portal aprovados; scanner de secrets e matriz de confiabilidade sem achados.

## Operacao

- A migration nao foi executada manualmente contra uma URL de banco ambigua.
- `FORMULARIO_PUBLICO_SEGREDO` foi configurado no backend de producao do
  Render em 2026-08-01 com valor novo de pelo menos 32 bytes, sem registrar o
  segredo em codigo ou documentacao.
- O deploy da integracao aplica a migration conforme a politica de migrations
  do ambiente.

## Proxima fase

Fase 196 - Comunicacoes, equipe e conta do cliente.
