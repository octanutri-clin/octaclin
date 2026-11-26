# C2-F05 — erros de cadastro associados aos campos

## Base e risco

Branch `feat/c2-f05-erros-cadastro`, base F04 `e4540845` (#596), PR Draft própria
empilhada, sem merge/cherry-pick implícitos. Plano aprovado por referência explícita
`cb39c2c5:tasks/plan-ciclo2-login-cadastro-formularios-operacao.md`, seção F05.
R4 por PII. Preserva Claude/FOOD06, main e outras worktrees. Nenhuma ação externa
em banco, deploy, Render/Neon, cobrança ou infraestrutura.

## Diagnóstico e decisão técnica

O backend já devolve erros Nest com `message` string/array. O pipe global usa
whitelist/forbidNonWhitelisted/transform. DTOs existentes definem campos, enum,
formatos e limites. A tela não associava esses erros aos controles e podia
refletir texto remoto inesperado pelo helper genérico.

Menor mudança: allowlist **exata** de mensagens existentes, seção e campo editável,
com saída pública fixa em português. Não é novo validador: não examina CPF/email
para decidir validade nem antecipa rejeição do servidor. Backend/BFF/HTTP permanecem
com o contrato legado; este incremento não afirma sanitização do tráfego no BFF.
Uma mudança futura de mensagem não reconhecida falha como alerta geral seguro.

| Superfície | Reutilização / alteração |
| --- | --- |
| Backend | Pipe, DTOs e serviço preservados; somente teste de contrato acrescentado |
| BFF | Wrappers, autorização, headers e corpo HTTP inalterados |
| Domínio de apresentação | erros-cadastro.mjs: catálogo público e regras exatas por seção; sem dado retornado refletido |
| API client | ErroCadastroPaciente guarda somente projeção pública/status; atualizações básicas e seções usam o mesmo projetor |
| Editor | Contexto local, resumo navegável, IDs useId, labels e descrição de erro; preserva estado/ACK/saídas F04 |
| CI | Script unitário existente ampliado aditivamente para testar o projetor; sem workflow, dependência ou lockfile novo |

## Comportamento

- Resumo lista os campos **identificados** na ordem do formulário, sem sugerir
  que mensagens desconhecidas estejam integralmente mapeadas.
- Mensagens próximas dos campos, aria-invalid/describedby e label explícito.
  Foco inicial no resumo da tentativa correspondente; botão leva ao controle
  visível. Editar não rouba foco, não valida automaticamente e remove só seu erro.
- Revisões por campo distinguem A→B→A. Erro de tentativa antiga não marca o campo
  editado; mantém outros erros ainda aplicáveis e não interrompe a edição.
- Campos não editáveis nesta tela (por exemplo documentoPagador/enderecoCobranca)
  e respostas desconhecidas geram alerta geral, nunca link falso ou novo campo.
- HTTP401/403/404/409/429/5xx são classificados por status autoritativo, sem
  atribuir causa privada, duplicidade automática ou prazo inventado. Entrada e
  pendência são preservadas.
- Gravação parcial da identificação mantém ACK dos básicos e aviso verdadeiro.
  Se o primeiro PATCH falhar, o segundo não é enviado.
- Formatos de CPF, telefone, email, CEP e obrigatoriedade permanecem os existentes.
  Não introduz validação de dígito verificador, consulta externa ou fusão de pacientes.
- Limites do projetor: 32768 caracteres de corpo, 64 mensagens e 512 caracteres
  por mensagem. Conteúdo malformado/desconhecido permanece geral. Map e catálogo
  fixo evitam usar propriedades de protótipo como campos/rotas.
- Nenhum rascunho, mensagem privada, credencial ou dado real em storage/log/URL.

## Evidências

Node22.21.1 e somente dados sintéticos. Resultados finais abaixo substituem os
checkpoints intermediários apenas para o mesmo código comprovado.

| Prova | Resultado |
| --- | --- |
| RED navegador | 2 FAIL funcionais: ausência de resumo/vínculos e detalhe remoto exibido no alerta403 |
| RED projetor | 3 FAIL funcionais de campos conhecidos/mistos; casos de fallback já seguros passaram, sem RED artificial |
| GREEN projetor + proteção | 18/18 PASS (14 novos + 4 beforeunload existentes) |
| Contrato backend real do pipe | 7/7 PASS com DTOs/ValidationPipe reais, sem banco/HTTP real; inclui nested, whitelist e regra legada CPF |
| GREEN inicial browser | 4/4 PASS desktop/mobile |
| Rodada ampliada F05 | 24/24 PASS: status, múltiplas seções, atraso A→B→A, parcial, fiscal, teclado/Axe/fonte200% |
| Rodada final integrada | **70/70 PASS** no código e4c8619a após correção de layout:26 execuções F05 +44 regressões F04/portal/LGPD/tarefa/a11y |

## Segurança e limites

R4 independente `/root/c2_f05_r4`, leitura estática, sem execução própria. Favorável
sem achados bloqueantes; pediu prova dinâmica de400 atrasado, adicionada e aprovada
na rodada ampliada do coordenador. Conferiu delta final de contador, regras exatas,
limites, protótipo, campos não editáveis, ACK e backend preservado.

UX `/root/c2_f05_nux` e `/root/c2_f05_pux`: instâncias separadas, fork sem histórico,
papel explícito, sem ferramentas; seleção nativa TOML não comprovada. A sobre
brief; B/C por relatos sanitizados, sem pesquisa com pessoas ou interação própria.
Relatórios/manifesto em `docs/agents/ux/reports/C2-F05-ABC-2026-11-26/`.

Continuam os limites F04: sem CAS entre profissionais, sem transação entre os dois
PATCHs, sem garantia de interceptar Back/Forward SPA ou redirects programáticos.
Leitor de tela manual NOT RUN. Build local SKIPPED por disco limitado; CI/build e
scanners do HEAD enviado obrigatórios. PostgreSQL/RLS local NA: sem alteração de
implementação/autorização/persistência backend, browser interceptado não prova banco.

Rollback de código/projeção visual pelo fluxo de PR; não desfaz dados já salvos.
Sem migrations, merge ou deploy. Regras legadas não editáveis e novas exigências
cadastrais exigem planejamento próprio, sem validação silenciosamente mais estrita.

## Matriz F05

| Critério | Estado local | Encerramento restante |
| --- | --- | --- |
| F05-C1 — mapeamento público | PASS, commit43d09f1a | CI do HEAD final |
| F05-C2 — resumo/foco/inline | PASS local automatizado + UX C favorável por relato | CI/revisão formal e assistivo manual separado |
| F05-C3 — integração | PASS:API client integrado, tipos Web/backend e regressões; backend/BFF produtivos inalterados | CI do HEAD final |
| F05-C4 — regressões/autorização/UX | PASS local:70/70, authz30/30, R4 estática e UX C | CI/build/revisão formal; assistivo manual NOT RUN |

Próxima fase prevista F06 (busca no histórico), que exige auditar base de leitura,
criptografia e limites; não implementada nesta PR. Não integrar implicitamente as
branches do ciclo anterior que ainda não chegaram à main.

## Fechamento local

Commits de código: `43d09f1a` (projetor/testes/contrato/script aditivo) e
`e4c8619a` (API client/editor/testes/layout). Nenhuma mudança funcional posterior
à rodada70/70 ou à última revisão estática R4. A restauração de AGENTS/next-env
ocorreu após encerrar o servidor próprio, somente quando o conteúdo correspondia
exatamente à transformação conhecida do Next. Não integra o diff.

A conferência visual do coordenador encontrou overflow **interno** a200% apesar
do teste da página inteira passar. Novo RED:321px de conteúdo/263px disponíveis.
A primeira correção só nos controles não bastou (FAIL preservado); depois foi
necessário limitar também as colunas mínimas das grades de painel/seção/Qualidade
e permitir quebra de palavras local. GREEN2/2 focados e nova rodada70/70. Não foram
reduzidos asserts, alterados timeouts, dependências, workflows ou segurança. A
captura final confirma campo e erro legíveis no mobile, sem scroll horizontal do
painel; rolagem vertical permanece disponível. Personas receberam relato, não imagem.

PASS finais: typechecks Web/backend com Node22.21.1, ESLint Web afetado sem
avisos/erros, linguagem, autorização de rotas30/30, matriz a11y20/20, confiabilidade
40 referências, tooling agentes12/12 e papéis UX Python5/5. Unitários18/18 e contrato
backend7/7 são do mesmo código. Tipos e revisão estática não são build/CI ou RLS.

Lint backend: **SKIPPED**, não existe script/dependência/configuração ESLint no
pacote. Uma tentativa isolada retornou MODULE_NOT_FOUND (setup), registrada sem
contá-la como RED funcional ou PASS. Não instalou ferramenta para contornar.
Builds e suítes globais locais permanecem SKIPPED; dependem do CI oficial do HEAD.
Leitor de tela manual NOT RUN, sem inferir experiência assistiva pelo Axe.

Varredura de secrets sobre a worktree inteira e diff-check são executados após
esta documentação, antes do commit/push. Resultados serão confirmados no checkpoint
Git; scanner por padrões não representa garantia universal de ausência de segredos.
Hashes dos arquivos avaliados em `hashes.sha256` no relatório UX. Relatórios/traces
binários de teste não foram versionados; fonte e evidências resumidas ficam no Git.

Reprodução do browser com servidor webpack Node22 próprio já iniciado:

```bash
E2E_WEB_URL=http://localhost:3336 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/console-regression.spec.mjs tests/visual/acessibilidade.spec.mjs --grep 'C2-F04|C2-F05|revisa qualidade cadastral|distingue desativar conta|preserva foco e tarefa|lista - estado vazio|cadastra paciente, preserva foco' --output=/tmp/c2-f05-aceite --reporter=list
```

`node` representa Node22.21.1. CI/build/scanners do HEAD enviado seguem pendentes;
não herdar PASS da #596. Manter Draft e a ordem de dependência:integrar F04 por
autorização própria, depois conferir base/retarget/checks da F05 antes de merge.
Este incremento não faz nenhuma dessas operações.
