# QST-P01 — busca e leitura profissional

Branch `feat/qst-p01-busca-respostas`, base `9adc6d2e` da PR #566.
PR própria Draft empilhada sobre `feat/qst01-respostas-recolhiveis`: não alterar
o código nem integrar a #566 automaticamente. Depois de sua integração autorizada,
reconferir a base antes de retargetar. Nenhum merge/deploy está autorizado.

Autorização: continuidade das pequenas melhorias profissionais, sem aguardar o
CI integral. Escopo P01: realce literal da busca, contador de envios exibidos e
limpeza com retorno de foco. P02 anterior/próximo permanece próximo incremento.

## Contratos e comportamento

- Busca e filtros existentes preservados; sem alteração do workspace, API ou BFF.
- Realce em nomes, enunciados e valores da lista de envios. Usa `mark`/React,
  sem HTML bruto, regex do usuário ou normalização diferente da busca pt-BR.
- Mapa de offsets preserva texto original quando lower-case expande caracteres.
- Contador só da lista exibida, com escopo explícito; carregamento anuncia
  atualização em vez de apresentar uma contagem antiga como resultado atual.
- Limpar mantém paciente/questionário/recolhimento; foco retorna ao input.
- Sem novos requests, gravações, armazenamento local, permissões ou dados clínicos.
- Conteúdo recolhido não abre automaticamente; pesquisar continua encontrando-o.

Mudanças funcionais apenas em `octaclin-web/components/questionarios/area-respostas.tsx`.
Testes em `octaclin-web/tests/visual/questionarios-respostas.spec.mjs`.

## Validação e limites

RED funcional: página e fixtures carregadas; falha na ausência do status/contador.
Primeiro GREEN: 20/20 navegador desktop/mobile. Testes adicionais de loading,
filtro/recolhimento/storage e axe nos controles foram incluídos após revisão;
resultado final registrado abaixo antes do envio.

Um run intermediário foi interrompido durante a preparação e não conta como PASS.
Outro revelou CSS não gerado porque o servidor foi iniciado na raiz do monorepo;
confirmado aviso Tailwind de content vazio. Reinício na pasta Web com cache novo
da própria tarefa resolveu, sem mudar configuração/dependências ou enfraquecer
asserts de overflow/foco. Não atribuir essa falha de setup a um defeito funcional.

Node22.21.1 e dependências preexistentes somente leitura (Next16.3.8,
Playwright1.63.0), anteriores ao lockfile da branch. CI canônico pendente.
Diretórios temporários/config de execução não versionados; sem alterar timeouts.
Build global novo: não executado localmente; CI aplicável pendente.
Banco/RLS: N/A para alteração local de apresentação sem nova fronteira de acesso.
Leitor de tela humano e usuários reais: SKIPPED; axe/teclado não os substituem.

Revisão técnica independente `/root/qst_p01_tecnica`: estática, sem bug concreto;
lacunas menores de testes incorporadas; não executou testes próprios.
[UX A/B/C e limitações](../docs/agents/ux/reports/QST-P01-ABC-2026-11-21/consolidado.md).
Rollback: reverter este incremento visual, sem dados a migrar.

## Próxima ação

Conferir CI da PR própria e da dependência #566; continuar P02 em escopo separado.
Sem FOOD08, mudanças na FOOD06, merge, deploy ou operações externas.

## Resultado final local

- PASS: 22/22 Playwright, 6 novos P01 e 16 regressões QST01, zero skipped.
- PASS: typecheck Node22, ESLint afetado e linguagem.
- PASS: diff/scanner local e links/hash conferidos antes do envio.
- CI e build do novo HEAD: pendentes, não inferir aprovação dos checks da #566.
- Revisões estáticas e de persona favoráveis no escopo, sem execução própria de
  navegador pelos revisores. Nenhuma funcionalidade P02 foi iniciada.
