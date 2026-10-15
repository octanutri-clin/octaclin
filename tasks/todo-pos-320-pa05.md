# PA05 — checklist de planejamento e implementação

Contrato: [plan-pos-320-pa05.md](plan-pos-320-pa05.md). Base main `64f54b88`.
Implementação autorizada em 2026-10-14; backend e UI implementados na worktree.
Risco R4 independente e gates de entrega permanecem pendentes; não executar
migrations externas.

## T00 — planejamento (documental)

- [x] PR #418 mergeada; base idêntica ao HEAD aprovado, checks aplicáveis PASS.
- [x] Confirmar PostgreSQL real/RLS da PA04 no job backend do CI 38625821164.
- [x] Preservar worktree principal e alteração local em next-env.d.ts.
- [x] Consultar somente R014/R041; fixes de versão, licenças e arquivos registrados.
- [x] Auditar save/read/hash/clone, portal, impressão, tipos e BFF.
- [x] D01: profissional + portal + impressão/PDF, configurações separadas.
- [x] D02: por versão, todas as refeições; publicada imutável.
- [x] D03: recolher substituições, mantendo acesso às liberadas.
- [x] Fechar gaps G01–G09, rollback e estratégia de TDD/CAS.
- [x] Validar diff, links locais e scanner de secrets; resultado registrado abaixo.

## T01 — domínio de apresentação (depende T00; 2–3 arquivos)

- [x] RED/GREEN de booleans estritos, versão desconhecida, defaults legados vs corrupção.
- [x] Flag não altera nutrientes, porções, autorização, limites ou escolha.
- [x] Projeção paciente permite apenas conjunto paciente; sem campos internos.
- [x] Verificação: Jest específico do novo helper/DTO; revisão do contrato.

## T02 — persistência aditiva (depende T01; 3–4 arquivos)

- [x] Reconferir numeração; migration nova com coluna bytea nullable e revisão inteira.
- [x] Entidade/registro alinhados; defaults/check; nenhuma migration antiga editada.
- [x] PostgreSQL descartável: registros antigos intactos, cifra e FORCE RLS existentes.
- [x] Verificação: opcoes-typeorm specs e fixture sintética; plano externo separado.

## T03 — save e conflito (depende T02; 3–4 arquivos)

- [x] RED/GREEN: payload explícito exige rascunhoId/revisão esperados; conflito 409.
- [x] Tudo na mesma transação; replay/erro não altera filhos, metas ou apresentação.
- [x] PUT legado omisso conserva preferências; leitura expõe apenas DTO permitido.
- [x] Verificação: serviço/DTO/controlador e integração PG, sem mocks como prova de lock.

### Checkpoint A

- [x] T01–T03 PASS; concorrência CAS real, DTO e defaults coerentes; typecheck backend.

## T04 — ciclo da versão (depende T03; 2–3 arquivos)

- [x] Publicação inclui snapshot conferido e hash novo; edição invalida revisão.
- [x] Nova versão copia prefs, novo ID; revisão1 com snapshot, zero somente legado; versão antiga nunca é reescrita.
- [x] Cópia de refeição/modelo conserva configuração destino; matemática inalterada.
- [x] Verificação: RED/GREEN serviço de planos, regressões clone/revisar/publicar.

## T05 — projeção paciente e preview (depende T04; dividir subetapas <=5 arquivos)

- [x] Helper reutilizado por portal e preview profissional autorizado; filtro de liberadas.
- [x] Portal só publicado atual; draft preview marcado como rascunho, não entrega.
- [x] Nunca retornar prefs profissionais/cipher/CAS em resposta ao paciente.
- [x] BFF usa wrappers e no-store; parâmetros limitados, sem tenant/escopo arbitrários.
- [x] Verificação: Jest portal/controladores, scripts BFF/authz e respostas allowlisted.

## T06 — provas PostgreSQL/RLS (depende T05; 1–3 arquivos)

- [x] Role sem BYPASSRLS/não owner, FORCE RLS, tenant A/B e carteira A/B.
- [x] Revalidação após transferência/arquivamento/acesso revogado, sem prévia anterior.
- [x] Barreiras para save/save e save/publicação; uma escrita aceita, outra conflita.
- [x] Snapshot correto após clone, histórico e clients legados; sem commit parcial.
- [x] Verificação: pnpm --dir octaclin-backend test:rls:testcontainers e suíte PG alvo.

### Checkpoint B

- [x] T04–T06 PASS para a superfície PA05; contrato estabilizado e autorrevisão.
- [x] Revisão R4 estática independente após quatro correções.
- [x] Gate integral Timescale/pgvector no CI: 66/66 PASS no HEAD `4eafd661`.
- [x] Troca manual para Luna alto confirmada; T07–T08 executados nesta etapa.

## T07 — formulário/preview profissional (depende checkpoint B; 3–5 arquivos)

- [x] Painel separado com conjuntos profissional/paciente, prévia profissional e salvar explícito.
- [x] Rascunho reidrata pelo DTO; CAS envia ID e revisão reais; conflito 409 preserva valores locais.
- [x] Snapshot ilegível bloqueia salvar até revisão explícita; falhas não descartam a edição.
- [x] Prévia/saída profissional removidas ao editar ou trocar a versão; impressão usa projeção paciente.
- [x] Playwright sintético cobre defaults/corrupção, CAS, 409, prévia e falha de impressão.
- [x] Typecheck Web passou; lint direcionado sem erros (avisos existentes documentados abaixo).

## T08 — portal e impressão (depende T07; 3–5 arquivos)

- [x] Portal respeita preferências do paciente; principal, medida e escolha atual continuam claros.
- [x] Recolhimento por versão com botão acessível; preferências não alteram o limite legado 1–20.
- [x] PDF usa projeção allowlisted e imprime todas as alternativas autorizadas, sem privadas.
- [x] Preview de rascunho é somente leitura e explicitamente marcado; impressão sempre busca versão publicada.
- [x] Falha/requisição obsoleta não imprime projeção antiga; desktop/mobile, Axe e overflow cobertos.
- [x] Suíte conjunta final: PA05 8/8 + portal/cópia 42/42 em desktop/mobile, total 50/50.

### Checkpoint C

- [x] T07–T08 PASS nos checks locais descritos abaixo; sem erro de typecheck ou lint.
- [x] Revisão Sol6.1 médio e revisão independente; quatro defeitos reproduzidos/corrigidos.

## T09 — entrega única (depende checkpoint C)

- [x] Backend/Web lint/typecheck/build, suítes proporcionais e segredo/diff PASS.
- [x] Revisão R4 cruzada com autoria/limites em `docs/governance/REVISAO_R4_PA05_2026-10-14.md`.
- [ ] Uma PR integra código/documentos; CI do HEAD, scanners, Demo e PR Gate PASS.
- [x] Migration externa/deploy/ativação SKIPPED até autorização e alvo confirmado.
- [x] Atualizar gates reais, handoff, rollback e procedimento de implantação aditiva.

## Evidências desta rodada

T07–T08 (Luna alto) implementados e validados nesta worktree: `pnpm typecheck`
PASS; lint focado PASS sem erros, com avisos em hooks/refs no arquivo profissional
(4 avisos de hooks/refs) e middleware deprecado pelo Next; Playwright PA05 dedicado
6/6 PASS (3 cenários desktop/mobile, incluindo descarte de resposta após troca de
plano); regressões direcionadas de portal e cópia 6/6 PASS (3 cenários
desktop/mobile). Uma tentativa anterior da suíte ampla de 38 testes foi cancelada
após timeouts com servidor Next órfão; os cenários relevantes passaram ao reiniciar
o servidor. `git diff --check` PASS. Nenhuma migration externa, PR, merge ou deploy
foi executado.

T09 continua pendente: gates finais e CI completo do HEAD da PR única.
A revisão estática independente R4 foi concluída após as correções do Sol.
Não confundir os checks locais com os
gates de PR nem com liberação assistencial.

PASS: leitura de Git e contratos, merge #418 (`64f54b88`), comparação de árvores
com HEAD aprovado (`37d7979`), `gh pr checks 418` e steps do backend
[116065449406](https://github.com/octanutri-clin/octaclin/actions/runs/38625821164/job/116065449406).
Esse bloco registra evidências históricas de PA04 consultadas no T00; não substitui
os testes PA05 registrados acima. SBOM provenance PA04
SKIPPED conforme workflow, não PASS. Nenhum ambiente externo consultado/alterado.

Verificações documentais finais PASS: `git diff --check`, 23 links locais
conferidos sem ausências e `pnpm security:secrets`. Scanner executado com Node
24.19.0/pnpm 11.19.0, com aviso de engine; não prova os gates do runtime alvo.
Para implementação, usar Node >=22 <23 e pnpm 11.25.0 conforme package.json.
T01–T08 implementados e validados para a superfície PA05. T09 pendente.

## Checkpoint técnico Sol → Luna

- PASS: suíte focada de domínio/DTO/serviço/portal/controlador/migration/registro.
- PASS: BFF 27/27; typecheck Web/backend, build backend e lint Web focado.
- PASS: duas provas PostgreSQL 15 descartável com RLS/role sem BYPASSRLS/não
  owner, CAS save/save, save/publicação, preview/transferência e replay de geração.
- A fixture local não prova Timescale/hypertables ou pgvector. Essas extensões
  são omitidas e embedding da IA usa array somente na fixture; SQL de tabelas,
  colunas/constraints/policies de planos e migration1072 executados sem alteração.
  Gate integral continua no CI por Testcontainers padrão; ENOSPC não é PASS.
- RED/GREEN: persistência/CAS (8 casos falharam antes), rota/projeção ausente,
  duas bordas de clone que transformavam perda de snapshot em legado.
- Evidências finais, comandos e contagens em
  `docs/governance/EVIDENCIAS_PA05_BACKEND_2026-10-14.md`.
- Neste checkpoint histórico backend, revisão R4/CI/PR ainda estavam pendentes.
  A revisão estática R4 final e o resultado UI estão registrados abaixo.

## Integração final Sol6.1 médio

- PASS: revisão R4 estática independente após quatro achados corrigidos com RED,
  sem novo achado concreto na reinspeção; relatório em
  `docs/governance/REVISAO_R4_PA05_2026-10-14.md`.
- PASS: suíte visual conjunta 50/50, incluindo 8 casos PA05 e 42 regressões de
  portal/cópia, desktop/mobile, print media e Axe nas preferências.
- PASS: 4/4 casos adicionais de teclado/acessibilidade, incluindo troca de
  checkbox por Space e regressão do estado vazio do plano no portal.
- PASS: regressões dedicadas PA02/PA03, 38/38 desktop/mobile. RED adicional
  reproduzido no seletor parcial “Horário”, que passou a selecionar a checkbox
  “Horários” das preferências; nome exato corrige o teste sem alterar runtime ou
  enfraquecer a asserção de preservação do horário. GREEN integral 38/38.
  Comando: `E2E_WEB_URL=http://localhost:3012 pnpm --dir octaclin-web exec playwright test tests/visual/pa02-copia-refeicoes.spec.mjs`
  com Node22.21.1/pnpm11.25.0; evidência local `/tmp/pa05-pa02-full.log`.
- PASS: typecheck/build backend e prova PostgreSQL15 real conjunta 3/3 PA04/PA05;
  os 31 casos não selecionados nesta fixture são SKIPPED, não PASS.
- PASS: Web lint completo, 0 erros/66 avisos; scanner de secrets, governança de
  migrations, matriz de confiabilidade e guardas de controladores.
- PASS: Web build e typecheck final com Node22.21.1/pnpm11.25.0.
- FAIL corrigido: primeiro CI da PR #419, `38653741126`, HEAD `baa25a3f`,
  detectou contaminação entre fixtures PA05/PA04. Reprodução local RED; casos
  PA05 passaram a usar identidades próprias, sem alterar expectativas PA04.
  Nova prova conjunta GREEN 3/3; CI integral precisa ser reexecutado.
- PASS: autorização BFF completa local. CI `38654959106`, HEAD `4eafd661`:
  Backend 331 suítes/2.923 testes PASS, 2 suítes/41 testes SKIPPED; PostgreSQL/RLS
  integral 66/66 PASS, Redis 2/2 PASS, Web e Governança PASS. Demo/PR Gate pendentes.
- SKIPPED local: gate integral Timescale/pgvector por espaço Docker disponível;
  aprovado no CI conforme evidência acima. PowerShell preflight não está instalado neste host;
  verificações documentais proporcionais executadas e governança no CI.
- Sem merge, deploy, migration externa ou ativação. Migração1072 precisa do
  procedimento separado em `docs/governance/IMPLANTACAO_PA05_MIGRATION_1072.md`.
