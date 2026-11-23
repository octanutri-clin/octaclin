# QPRO-07 — recuperação da leitura do histórico

Checkpoint de 23/11/2026. Branch `fix/qst-historico-tentar-novamente`, base
`65ec84192745ca21eb5c2951383281396fa09a51` (merge #573 confirmado).
Risco R2: recuperação de UI sobre leitura já existente. Worktree própria;
alterações de outros agentes e main local preservadas. Sem mudança de API,
BFF, permissão, banco, snapshots, publicação ou conteúdo de versões.

## Problemas comprovados e menor correção

1. Em erro, Tentar novamente chamava `alternarHistoricoVersoes`: fechava o
   painel e não fazia novo GET. Dois REDs funcionais: esperadas 2 consultas,
   recebida 1. Retry agora usa `carregarVersoes` existente, exposto no objeto
   do workspace; wrapper explícito evita passar o evento como ID do formulário.
2. A inspeção visual revelou o JSON de erro bruto no alerta. Novo RED comprovou
   ausência de mensagem adequada. O catch **local do histórico** agora apresenta
   texto fixo seguro e não usa Error.message; o helper de API não foi alterado.

O foco retorna ao cabeçalho do histórico antes de remover o botão de retry.
Loading usa `role=status`; nova falha mantém painel aberto e permite tentativa
manual. A tentativa não salva o rascunho: título não salvo e seleção são
preservados. Fechar/abrir continua sendo a ação exclusiva do cabeçalho.

Arquivos funcionais: `octaclin-web/components/questionarios/area-formularios.tsx`
e `usar-workspace-questionarios.ts`. Testes no arquivo existente
`octaclin-web/tests/visual/questionarios-editor.spec.mjs`.

## Evidências e limites

| Gate | Evidência |
| --- | --- |
| RED recuperação | 2 casos desktop reprovados por uma única leitura após retry |
| GREEN inicial | 4/4 desktop/mobile para recuperação após falha e nova falha |
| Regressão | 54/54 editor/P04/P05 desktop/mobile após o primeiro ajuste, antes da mensagem fixa |
| RED apresentação | Caso dirigido reprovou por não apresentar a mensagem fixa; screenshot sintético mostrou JSON bruto |
| GREEN final dirigido | 4/4 desktop/mobile após o catch local, incluindo foco, loading semântico, seleção, edição não salva e ausência do conteúdo interno |
| Linguagem | Verificador de interface e 8/8 testes da biblioteca aprovados |
| Typecheck/lint | Node22.21.1, typecheck e lint dirigido aprovados |
| Banco/RLS/BFF | NOT RUN nesta rodada: contratos/fronteiras não alterados; não reutilizar mock como prova de autorização real |
| Build completo local | NOT RUN: compilação real dos caminhos exercitados pelo Next e typecheck locais; build oficial permanece gate de CI |
| Leitor de tela manual/aparelho físico | NOT RUN; teclado, semântica DOM e emulação têm limites próprios |
| CI novo HEAD | PENDING antes do envio; conferir o commit exato no GitHub |

As reexecuções dirigidas não aumentam a contagem de 54 cenários distintos.
Playwright usa Next/Chromium reais e BFF/cookies sintéticos, sem pacientes reais.
Dependências locais reutilizadas: Next16.3.8 versus manifesto ^16.4.5; instalação
congelada oficial obrigatória, sem alterar engines ou dependências. Revisão não
amplia a proteção preexistente de concorrência das leituras de versões.

Revisão técnica independente estática `/root/auth2_r4`, sem autoria nem testes
próprios, favorável ao delta inicial e à mensagem segura final. Não é prova de
SQL, produção ou aprovação de merge. UX A/D e B/C pelo papel profissional
favorável; paciente N/A justificado. [Relatório e capturas](../docs/agents/ux/reports/QPRO-07-ABC-2026-11-23/consolidado.md).

Código local validado: `cdf6b7137810b25c31bff708b7e53ab686183082`. Scanner local de segredos, diff e links/hashes conferidos antes do envio.

## Retomada

Preservar PR Draft até checks do HEAD e comentários serem conferidos. Sem merge,
deploy, migrations externas, mudanças de infraestrutura ou alterações FOOD06.
Rollback de código não exige reversão de dados: o incremento não escreve
conteúdo clínico. Para o sucessor, conferir branch/status/HEAD e CI antes de
alterar; nenhuma suíte interrompida é PASS.

Próxima ação: finalizar publicação desta correção e verificar CI do novo HEAD.
Não iniciar automaticamente outra melhoria de produto.
