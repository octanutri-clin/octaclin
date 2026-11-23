# Registro de execução — plan-questionarios-10-prs.md

Base inicial989f4d5c. Plano aprovado integralmente pelo proprietário.
01–10: pendentes inicialmente; só marcar concluído com evidências específicas.

## Pré-voo e decisões

- Regras AGENTS/REGRAS e worktrees verificadas; preservar Claude/FOOD06/575/582.
- Interfaces:02 compartilha AreaRespostas com01;03–05 compartilham formulário;
 07 produz leitor histórico usado por08/10;08 limita alcance dos resumos/CSV;
 09 toca agendador/migration e exige exclusividade e provas reais.
- Ruling: empilhar explicitamente novas branches/PRs dependentes quando a
 anterior ainda não estiver mergeada — evita integrar implicitamente código
 alheio; custo: revisão/merge devem seguir a ordem declarada.
- Ruling: skill cloud sem scripts locais do pacote; manter ledger versionado
 equivalente aqui — retomada deve confiar em gitlog/evidências, sem recriar.

## PR lógica01 — variação neutra

Estado: RED confirmado — indicador “Aumentou: +2” ausente no cenário positivo. Base989f4d5c, branchfeat/qst10-01-variacao-neutra.

01: primeira chamada de regressão feita no cwd raiz, sem configuração Web: falha de setup, cancelada; não é RED funcional. Reexecução no pacote Web.

01: implementação PASS, commits4c6db428(C1)/8ab4dc1e(C2). GREEN2/2 e
regressão70/70 desktop/mobile(3,4min), Node22.21.1 typecheck/lint/linguagem/
segredos/diff PASS. Sem alteração do cálculo. Dependências reutilizadas
Next16.3.8 versus manifesto^16.4.5: CI canônico pendente. Banco/RLS/build
completo local SKIPPED, fronteiras não alteradas. UXA aprovado no plano;
B/C e revisão estática final do lote pendentes, sem declaração de aceite.
PR01 mantém Draft e não herda PASS de outro commit.

## PR lógica02 — organização da leitura

Base19c94939, branchfeat/qst10-02-organizar-leitura; dependência explícita da01.
RED: abaEnvios ausente. GREEN4/4 desktop/mobile, contexto/filtros/leitura/foco,
axe200% PASS. Código9285ce6d congelado; typecheck/lint PASS. Regressão74casos
em execução, NÃO PASS até resultado. Nenhuma alteração de API/storage.
Ruling: preparar próxima worktree enquanto regressão do pai roda, sem alterar
código do pai; só publicar pai após resultado. Se falhar, corrigir e propagar
explicitamente a dependência, revalidando filhos. Custo: eventual retrabalho.

02: regressão final74/74 PASS(4,3min), código9285ce6d + checkpointb2a59f83,
typecheck/lint/linguagem/segredos/diff PASS. Publicação sobre01 explícita.

## PR lógica03 — pendências do paciente

Baseb2a59f83. RED resumo ausente + campo sem nome acessível. Após resumo/nome,
RED adicional reproduziu vazio numérico: esperadas3pendências, recebidas2.
Implementação mínima mantém vazio como stringvazia, filtrada do envio; zero
informado continua número0. Backend/capabilities/contratos não alterados.
Suíte formulário16casos e typecheck em execução, ainda NÃO PASS.

03: implementação/regressão16/16 desktop/mobile PASS(1,4min); reforço final
axe/200%2/2 PASS incluído nos16cenários, não somar reruns. Typecheck e linguagem
PASS Node22.21.1; lint0erros,1warning preexistente set-state-in-effect no
carregamento original(sem alteração desse efeito), não escondido. Segredos/
diff PASS. Commits40a50dd6(C1)/4748893f(C2). Sem prova de banco/RLS/build
completo local ou leitor de tela manual(SKIPPED, fronteiras não alteradas).
UX B/C e revisão final do lote pendentes; nenhuma declaração de aceite final.

## PR lógica04 — índice de seções

Based68607e8. RED: navSeções inexistente. Implementação usa IDs gerados,
nunca nomes livres; foco noheading e URL preservada, só se maisde1seção.
Caso desktopdeíndice PASS; regressão20casos e typecheck ainda em execução,
sem declaração de PASS até resultado. Código congelado para preparar05.

04: regressão20/20 desktop/mobile PASS(1,4min), typecheck/linguagem PASS,
lint0erros/mesmo warning preexistente no carregamento.
Ruling: executor ficou sem espaço ao criar05(ENOSPC, não falha funcional);
removidas só cópias limpas próprias01–03 comSHAremotoidêntico, preservando
branches/commits/PRs. Reutilizar sequencialmente worktree04 para próximas
branches próprias, sempre após commit/push/statuslimpo. Custo: caminhos físicos
antigos deixam de existir; código/evidências permanecem noGit/PRs.
04 ganha commitdocumental adicional por essa recuperação/evidências finais.
Fonte/código permanecem inalterados; diretóriosClaude e arquivos históricos
alheios não foram removidos. Espaço livre169MiB após recuperação.
