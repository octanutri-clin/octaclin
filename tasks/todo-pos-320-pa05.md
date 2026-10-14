# PA05 — checklist de planejamento e implementação

Contrato: [plan-pos-320-pa05.md](plan-pos-320-pa05.md). Base main `64f54b88`.
Implementação autorizada em 2026-10-14; backend implementado, UI pendente. Risco R4 para
persistência, projeção e API; não executar migrations externas.

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
- [ ] Revisão R4 independente final e gate integral Timescale/pgvector (T09).
- [ ] Troca manual para Luna alto após aviso/pausa; contrato backend pronto.

## T07 — formulário/preview profissional (depende checkpoint B; 3–5 arquivos)

- [ ] Painel pequeno separado com dois conjuntos; dirty/save explícito e reidratação.
- [ ] Ocultar apresentação não descarta valores ou validação; alertas sempre visíveis.
- [ ] Falha/409 mantém estado; cancelamento/troca de paciente aborta/reset sem vazamento.
- [ ] Verificação: testes UI/helpers, PA01–04/FND02/cópia e typecheck Web.

## T08 — portal e impressão (depende T07; 3–5 arquivos)

- [ ] Portal respeita conjunto paciente; principal/gramas/escolha atual sempre claros.
- [ ] Recolhimento por versão sem alterar limite 1–20; botão acessível para liberadas.
- [ ] PDF mostra todas as liberadas, nenhuma privada; saída paciente usa DTO backend.
- [ ] Desktop/mobile, teclado/axe, overflow, estados parciais, print media e preferências.
- [ ] Verificação: Playwright focado, BFF/nutrição; ampliar por regressão concreta.

### Checkpoint C

- [ ] T07–T08 PASS; revisão Sol médio de integração, diff clínico e impressão.

## T09 — entrega única (depende checkpoint C)

- [ ] Backend/Web lint/typecheck/build, suítes proporcionais e segredo/diff PASS.
- [ ] Revisão R4 cruzada com autoria/limites, sem alegar independência por autorrevisão.
- [ ] Uma PR integra código/documentos; CI do HEAD, scanners, Demo e PR Gate PASS.
- [ ] Migration externa/deploy/ativação SKIPPED até autorização e alvo confirmado.
- [ ] Atualizar gates reais, handoff, rollback e procedimento de implantação aditiva.

## Evidências desta rodada

PASS: leitura de Git e contratos, merge #418 (`64f54b88`), comparação de árvores
com HEAD aprovado (`37d7979`), `gh pr checks 418` e steps do backend
[116065449406](https://github.com/octanutri-clin/octaclin/actions/runs/38625821164/job/116065449406).
São evidências PA04; testes PA05 ainda não executados. SBOM provenance PA04
SKIPPED conforme workflow, não PASS. Nenhum ambiente externo consultado/alterado.

Verificações documentais finais PASS: `git diff --check`, 23 links locais
conferidos sem ausências e `pnpm security:secrets`. Scanner executado com Node
24.19.0/pnpm 11.19.0, com aviso de engine; não prova os gates do runtime alvo.
Para implementação, usar Node >=22 <23 e pnpm 11.25.0 conforme package.json.
T01–T06 implementados e validados para a superfície PA05. T07–T09 pendentes.

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
- Revisão independente/Playwright/UI/CI/PR ainda pendentes. Sem banco externo,
  merge, deploy ou ativação. Uma PR final reunirá o trabalho.
