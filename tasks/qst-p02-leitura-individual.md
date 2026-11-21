# QST-P02 — leitura individual de envios

Branch `feat/qst-p02-leitura-individual`, base `f5df797a` da #567, dependente
por sua vez da #566. PR própria Draft, sem integrar/retargetar dependências
automaticamente. Autorização: “Pode seguir” após proposta de anterior/próximo.

## Escopo

- `Ler envio` abre leitura inline de um registro, com paciente/data/posição.
- Anterior/próximo percorrem só resultados do filtro atual, sem ciclo nos extremos.
- Identidade por `respostaId`: reordenação preserva seleção; remoção/filtro sai
  da leitura e não a reabre quando o envio volta a aparecer.
- Leitura exibe o conteúdo sem alterar o Set de recolhimento da lista.
- Voltar restaura foco ao gatilho original; se ausente/desabilitado, ao grupo
  estável “Leitura dos envios”. Navegar foca o título e atualiza o status.
- Carregamento desabilita navegação, mas permite voltar à lista.
- Desktop tem área de leitura com rolagem própria e cabeçalho fixo nela; mobile mantém fluxo para não cobrir texto
  ampliado. Sem modal novo nem alteração em componente UI compartilhado.
- Sem novas leituras, API, armazenamento, permissões, alteração clínica ou FOOD06.

Arquivos funcionais: `octaclin-web/components/questionarios/area-respostas.tsx`
e `octaclin-web/tests/visual/questionarios-respostas.spec.mjs`.

## Evidências e revisões

RED inicial: página e fixtures prontas, ação Ler envio ausente. Primeiro GREEN:
30/30 desktop/mobile. Revisão técnica estática independente por
`/root/qst_p02_tecnica` encontrou dois P2 não cobertos nesse run: foco ao voltar
com gatilho desabilitado e sticky contido em ancestral overflow-hidden.
Ambos reproduzidos em navegador (RED 2/2) antes das correções. Nenhum assert
foi dispensado; fixação requer prova de rolagem real com resposta longa.

O teste de remoção inicialmente esperava foco em Atualizar, mas o botão fica
inativo durante seu request. O destino requerido foi alinhado ao contrato:
grupo estável quando gatilho não existe; foco da busca é preservado quando
ela causa a remoção. Sem ampliar permissão nem mudar dados.

Resultado final e commits registrados antes do envio. Não considerar resultados
anteriores como PASS do delta posterior. Nenhum teste com paciente/usuário real.

[Relatório UX A/B/C](../docs/agents/ux/reports/QST-P02-ABC-2026-11-21/consolidado.md).
Paciente N/A: nenhum fluxo, conteúdo, envio ou documento do paciente alterado.

## Ambiente e limites

Node22.21.1; Next16.3.8/Playwright1.63.0 locais preexistentes readonly, anteriores
ao lockfile. CI deve provar instalação canônica. Cache/servidor/browser locais
isolados em /tmp; arquivos gerados não entram no commit. Sem dependências novas.
Banco/RLS N/A por ausência de nova fronteira de leitura/persistência.
Leitor de tela humano e usuários reais SKIPPED; axe não os substitui.
Build do delta/CI pendentes; não reexecutar backend sem motivo de regressão.
Rollback: reverter incremento visual; nenhum dado a migrar.

Próximo passo: acompanhar checks e revisar a cadeia #566 → #567 → esta PR,
sem merge ou deploy automático. Não iniciar FOOD08.

## Fechamento funcional local

- PASS: **34/34 Playwright**, 12 P02 e 22 regressões de P01/QST01, zero skipped.
- RED adicional comprovado: trocar duas respostas longas herdava scrollTop180;
  agora o efeito da identidade zera a área antes de focar o título.
- Sticky à janela estava impedido também pelo main global com overflow; adotada
  área própria desktop, sem mudar PortalShell/Cartao ou regras compartilhadas.
- Revisão técnica independente estática reconfirmou as três correções, sem nova
  regressão concreta; execução de navegador pertence ao coordenador.
- Um run intermediário foi interrompido durante a correção e não é PASS.
- A hipótese do destino Atualizar foi substituída pelo grupo, pois o próprio
  botão Atualizar fica temporariamente desabilitado; assert de foco preservado.
- CI/build canônico do novo HEAD pendentes; não inferir sucesso do CI das bases.


Código validado: `1b3dd45f`. ESLint afetado, typecheck final Node22, linguagem,
diff e scanner local de segredos PASS. CI/scanners remotos ainda pendentes.
