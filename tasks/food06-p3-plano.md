<!-- Plano aprovado pelo proprietário em 2026-11-17 (sessão Claude Code). Estado de execução: ver 'Execução' ao final. -->
# FOOD06 P3 — telas web de restrições (plano; nada implementado)

## Contexto

A P2 terminou: a API de restrições está completa no backend, atrás da flag `restricoes.clinicas` (desligada). A P3 cria as telas
do octaclin-web, via BFF, para o profissional, o colaborador e o portal (paciente e representante de vários pacientes), com os
textos das chaves (D7-a, Q11), WCAG 2.2 AA e as etapas UX B e C (ATV-7 e ATV-9 continuam bloqueando a ativação).

**Estado confirmado neste ciclo (2026-11-17):** `git fetch`; `main` = `91241b1`. #552, #553 e #554 mergeadas (GitHub: `merged: true`).
Branch de trabalho `claude/vigilant-rubin-p6gmql`, no mesmo SHA, limpa. Lidos: `AGENTS.md`, `docs/agents/REGRAS.md`,
`docs/agents/ux/PROCEDIMENTO.md`, `tasks/food06-p2-handoff.md`, `tasks/food06-m11-restricoes-contrato-v3.md`,
`tasks/food06-migracoes-fora-de-banda.md`, `STATUS_ATUAL_PROJETO.md` (bloco vigente ainda fala da #455; não cita a P2).

## Fatos do código que mudam o plano (lidos, não executados)

Contrato HTTP real (todas `POST`, 200, sem prefixo; filtro `FiltroRestricoesClinicas` com `Cache-Control: private, no-store`):

| # | Fato | Consequência para a P3 |
| --- | --- | --- |
| F1 | **Não há rota que liste as restrições de um paciente** para o profissional (só `consultar` por `restricaoId`) nem para o colaborador | A aba do profissional não tem o que mostrar. Precisa de leitura nova no backend |
| F2 | **Nenhuma rota lê a avaliação com `venceEm`**; `avaliacao/inicial` devolve só `{id, revisao, situacao}` | O aviso de reconfirmação de 180 dias (Q10/Q2) não é calculável |
| F3 | **`restricoes_registradas` nunca é atribuída**: paciente com restrição confirmada fica `nao_informado`, e `sem_alteracao` global responde 409 a partir de `nao_informado` | A reconfirmação global "sem alteração" é inalcançável para quem tem restrição. Defeito/lacuna da P2 |
| F4 | **Não há como achar o UUID** do colaborador (`conceder`) nem da conta do representante (`registrar`); só o papel Client lista usuários (`cliente/usuarios`). `listar` de delegações e de representantes devolve só UUIDs, sem nome | Sem leitura nova, a tela teria de pedir um UUID digitado e mostraria UUIDs |
| F5 | `inativar` aceita justificativa de **até 1000 caracteres sem quebra de linha** (o DTO diz 4000) | A UI limita a 1000 e sem Enter; decidir se o backend é alinhado |
| F6 | **Todo 409 tem a mesma mensagem** ("Operação indisponível ou concorrente."): revisão velha, chave reusada, limite (100/50/200) e estado incompatível não se distinguem | A UI trata 409 genericamente e antecipa limites pelo tamanho das listas |
| F7 | Flag desligada → **403** genérico (não 404); recurso alheio ou inexistente → 403; 404/429 viram 500 | Não há como a web saber da flag; a entrada some por configuração própria (Q-flag) |
| F8 | Não há edição de conteúdo: "corrigir" = inativar a antiga + registrar a nova; `decidir` de correção só cita revisão da **mesma** restrição | Fluxo guiado "Atender correção" na tela de solicitações |
| F9 | `PedidoPortal` não diz quem é o autor depois da decisão (`podeCancelar` só enquanto aberto); o selo `informada_por_voce` vale para qualquer declaração pelo portal, inclusive de outro representante | "Você pediu" e "por você" não são verificáveis para representante (Q-texto) |
| F10 | Não existe catálogo de alérgenos/alvos semeado; o único alvo construível é `nao_catalogado` + `alvoDeclarado` (texto 1–200) | Registrar e declarar usam texto livre nesta fase |
| F11 | Listas: `solicitacoes/listar` (prof.) corta em 100 sem aviso; seletor do portal corta em 101 sem aviso; `pedidos/listar` tem `maisAntigos`; nenhuma lista tem cursor | "Mostrando as 100 mais recentes" quando `length == 100` |
| F12 | Collaborator não tem área própria na web: usa o console por permissão; prontuário em `app/pacientes/[id]` com abas em `components/pacientes/estrutura-prontuario.ts` | A aba "Restrições" serve aos dois papéis, com ações por papel |

## 1. Fatias (PRs Draft pequenas; o proprietário mergeia; uma escritora por vez)

| PR | Conteúdo | Depende de | Risco |
| --- | --- | --- | --- |
| **P3-0a** backend | Leituras que faltam: `pacientes/:id/restricoes/listar` (Professional com concessão: todas; sem concessão: só as que registrou), `colaborador/pacientes/:id/restricoes/listar` (só as próprias), `pacientes/:id/restricoes/avaliacao/consultar` (`situacao`, `revisao`, `venceEm`, `confirmadoEm`; sem criar). Teto 200 → 409 (igual ao `resumo`). Correção de F3 (Q-B). Sem migration | — | R4 (PHI, authz, carteira) |
| **P3-1** web | Fundação + portal leitura: proxy `_proxy-restricoes.ts`, `lib/restricoes/*` (tipos, validação, projeções), `lib/textos-restricoes.ts`, gate da flag na web (Q-F), BFF `portal/paciente/restricoes/{pacientes,resumo,pedidos/listar}`, página `/portal/restricoes` (seletor, resumo, "pedidos", convite Q11) | — | R4 (PHI no portal) |
| **P3-2** web | Portal escrita: informar restrição (`declarar`), pedir correção/remoção (`pedidos/criar`), cancelar | P3-1 | R4 |
| **P3-3** web | Aba "Restrições" no prontuário: lista, consultar, registrar, confirmar, rejeitar, avaliação inicial; visão do colaborador (registrar + só as próprias) | P3-0a, P3-1 | R4 |
| **P3-4** web | Ações clínicas protegidas: reavaliar, inativar em dois passos (Q3), "Corrigir registro" (NUX-01), reconfirmação global/individual (Q10), declarar ausência | P3-3 | R4 |
| **P3-5** web | Solicitações (profissional): listar, iniciar análise, decidir (explicação × justificativa interna, desfecho guiado) | P3-4 | R4 |
| **P3-0b** backend | Pessoas: candidatos a colaborador (ativos do tenant, com nome), busca de representante por e-mail exato (Q-C), `nome` nas listas de delegações e representantes | — | R4 (PII, authz) |
| **P3-6** web | Equipe: delegação de carteira (titular), representantes (titular e colaborador delegado) | P3-0b, P3-1 | R4 |
| **P3-7** docs | UX C final, relatórios e manifestos, `MATRIZ_CONFIABILIDADE_TESTES.md`, `MAPA_ROTAS_PERMISSOES.md` (marcadas "atrás de flag"), handoff P3 → P4, roteiro do teste de compreensão (ATV-7, **não executado**) | todas | R1 |

Ordem recomendada: **P3-1 → P3-2** (só usam rotas que já existem) em paralelo de revisão com **P3-0a**; depois P3-3 → P3-4 →
P3-5; **P3-0b → P3-6**; P3-7 por último. Se P3-0a/0b não forem aprovadas, ver Q-A: as fatias afetadas encolhem.
Nenhuma fatia liga a flag, faz migration ou deploy. Mobile segue NO-GO (a web responsiva no celular não é o app).

## 2. Jornadas por tela (cenários sintéticos)

Atores: **Ana** (autônoma, com a concessão `restricoes.confirmar`); **Bruno** (titular) + **Carla** (colaboradora delegada);
**Júlia** (paciente, conta própria); **Marcos** (conta própria + representa a mãe e o filho; leitor de tela).

| Tela | Ana (autônoma) | Bruno + Carla (clínica) | Júlia (paciente) | Marcos (representante) |
| --- | --- | --- | --- | --- |
| Aba Restrições (P3-3) | Vê tudo, registra, confirma/rejeita | Bruno igual a Ana. Carla registra pendência e vê **só as que registrou**, com texto próprio de vazio (NUX-02) | — | — |
| Ações protegidas (P3-4) | Reavalia, inativa (2 passos), corrige, reconfirma | Só Bruno (com concessão). Sem concessão: ações ocultas, texto "Somente profissional com permissão clínica" | — | — |
| Solicitações (P3-5) | Lista "não decididas" primeiro, analisa, decide | Só Bruno | — | — |
| Delegação (P3-6) | N/A (sem equipe); a tela diz isso | Bruno concede/revoga a Carla, com aviso "todos os seus pacientes, inclusive futuros" | — | — |
| Representantes (P3-6) | Registra/revoga | Bruno e Carla (delegada) | — | — |
| Seletor (P3-1) | — | — | Não aparece (uma pessoa) | "De quem você quer ver as informações?"; nome fixo no topo e em cada confirmação; troca acessível |
| Resumo (P3-1) | — | — | Grupos, selos, última confirmação, convite Q11 | Igual, com o nome da pessoa no lugar de "você" (PUX-02, Q-D) |
| Informar / pedir / cancelar (P3-2) | — | — | Informa, pede, cancela o próprio | Pedidos de outros representantes aparecem com "feito por outra pessoa que acompanha {nome}", sem botão |

## 3. Estados e limites

- **Carregando:** `Esqueleto` + `aria-busy`; ações desabilitadas; `useRequisicaoCancelavel` aborta resposta velha ao trocar de paciente
  (lição 2026-10-31: chave paciente/seleção/revisão; resposta tardia nunca pinta a pessoa errada).
- **Vazio:** profissional "Nenhuma restrição registrada. Ausência de registro não significa ausência de restrição."; colaborador
  "Você vê apenas as pendências que registrou. Outros registros podem existir." (nunca "nenhuma restrição"); portal: texto da §5.
- **Erro:** `EstadoFalha` com mensagem fixa e "Código para suporte" (`x-request-id`); nunca texto do backend.
- **Conflito 409:** mensagem única (F6); recarrega a lista; **preserva o texto digitado só em memória** (NUX-05/PUX-05), descartado ao sair.
- **Resultado incerto** (rede/500 depois de enviar): "Não conseguimos confirmar se a ação foi concluída…"; bloqueia repetir até
  recarregar (padrão `incerto_bloqueado` de `registro-analise-factual.tsx`; PUX-04 da P2).
- **Sem acesso / flag desligada / revogado no meio (403):** some o conteúdo já carregado e mostra "Não foi possível abrir…".
- **Limites antecipados pela UI** (o 409 residual continua genérico): delegações e representantes "98 de 100", botão desabilitado
  em 100 com o motivo (NUX-06); declarações e pedidos abertos contados no portal, aviso em 50 antes de enviar; `resumo` > 200 → 409
  → "Há muitas informações para mostrar aqui. Fale com {quem}."; listas com 100 itens → "Mostrando as 100 mais recentes";
  `pedidos/listar` usa `maisAntigos`; seletor com 101 → aviso.
- **Campos:** justificativa de inativar ≤ 1000 sem quebra (F5); colar com quebra de linha vira espaço com aviso visível (NUX-12);
  contadores anunciados só perto do limite.

## 4. O que NÃO mostrar a cada papel

| Dado | Profissional c/ concessão | Profissional s/ concessão | Colaborador | Paciente / representante |
| --- | --- | --- | --- | --- |
| Observação interna | Sim | Só nas que registrou | Só nas que registrou | **Nunca** |
| Justificativa (rejeição, inativação, interna da decisão) | Sim (decisão: só a interna da solicitação; as de rejeição/inativação não voltam da API) | Não | Não | **Nunca** |
| Autor (quem da equipe) | Não há na API; mostrar só a origem em texto | Idem | Idem | **Nunca**; só "você/equipe" pelo selo |
| Revisão, ids, chaves, estados internos e enums | **Nunca na tela** (revisão só no estado do componente para CAS) | Idem | Idem | **Nunca** |
| Motivo de inativação | Não exibido após gravar | — | — | **Nunca** |
| Inativas / rejeitadas | Recolhidas | Não | Não | **Nunca** |
| Preferências | Não entram neste fluxo | — | — | **Nunca** |
| Códigos técnicos / texto do backend / `CANARIO_PRIVADO` | **Nunca** | | | **Nunca** |
| Gravidade | Sim | Sim (as suas) | Sim (as suas) | **Nunca** (Q-E) |
| UUID de conta | **Nunca** (nome, com P3-0b) | | | **Nunca** |

## 5. Textos propostos (para aprovar; mapa congelado em `lib/textos-restricoes.ts`)

**Chaves do portal (selos).** Texto do proprietário em negrito; variante proposta onde há fato novo (F9, PUX-02/03).

| Chave | Proposto |
| --- | --- |
| `restricoes.portal.registrada` | **"Restrição registrada no seu acompanhamento"**; representante: "Restrição registrada no acompanhamento de {nome}" |
| `restricoes.portal.informada_por_voce` | "Informação enviada pelo portal; ainda será conferida" (Q-D1) |
| `restricoes.portal.anotada_pela_equipe` | "Anotado por quem faz seu acompanhamento; ainda será conferido" (Q-D2) |

Em todo o portal, `{equipe}` = "quem faz seu acompanhamento" (Q-D2).

**Chaves das solicitações** (o estado interno nunca aparece; sempre seguido de "Resposta da equipe: {explicação}" quando decidida):

| Chave | Proposto |
| --- | --- |
| `restricoes.solicitacao.enviada` | Autor: **"Você pediu uma correção"** / "Você pediu uma remoção". Outro autor: "Pedido feito por outra pessoa que acompanha {nome}". Apoio: "A informação atual continua valendo até {equipe} conferir." |
| `restricoes.solicitacao.analisando` | **"Sua solicitação está sendo analisada"**; no item do resumo: **"Sua equipe de atendimento está revisando esta informação"** |
| `restricoes.solicitacao.atendida` | **"Sua informação foi atualizada"** |
| `restricoes.solicitacao.parcial` | **"Sua informação foi atualizada parcialmente"** |
| `restricoes.solicitacao.recusada` | **"Sua solicitação foi analisada e não houve alteração"** |
| `restricoes.solicitacao.cancelada` | Autor: "Você cancelou esta solicitação"; outro: "Solicitação cancelada" |

Observação: depois da decisão a API não diz quem é o autor (F9); sem P3-0 de autoria, "Você pediu" só é seguro enquanto aberto.

**Portal, demais textos:** abertura **"Solicite uma correção se alguma informação estiver desatualizada."**; vazio "Nenhuma restrição
registrada até agora. Isso não quer dizer que você não tenha restrições. Se tiver alguma alergia ou restrição, informe aqui ou fale
com {equipe}."; convite Q11 "Respondeu um questionário há algum tempo? Se algo mudou, informe aqui ou conte para {equipe}. As
respostas antigas não viram restrição automaticamente."; após informar "Enviamos para {nome}. {Equipe} vai conferir. Em caso de
dúvida ou sintomas, fale com quem faz seu acompanhamento." (**PUX-01, P1: depende de validação clínica, ATV-1/ATV-7**); seletor
"De quem você quer ver as informações?", "Você" / "Você acompanha como responsável" (PUX-08); cancelar: "Cancelar este pedido?",
"Sim, cancelar pedido" / "Não, manter pedido" (foco inicial no "manter", PUX-06); grupos "Alergias", "Intolerâncias", "Outras
condições", "Alimentos que você evita por escolha" ("que {nome} evita" para representante); "Última confirmação pela equipe: {data}"
(ausente quando não houver).

**Erros genéricos (todos os papéis):** 400 "Revise os campos destacados."; 401 "Sua sessão terminou. Entre novamente."; 403 "Não foi
possível abrir esta informação com esta conta."; 409 "Esta informação mudou ou um limite foi atingido. Recarregue para ver a versão
atual." (limite antecipado tem texto próprio, §3); 413 "O texto ficou grande demais."; 5xx/rede depois de enviar "Não conseguimos
confirmar se a ação foi concluída. Recarregue antes de tentar de novo."; leitura "Não foi possível carregar agora. Tente de novo em instantes."

**Profissional:** aviso fixo "Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever."
(sem selo verde); estados "Pendente de conferência", "Confirmada", "Em reavaliação", "Inativa", "Rejeitada"; origem "Registrada por
profissional", "Registrada por colaborador", "Informada pelo paciente ou responsável", "Questionário antigo"; tipos "Alergia
alimentar", "Intolerância alimentar", "Doença ou condição com restrição (ex.: doença celíaca)", "Outra restrição clínica", "Escolha
alimentar"; gravidade "Leve/Moderada/Grave/Não informada" (padrão explícito, NUX-11); motivos "Registro incorreto", "Informação
clínica revisada", "Solicitação fundamentada do paciente", "Outro"; meios "Presencial", "Teleconsulta", "Pelo portal", "Contato
documentado"; resultados "Pendência mantida", "Alteração informada", "Sem alteração", "Sem restrições declaradas"; inativar passo 2
"Você está inativando {tipo} confirmada: {alimento}. O histórico é preservado." botão "Inativar {tipo}"; decisão: campos "O paciente
verá" × "Somente equipe" com prévia do texto ao paciente (NUX-03); delegação "Dá acesso a todos os seus pacientes, inclusive os
futuros, até você revogar."; verificação "Documento apresentado", "Presencial", "Procuração", "Outro".

## 6. Reuso no octaclin-web (lido)

- **BFF:** `lib/server/sessao-bff.ts` (`requisitarBackendAutenticado`, `exigirPermissaoBff`, `cache: 'no-store'`); molde
  `app/api/pacientes/[id]/planos-alimentares/_proxy.ts` (`lerCorpoLimitado`, erros fixos) e o padrão de
  `teor-micronutriente/consulta/route.ts` (valida/allowlist a entrada, **nunca repassa corpo de erro**, projeta a resposta).
  O BFF só exige a permissão grossa (`pacientes.ler`/`gerenciar`, `portal.acessar`); **papel, concessão, carteira, delegação e
  vínculo ficam no backend**. `pacienteId` só na rota, codificado; corpo com `tenantId`/`pacienteId` → 400. CSRF de `middleware.ts`.
- **Sessão/papel:** `obterSessao()` (`lib/auth-api.ts`) só para esconder ações; nunca como autorização.
- **Telas:** aba nova em `components/pacientes/estrutura-prontuario.ts` + `prontuario-paciente.tsx` → `components/pacientes/aba-restricoes.tsx`;
  portal `app/portal/restricoes/page.tsx` + `SecaoPortal`/`linksPortal` em `components/portal/portal-paciente.tsx`, componente próprio
  `components/portal/restricoes-portal.tsx` (como `receitas-compartilhadas-portal.tsx`).
- **UI:** `ModalConfirmacao`, `Campo`/`AreaTexto`/`Selecao`/`Rotulo`, `EstadoVazio`/`EstadoFalha`/`Esqueleto`, `Etiqueta`/`EtiquetaStatus`,
  `AvisoRegiao`, `classificarFalhaInterface` (`lib/erros-interface.ts`).
- **Textos:** mapa congelado no padrão de `lib/textos-referencias-dieteticas.ts`; `pnpm test:linguagem`.
- **Cache/telemetria:** `/portal/**` e `/api/**` já no-store; `public/sw.js` ignora `/api/`; sem Sentry/analytics. Nada clínico em
  `localStorage`/`sessionStorage`/IndexedDB/Cache Storage; rascunho só em estado React.

## 7. Estratégia de testes (TDD: RED antes de cada GREEN)

- **Unidade** (`node:test`, `scripts/restricoes-*.spec.ts`): textos (toda chave tem texto; nenhum texto contém enum/estado interno,
  "seguro/liberado", motivo religioso; critérios 24 e 28), projeções da tela (ocultação da §4 com canários), validação de entrada
  (limites, quebra de linha, enums), cálculo de aviso de reconfirmação (≤ 30 dias/vencida), contagem de limites.
- **BFF/authz** (`scripts/restricoes-bff.spec.ts` + `scripts/test-restricoes-bff.mjs` encadeado em `test:authz`): sem sessão 401 sem
  chamada ao backend; sem permissão 403; Origin hostil 403; campos fora da allowlist e `tenantId`/`pacienteId` no corpo 400; path
  codificado; `cache-control: private, no-store` em toda resposta; erro do backend **não** repassado (canário); 409/403/5xx mapeados;
  o BFF não decide papel (Professional e Collaborator recebem o mesmo repasse; quem nega é o backend simulado).
- **Playwright** (`tests/visual/food06-restricoes-{portal,prontuario,solicitacoes,equipe}.spec.mjs` + fixtures sintéticas;
  desktop-chromium e mobile-chromium): jornadas da §2 com `page.route` do BFF; estados da §3 (carregando, vazio, erro, 409,
  incerto, 403 no meio, limites); troca de pessoa com resposta tardia; nenhum pedido com `tenantId`; `CANARIO_PRIVADO` ausente da
  tela; nada clínico em Web Storage/IndexedDB/Cache Storage (padrão de `pwa-portal.spec.mjs`); dois passos da inativação; Enter
  dentro do modal (lição 2026-11-06).
- **A11y:** axe (wcag2a/aa, 21a/aa) por região em cada spec; jornadas só com teclado; foco visível e devolvido; anúncios
  `aria-live`; reflow 200%/400%; rotas novas na `docs/governance/matriz-acessibilidade.json` (`pnpm test:a11y:matriz`). WCAG 2.2
  além do axe (alvo 24×24, foco não encoberto) verificado por asserção própria. **Leitor de tela real e pessoas: SKIPPED/BACKLOG
  (ATV-7)**, nunca declarado PASS.
- **Backend P3-0a/0b:** unidade + PostgreSQL/RLS (`pnpm test:rls:testcontainers`: outro tenant, outra carteira, colaborador só as
  próprias, flag desligada, teto 200, sem observação para quem não deve); revisão R4 por `tenant-security-reviewer` (mesmo modelo,
  não independente).
- **UX:** A registrada na P3-1 (abaixo); **B** na primeira tela utilizável de cada superfície (portal na P3-1/P3-2, profissional na
  P3-3, equipe na P3-6) com screenshots sintéticos; **C** em cada PR antes de sair do Draft e consolidada na P3-7.

## 8. Gates esperados por PR

Web (P3-1 a P3-6): `typecheck`, `lint` (incluindo testes e fixtures novos), `test:authz`, `test:linguagem`, `test:seguranca-operacional`,
`build`, Playwright novo desktop+mobile, axe/teclado/reflow do spec, `test:a11y:matriz` (quando há rota nova), `test:pwa` (P3-1/P3-2),
`git diff --check`, `pnpm security:secrets` → **PASS**. Backend → **NA**. Leitor de tela real / teste com pessoas → **SKIPPED (ATV-7)**.
HawkScan → **SKIPPED** (sem `HAWK_API_KEY`). `smoke:visual` integral local → **SKIPPED se o tempo não couber**, com o CI `demo-smoke`
como prova (único job que roda Playwright).
Backend (P3-0a/0b): `typecheck`, suíte, `build`, `test:redacao-auditoria`, guardas, `audit:migracoes-fora-de-banda` → **PASS**;
PostgreSQL local → PASS ou **SKIPPED** (Docker), com o CI como prova; web → **NA**; Playwright → **NA**.
P3-7: `test:confiabilidade`, `test:tooling-agentes`, `diff --check`, secrets → **PASS**; resto **NA**.
Em todas: PR Draft; sai do Draft só com CI verde. Não acompanho checks por polling: ao fim de cada push eu digo "responda
**CI verde #NNN** ou cole o nome do job que falhou".

## 9. UX etapa A (+D) feita neste planejamento

Modalidade: **subagentes do runtime com o papel fornecido como prompt** (TOML sha256 `6259b40a…af6d` e `a40b1ded…ff7d7`), duas
instâncias distintas, mesmo brief sintético, **0 chamadas de ferramenta** cada, sem ver o parecer da outra; mesmo modelo do
coordenador → **não independentes**; sem tela nem pessoas. O relatório completo, manifesto e hashes entram na P3-1
(`docs/agents/ux/reports/FOOD06-P3-A-2026-11-17/`) e no `BACKLOG.md`.

| ID | Achado | Recomendação |
| --- | --- | --- |
| NUX-01 P1 | Corrigir = inativar + registrar deixa intervalo sem alergia ativa | APROVAR: "Corrigir registro" registra e confirma a nova **antes** de inativar a antiga (P3-4) |
| NUX-02 P1 | Vazio do colaborador parece "sem restrições" | APROVAR (texto próprio) |
| NUX-03 P1 | Justificativa interna pode ir para o paciente | APROVAR: campos separados + prévia |
| PUX-01 P1 | "Siga as orientações" pode soar como "pode comer" | AVALIAR: texto proposto, validação clínica (ATV-1/7) |
| NUX-04/05/06/09/10/12, PUX-04 a 08 | Fluxo guiado na decisão, rascunho em memória, contadores, motivo de opção desabilitada, "não decididas" primeiro, colar quebra de linha, separação de causas, rótulos de cancelar, selos | APROVAR, exceto PUX-05 (409 indistinto: só o limite antecipado separa) e PUX-04 "Não sei dizer" (Q-G) |
| NUX-07, NUX-08 | Aviso de duplicata; indicador no cabeçalho da ficha | BACKLOG (dependem de P3-0a; avaliar na B) |
| PUX "aviso de decisão" | Notificar o paciente quando decidir | BACKLOG (fora de escopo) |
| PUX-07 selos curtos | Conflita com os textos do proprietário | Q-D |

## 10. Decisões do proprietário (2026-11-17, nesta sessão) — prevalecem sobre o texto acima

| ID | Pergunta | Decisão | Efeito no plano |
| --- | --- | --- | --- |
| Q-A | Backend dentro da P3 | **P3-0a e P3-0b aprovadas** (R4, sem migration) | Fatias como na §1 |
| Q-B | `restricoes_registradas` nunca gravada (F3) | **Corrigir na P3-0a** | Confirmar uma restrição passa a levar a avaliação a `restricoes_registradas` (revisão + histórico + auditoria, na mesma transação, ordem de locks atual); `sem_alteracao` global volta a funcionar. TDD + prova PostgreSQL das duas ordens de corrida com `sem_restricoes_declaradas`. Regras exatas de volta a `nao_informado` ficam como já estão |
| Q-C | Achar a conta do representante | **E-mail exato** | P3-0b: `pacientes/:id/representantes/candidato/buscar` `{email}` → no máximo `{usuarioId, nome}` de conta Patient ativa elegível; "não existe" e "não elegível" com a **mesma** resposta; sem listagem de contas; e-mail nunca em URL, log ou auditoria (só `metadados: {}`); limite de taxa por usuário. Colaborador: `profissional/delegacoes-carteira/candidatos/listar` (Collaborators ativos do tenant, só nome e id). `listar` de delegações e representantes ganham `nome` |
| Q-F | Flag na web | **Configuração própria da web**, desligada por padrão | P3-1: chave lida só em `lib/server/configuracao-acesso-bff.ts` (respeita `test-origem-backend-bff`), exposta à página por um BFF booleano sem dado clínico; ativação exige web **e** backend. Testes ligam só nos mocks |
| Q-D1 | Selo `informada_por_voce` | **Neutro**: "Informação enviada pelo portal; ainda será conferida" | Vale para paciente e representante. "Você pediu uma correção/remoção" só enquanto `podeCancelar` (autor, aberto); depois, "Pedido de correção/remoção" neutro; pedido alheio aberto: "Pedido feito por outra pessoa que acompanha {nome}" |
| Q-D2 | "Equipe de atendimento" | **"Quem faz seu acompanhamento"** em todos os textos do portal | Ex.: "Anotado por quem faz seu acompanhamento; ainda será conferido"; "{quem} está revisando esta informação" → "Quem faz seu acompanhamento está revisando esta informação". Desvio do texto original do proprietário registrado aqui |
| Q-E | Gravidade no portal | **Não mostrar** | Projeção da tela do portal descarta `gravidade`; teste de contrato com canário; revisitar no ATV-7 |
| Q-H | Histórico de revogados | **Não exibir; BACKLOG** | Sem rota paginada; telas só com vigentes |
| Q-G | "Não sei dizer" no portal | **Incluir, gravando `outra_restricao_clinica`** | A equipe vê "Tipo não informado pelo paciente" só se a UI puder distinguir; como a API não guarda essa marca, a tela do profissional mostra "Outra restrição clínica" + origem "Informada pelo paciente ou responsável" (limite registrado) |
| Q-I | "Registrar e confirmar" numa ação | **Não**; confirmar continua separado | "Corrigir registro" (NUX-01) = registrar nova → confirmar nova → só então inativar a antiga, cada passo explícito; se um passo falha, a antiga continua ativa e a tela diz em que passo parou |

Textos da §5 e linhas da §4 ajustados por estas decisões na implementação (fonte única: `lib/textos-restricoes.ts`).

## 11. Próxima ação ao aprovar

Criar `claude/food06-p3-1-portal-leitura` a partir da `main` atual, reconfirmar `git status`/`log`, registrar o relatório UX A em
`docs/agents/ux/reports/FOOD06-P3-A-2026-11-17/` (brief, dois pareceres transcritos, consolidado, manifesto com hashes) e escrever os
primeiros testes RED de `lib/textos-restricoes.ts` e do BFF do portal. Em paralelo de revisão: `claude/food06-p3-0a-leituras` (backend).


## Execução

| Fatia | Branch / PR | Estado (2026-11-17) |
| --- | --- | --- |
| P3-1 | `claude/vigilant-rubin-p6gmql` (a branch desta sessão; os nomes de branch da §11 eram sugestão) | Em andamento: BFF de leitura do portal, textos, tela `/portal/restricoes` (seletor, resumo, pedidos, convite Q11), gate de acessibilidade próprio e relatório UX A |
| Demais | — | Não iniciadas; cada uma em branch própria só com autorização do proprietário |

Desvios registrados na P3-1:
- A chave da web fica em `lib/server/funcionalidades-web-bff.ts` (e não em `configuracao-acesso-bff.ts`), para não misturar opt-in de funcionalidade com a origem do backend. Continua lida só no servidor.
- O BFF de disponibilidade exige sessão e não consulta o backend; o link em "Mais" só aparece com a área habilitada na web.
- O convite Q11 é só texto (sem link para formulários), para não sugerir que respostas antigas viram restrição.

## Decisões do proprietário sobre os achados B/C da P3-1 (2026-11-18)

| ID | Decisão | Efeito |
| --- | --- | --- |
| NUX-14 | **(a)** manter "Outras condições" | Sem mudança de código nem de taxonomia; o rótulo do grupo entra no roteiro do teste de compreensão (ATV-7, P3-7) |
| NUX-20 | **(a)** link para "Mensagens" do portal junto das frases "fale com quem faz seu acompanhamento", **mais** a possibilidade de o profissional configurar um texto com hiperlink ou um botão para link externo (ex.: chamada no WhatsApp) | O link para `/portal/mensagens` entra na P3-2 (só web). O link externo configurável é escopo novo: exige onde guardar a configuração, quem pode editar e validação do link; ver "Link de contato configurável" abaixo |
| NUX-21 | **(a)** não avisar quando a equipe inativa uma restrição | Sem mudança; quando a inativação atende um pedido do paciente, ele já vê o resultado e a explicação. Entra no roteiro do ATV-7 |

### Link de contato configurável (NUX-20, parte nova) — desenho proposto, não implementado

- **Onde:** configuração do profissional responsável (o autônomo configura o seu; na clínica, o titular), lida pelo portal junto do resumo. Alternativa: configuração do tenant (Client). A escolha depende de quem o paciente deve contatar.
- **O que guarda:** rótulo curto (até 60 caracteres, sem quebra) e URL. Só `https:` e, para WhatsApp, `https://wa.me/<número>` ou `https://api.whatsapp.com/send?phone=<número>`; sem `javascript:`, `data:`, credencial na URL nem redirecionadores. Validação no backend (fonte de verdade) e no BFF.
- **Como aparece:** botão ou link com o rótulo e a indicação "abre fora do OctaClin", `target="_blank"` com `rel="noopener noreferrer"`, sem parâmetro que identifique o paciente ou a restrição na URL (nada clínico sai para o destino externo).
- **Risco:** R3/R4 (configuração nova no backend e conteúdo exibido ao paciente; risco de phishing se a validação falhar). Precisa de rota de leitura e escrita, auditoria da alteração e testes negativos de URL.
- **Fatia sugerida:** PR própria depois da P3-2 (backend + tela de configuração + exibição no portal), com etapa UX A curta. Até ela, o portal mostra só o link interno para "Mensagens".
