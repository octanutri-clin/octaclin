# Fase 262 - Aceite de usabilidade e prontidao para piloto

Status: em andamento. Incremento 1 concluido tecnicamente em 2026-09-15.

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

- Executar o workflow mutavel de staging no head do PR, sem credencial ou dado
  real em log/artefato.
- Cobrir os quatro papeis no candidato de staging e registrar qualquer P0/P1.
- Nao declarar GO enquanto ClamAV, juridico, dominio/identidade e selecao do
  piloto nao tiverem decisao explicita ou excecao residual aceita.
