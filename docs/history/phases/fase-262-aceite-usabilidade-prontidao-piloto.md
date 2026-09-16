# Fase 262 - Aceite de usabilidade e prontidao para piloto

Status: em andamento. Incrementos 1 a 3 concluidos tecnicamente em 2026-09-16;
decisao atual `NO-GO temporario` pelos gates externos listados abaixo.

## Objetivo

Decidir a prontidao para um piloto assistido com evidencia de jornadas, e nao
somente pela soma de testes unitarios. A fase cobre SuperAdmin, cliente,
profissional e paciente em desktop e web movel, usa apenas dados sinteticos e
nao habilita o app Expo nem substitui aceite juridico ou decisao humana de GO.

## Plano de execucao

1. Consolidar um baseline automatizado dos quatro papeis e reprovar qualquer
   excecao de navegador escondida por uma assercao funcional verde.
2. Executar as jornadas mutaveis no staging isolado, com fixtures sinteticas,
   sem envio externo e com verificacao de isolamento por tenant/papel.
3. Corrigir todo P0/P1 encontrado e repetir acessibilidade, desktop, web movel,
   observabilidade, suporte e rollback no mesmo artefato candidato.
4. Reconciliar backup/restore, excecoes de seguranca, juridico e operacao e
   registrar decisao humana de GO/NO-GO. Pendencia externa nao sera convertida
   em verde documental.

## Incremento 1 - baseline sem falso verde

O comando `pnpm test:fase262` agrega:

- 12 jornadas criticas de cliente, profissional e paciente, seis por viewport;
- 4 cenarios SuperAdmin de LGPD e rollout, dois por viewport;
- os projetos `desktop-chromium` (1366 x 900) e `mobile-chromium` (Pixel 5).

No primeiro run, as 12 jornadas criticas foram reportadas como aprovadas, mas o
console continha uma excecao de `ProntuarioPaciente` e avisos de chaves React
duplicadas. A causa nao era um contrato real do produto: o mock
`**/api/pacientes**` interceptava tambem subrotas de prontuario e tratava todo
`POST` abaixo de pacientes como novo cadastro. Assim, devolvia uma lista onde a
tela esperava um prontuario e inseria o mesmo paciente mais de uma vez.

O gate passou a coletar `pageerror` e `console.error` por teste e reprovar no
`afterEach`. Erros genericos de carregamento HTTP ficam fora desse coletor,
porque estados 4xx/5xx sao exercitados deliberadamente em outras jornadas; a
excecao de JavaScript e os erros React continuam bloqueantes. O mock foi
restringido ao pathname exato `/api/pacientes`, e o convite sintetico passou a
preencher `id` e `tenantId` como exige o contrato.

### Evidencia TDD

- RED: o cenario profissional desktop reprovou com a excecao do prontuario e
  as chaves duplicadas que antes apareciam apenas no log.
- GREEN direcionado: o mesmo cenario passou sem erro apos restringir o mock.
- GREEN completo: `pnpm --dir octaclin-web test:e2e:criticas` aprovou 12/12.
- GREEN SuperAdmin: os cenarios LGPD e rollout aprovaram 4/4.

## Incremento 2 - candidato no staging mutavel

O workflow manual `OctaClin staging E2E mutavel` foi repetido no `main` com
seguranca dinamica explicitamente autorizada, branch Neon descartavel e somente
dados sinteticos. A primeira execucao do candidato (`35102212700`) passou por
migrations, role runtime, RLS forcada, isolamento entre dois tenants, jornadas
mutaveis, probes com orcamento fechado e OWASP ZAP. Ela reprovou corretamente
no onboarding da Fase 228: convites de staff tentavam redefinir a senha sem os
aceites obrigatorios de Termos de uso e Politica de privacidade.

O PR `#246` centralizou a ativacao sintetica de primeiro acesso com os dois
aceites explicitos e adicionou uma regressao ao contrato de staging, sem
relaxar a validacao da API. Depois do merge `64da9be`, o CI pos-merge
`35105349112` passou, incluindo o smoke local. A repeticao remota
`35108404379` aprovou o fluxo completo: migrations, dois tenants/RLS, jornadas
mutaveis, DAST/fuzz, ZAP, onboarding de proprietario/profissional/paciente,
publicacao de evidencias sanitizadas e exclusao do branch Neon descartavel.

Nenhum P0/P1 permaneceu aberto no candidato exercitado. Isso conclui o gate de
staging mutavel da fase, mas nao equivale ao GO do piloto nem prova os gates
externos descritos abaixo.

## Incremento 3 - reconciliacao operacional e decisao atual

A reconciliacao de 2026-09-16 confirmou por leitura publica sanitizada:

- `/health/pronto` HTTP 200, com banco e migrations `ok`;
- `/health/detalhado` HTTP 200, `degradado` somente em `antimalware`; backend,
  banco, migrations, Redis, email, WhatsApp, Google Calendar e IA ficaram `ok`;
- `/login` HTTP 200 com a identidade OctaClin;
- o monitor agendado `35116115427` reprovou de forma fail-closed por esse
  estado degradado e deduplicou o incidente existente `#234`;
- o backup diario `35074836592` aprovou dump, estrutura, checksum, envio ao B2
  privado e verificacao remota; o restore nao era devido nessa rodada;
- o ultimo restore recorrente devido, `34747454997` de 2026-09-13, aprovou
  validacao do destino e restore dedicado.

Foram renovados com sucesso os contratos locais de backup/restore, backup de
producao, monitor externo, smoke de producao somente leitura, suporte, operacao
de lancamento e rollout seguro. Portanto observabilidade, backup/restore,
suporte e rollback estao tecnicamente reconciliados para o candidato atual.

A decisao permanece `NO-GO temporario`: nao ha P0/P1 funcional conhecido no
candidato, mas faltam ClamAV/encerramento da issue `#234`, aceite juridico,
dominio/identidade oficial e selecao do primeiro cliente piloto. Esses itens
podem aguardar sem bloquear o desenvolvimento independente do produto, mas nao
podem ser reinterpretados como aceite do piloto.

## Estado operacional observado na abertura

- Produção: backend readiness `200`, web login `200`, banco e migrations `ok`.
- Migrations: 58 registradas; `1039` a `1045` aplicadas em staging e producao.
- ClamAV: health `degradado`, aguardando capacidade gratuita de infraestrutura.
- Incidente `#234`: permanece aberto enquanto o monitor detalhado continuar
  degradado pelo ClamAV; readiness e migrations saudaveis nao encerram esse
  gate.
- GitHub: zero PRs abertos, zero Dependabot, zero Secret Scanning; 217 alertas
  Trivy de imagens permanecem abertos sob as excecoes/revisoes de upstream.
- Mobile Expo: continua NO-GO para distribuicao.

## Criterios para o proximo incremento

- Provisionar ClamAV sem recurso pago ou registrar decisao humana explicita
  sobre a excecao residual; manter `#234` aberta enquanto o health degradar.
- Obter aceite juridico, dominio/identidade oficial e selecionar o primeiro
  cliente piloto fora do Git.
- Registrar a decisao humana final de GO somente depois desses gates.
- Nao declarar GO enquanto ClamAV, juridico, dominio/identidade e selecao do
  piloto nao tiverem decisao explicita ou excecao residual aceita.
