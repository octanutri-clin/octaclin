# Revisão técnica R4 da Fase 317 — PR #405

Revisão em 2026-10-12, após troca manual para GPT‑6.1 Sol médio.
Base examinada: `a84921fbb4ec98ac267ef262362080698d03e03e`; HEAD recebido:
`68d34203e9499ea5178bde6c410ebb974bf9cb88`. Correções desta rodada pertencem à
mesma branch/PR. O [inventário de fontes](r4-source-inventory.json) registra hashes do código revisado; o [manifesto](r4-verification.json) discrimina comandos e resultados.

Esta é uma segunda revisão assistida com correções, sem independência plena:
o histórico da mesma conversa inclui participação na implementação do núcleo.
Não substitui um revisor que não escreveu a mudança; G02 continua BLOCKED.
A skill security-diff-scan foi consultada, mas seus recursos de preflight e
helpers de execução não ficaram acessíveis no host. A revisão foi manual;
nenhum scan automatizado da skill, SARIF selado ou revisão humana é declarado.

## Escopo e fronteiras examinadas

Diff da fase: configuração, contexto/autorização, serviços, controladores, DTOs,
migration 1070, entidades/registro, isolamento legado, worker, BFF, interfaces,
clientes, fixtures/testes e documentação. Sem auditoria de todo o repositório.
Não houve testes contra staging/produção, acesso a pacientes reais ou ativação.

Ativos: texto/nome/denúncia cifrados, consentimentos, carteira, snapshots,
revisões, nonce e prazos. Atores: Patient da sessão, Professional responsável,
Client da própria clínica e SuperAdmin administrativo. Browser e entradas são
não confiáveis. Backend revalida papel/identidade/carteira e opera com
ExecutorTenant/FORCE RLS. A ativação depende de gate literal e flags default-off.

Foram seguidos os caminhos de transferência, mudança de DOB, revogação, replay,
retirada, retenção/hold, projeção e legado. Não foi identificado bypass confirmado
de tenant/carteira no escopo examinado. Isso não garante ausência de outros bugs.

## Achados reproduzidos e correções

| ID | Evidência anterior | Correção e prova |
| --- | --- | --- |
| R4-01 | Projeção BFF copiava objetos dentro de campos escalares, por exemplo texto ou total de reações. O teste sintético recebeu 200 em vez de rejeição. | Tipos escalares e estruturas aninhadas explicitamente validados; arrays/objetos indevidos e páginas acima de 50 retornam erro fixo. Allowlist continua removendo IDs internos. Teste BFF negativo passou. É uma falha de defesa da projeção; não foi demonstrada exposição real em ambiente ativo. |
| R4-02 | Após retirar comentário, o portal conservava comentário/nomes de curtidas em memória; uma resposta anterior podia recolocá-los. Playwright reproduziu item ainda visível após sucesso. | Limpar projeções e confirmações no reload; geração de leitura descarta respostas antigas, inclusive páginas, comentários, feeds e curtidas. Teste libera resposta atrasada depois do sucesso e confere ausência. Nenhum cache persistente acrescentado. |
| R4-03 | Retirada direta do moderador existia no backend, mas não no BFF/interface. Teste recebeu 404. | Ações fixas para retirada de post/comentário, comentários paginados no console e confirmação explícita. Recarregamento invalida projeções após convite/revogação/moderação/retirada. BFF e Playwright provaram retirada sem denúncia e rejeição de papel administrativo. |
| R4-04 | Texto exibido era abreviado em relação ao termo versionado e não mostrava clínica/profissional. Confirmação de checkbox podia sobreviver a nova geração. | Texto integral proposto; contexto mínimo autorizado da clínica/profissional atual, sem IDs internos; confirmação bloqueada se contexto faltar. Checkboxes são limpos ao recarregar. Testes BFF, PG e Playwright cobrem projeção, contexto e novo aceite explícito. Termo permanece sujeito à revisão operacional humana. |
| R4-05 | Uma segunda retirada com nova chave devolvia versão 3 sem gravá-la; teste PG reproduziu resultado inconsistente. | Nova tentativa contra conteúdo já retirado retorna conflito. Replay com a chave original mantém resultado 2 e não escreve novamente. Prova PostgreSQL confirma versão persistida. |

R4-06: o Demo local smoke do HEAD recebido falhou porque a barra mobile tinha
seis atalhos, enquanto o contrato/teste exige cinco. A inserção também deslocou
Privacidade para fora do recorte fixo de Mais. Corrigido mantendo os cinco atalhos
originais; Mais inclui conquistas e privacidade e exclui seu próprio link. O teste
original não foi afrouxado: asserção de cinco mantida, com novas asserções dos dois
links. Reteste desktop/mobile PASS (2/2), preservando um carregamento do portal.

Correções de fixture não alteraram a segurança do runtime: as primeiras tentativas
novas de escrita RLS falharam por bind/aridade/tipo de parâmetros e não foram
contadas como prova. Após corrigir o fixture, as seis escritas cross-tenant foram
recusadas por row-level security. Um seletor Playwright distinguia mal saída do
círculo/logout; corrigido. A seleção do mesmo círculo não invalida sua leitura.

## Evidências desta rodada

- PASS: PostgreSQL descartável com role NOSUPERUSER/NOBYPASSRLS, migrations reais
  e 21/21 testes do piloto. Inclui seis negativas de INSERT cross-tenant, leituras
  entre tenants, snapshots, troca de carteira/DOB, revogação, replay, retenção,
  contexto do aceite, retirada repetida e corrida publicação/saída.
- PASS: Jest focal do módulo/legado e migration 1070: 16 suites, 76 testes.
  Os 21 testes condicionais de PG foram pulados nessa invocação e executados
  separadamente com sucesso; não são 97 testes aprovados nessa invocação.
- PASS: BFF 8/8; Playwright 12/12 desktop/mobile. Os seis cenários originais
  também executam axe WCAG 2.1 A/AA. Não alegar axe/global em todos os cenários.
- PASS: typecheck/build backend e verificação de `dist/main.js`; ESLint focal
  sem erro/warning após ajuste do controle de leitura.
- PASS: repetição integral `test:authz` até a Fase317 (24 resumos TAP sem falhas;
  um script adicional usa resumo textual), após os fixes BFF.
- PASS: build final com correção do menu (exit0), após encerrar servidor dev e
  remover somente cache ignorado. TypeScript/rotas/artefato web compilados.
- PARCIAL histórico: `test:a11y` global interrompido em 25/274. Não é aprovação
  global de acessibilidade; nenhum percentual de cobertura foi medido.
- CI observado para o HEAD recebido: backend, web, governança, CodeQL,
  Dependency Review, Semgrep e Trivy aprovados; Demo local smoke ainda em
  execução no primeiro polling e depois FAIL na navegação mobile (R4-06).
  Esses resultados não aprovam as correções ainda locais.

Comandos exatos e hashes ficam no manifesto desta rodada. Logs/fixtures são
sintéticos. Aviso pg sobre queries simultâneas na mesma conexão continua sendo
uma limitação observada; nenhuma dependência foi atualizada para ocultá-lo.

## Gates e liberação

| Gate | Estado | Condição restante |
| --- | --- | --- |
| G00 | PASS | Base/branch/worktree/decisões reconferidos |
| G01 | BLOCKED | Revisão final do termo, necessidade legal de retenção e capacidade/rotina de moderação pela equipe |
| G02 | BLOCKED | Revisão independente de autoria; esta segunda revisão assistida não a substitui |
| G03 | PASS local | 21 provas PG descartável; não comprova ambiente externo |
| G04 | IN_PROGRESS | CI do HEAD enviado com as correções; gates locais concluídos |
| G05 | BLOCKED | Preflight/grants/FKs/worker/migration fora de banda e autorização explícita de operação |

Migration 1070 permanece aditiva e inalterada nesta rodada. Não inferir aplicação
em staging/produção pelo merge/CI. Antes de rollout, confirmar alvo/role/grants,
RLS/FORCE RLS, órfãos/unique/FKs NOT VALID, worker/alerta/expurgo e o termo revisado.
O piloto permanece desligado. Não houve migration externa, merge ou deploy.

Rollback funcional: desligar gate/flags e preservar schema, isolamento legado,
revogação, expurgo, snapshots e tombstones. Não usar migration:revert ou imagem
anterior às proteções de isolamento após existir dado do piloto.
