# FOOD06 — interface de contribuições M02

Branch/PR vigentes: `docs/food06-contratos-fontes`/#455 Draft, base992fee05.
Incremento só Web; API e provas PG/RLS pertencem à base já validada. Sem alterações
backend/schema, portal, permissão, ciência/direitos, merge ou operação externa.

## Implementação

- Ação “Ver alimentos de [nutriente]”, sob demanda, na tabela factual existente.
- Lista da página agrupada por plano/refeição; IDs internos não viram rótulos.
- Cobertura e subtotal da refeição inteira distinguidos dos itens daquela página.
- Quantidade/unidade originais e peso já considerado no cálculo, pt-BR. Nenhuma
  nova multiplicação por quantidade nem conversão de medidas/densidades.
- Paginação25, total integral, anterior/próxima e faixa exibida. Ordem de origem
  explicitada; não simula ordenação global por teor que ainda está pendente.
- Reutilização do parser de cobertura, checagem de publicações/revisão e projeção
  por allowlist. Resposta de outra seleção, página, nutriente, ID duplicado ou
  composição incoerente é recusada, sem erro interno no produto.
- Estado somente em memória, POST/no-store, AbortSignal e chave de contexto;
  invalidação do pai desmonta o detalhe, respostas antigas não o restauram.
-403/404/409 do detalhe propagam até PA06, cancelam geração e removem também os
  cartões legados. Erros não expõem texto do backend, cookies ou URLs internas.

## TDD/revisão

Refatoração compartilhada preservou24 testes; parser novo:2RED/27GREEN.
Coorte inconsistente entre nutrientes:1RED, corrigida. UI:RED funcional de botão
inexistente após página carregada; dois projetos GREEN inicial. Testes de leitura,
paginação, último botão, pt-BR e403 passaram4/4 antes da revisão ampliada.

Revisor independente `/root/food06_m02_ui_r4` encontrou:

1. Agregados contraditórios (seleção0/refeição100) aceitos. RED Node, verificação
   hierárquica adicionada; revisor confirmou rejeição. A verificação não gera
   novos valores nutricionais; a margem cobre apenas representação binária.
2.403 ocultava tabela/detalhe mas preservava card PA06. RED browser:200kcal
   permanecia; callback até ancestral cancela request/geração e limpa resultado.
   Primeira tentativa de browser não iniciou porque o servidor encerrou durante
   interrupção de créditos; setup não contado como RED. Após reiniciar o mesmo
   Node22/webpack, o teste reproduziu a falha funcional sem mudar timeouts.
3. Igualdade da cobertura global precisa incluir contagens e causas, além do
   total/estado. Revisor reproduziu conhecido1/3 versus2/3 com valor0. Correção
   encerrada: igualdade integral, incluindo causas canônicas, RED1/31 e GREEN31/31. Revisor confirmou o fechamento.

UX B/C por papéis independentes, limitada ao relato DOM/testes do coordenador:
[relatório](../docs/agents/ux/reports/FOOD06-M02-BC/consolidado.md). Sem usuário real
ou observação própria das personas. Nenhuma sugestão clínica foi adotada.

## Estado e próximo passo

Regressões FOOD06+PA06 desktop/mobile, coerência, typecheck/lint/build,
autorização Web e revisão delimitada executados conforme resultados abaixo.
CI do novo HEAD ainda pendente; provas não executadas não são PASS. Alteração
automática next-env desta tarefa retirada; arquivo da outra worktree preservado.

M02 permanece parcial: fonte/preparo, ordenação global e navegação autorizada
até a origem ainda faltam. A FOOD06 tem25% estimados pelo método transparente
em [progresso](progresso-food06.md),0/12 melhorias integralmente encerradas.


## Resultado consolidado do incremento local

- PASS31/31 no harness unitário/modelo de seleção, parser factual e detalhe.
- PASS36/36 Playwright FOOD06+PA06 desktop/mobile após correções. Roda também
  quatro cenários do incremento: abrir por teclado,25+1itens/paginação, limite,
  pt-BR, axe e403 limpando pai e filha. Não é AT humana ou paciente real.
- Uma repetição intermediária teve2 falhas no setup da fixture ampliada, que
  buscava2600 sem separador pt-BR. Corrigida a expectativa para2.600 e repetida
  a matriz inteira36/36, sem reduzir assert, mexer em timeout ou produto.
- Fixtures agora usam26 itens coerentemente também no cálculo PA06 da amostra;
  não usam soma26 na tabela e2 na resposta do cálculo para o mesmo cenário.
- Captura final é do elemento de contribuições, não de viewport auto-rolado ao
  final da tabela. Imagens sintéticas e manifesto de execução no relatório UX.
- R4 final delimitada: sem achado pendente após três correções. Revisor executou
  Node31/31; browser/CI/compilação ficam nas evidências do coordenador e workflow.
- Mantidos os limites: sem backend/BFF novo, sem prova de carga produtiva, sem
  direitos novos, sem ativação clínica e sem encerramento de nenhuma melhoria.

Próximo: conferir checks do HEAD enviado, então completar M02 (fonte/preparo,
ordenação global e navegação segura de origem), conforme plano aprovado. M04
vem após fechar dependências necessárias, sem retirar seus requisitos.


## Compilação e encerramento do delta

PASS: lint dos seis arquivos de produto alterados; typecheck Web; build Next
Webpack com194 páginas, Node22.23.4. Sem dependência/configuração de segurança
nova. Servidor dev foi encerrado antes do build; mudanças automáticas locais
next-env foram removidas, sem tocar na alteração preexistente da outra worktree.
PASS: os27 scripts que compõem test:authz terminaram com exit0. Executados
diretamente com Node22 em dois workers, conforme package.json, sem pnpm/toolchain
install; inclui BFF de planos76/76 e o harness factual31/31. Nenhum script skipped.
CI do HEAD novo ainda não é conhecido antes do push; CI992fee05 é só da base.

## Reprodução e limitações locais

Testes e compilação executados com Node22.23.4, selecionado no PATH. Comandos
reproduzíveis a partir da worktree desta PR (scanner local sem dependência de Node22):

```sh
node octaclin-web/scripts/test-calculo-combinado-planos.mjs
node scripts/scan-secrets.mjs
git diff --check
```

No pacote Web: ESLint dos seis arquivos de produto, TypeScript `--noEmit` e
Next `build --webpack`. Browser com servidor Next/Webpack local3100,
`E2E_WEB_URL=http://localhost:3100`, `E2E_REUSE_EXISTING_SERVER=true`, configuração
`octaclin-web/playwright.config.mjs` e specs `food06-tabela-factual` e
`pa06-calculo-combinado`. O fixture é inteiramente sintético; o backend é simulado
nesses testes de UI, que não substituem prova PostgreSQL/RLS.

Ferramentas/dependências reutilizadas de cache local existente por symlink;
nenhum lockfile ou engine foi alterado. A instalação congelada e os scanners do
HEAD exato continuam responsabilidade do CI. Acesso ao Neon/Render não executado.
Rollback do incremento Web é somente de código, sem alteração de dados/schema.

## Continuidade M02 — lacunas delimitadas

Inspeção do serviço confirmou: a fronteira `executarCalculoCombinado` já autoriza
todos os planos antes da decifragem e entrega snapshots congelados ao domínio;
a projeção atual do detalhe não inclui fonte/preparo. O próximo incremento deve
projetar somente os campos necessários da composição publicada, com ausência
explícita quando não registrados, sem resolver o catálogo vivo nem retornar o
snapshot cru/cifra/proveniência clínica. Exige novos testes negativos de projeção
e integração, sem migration presumida.

Ordenação por contribuição deve ocorrer sobre a seleção inteira antes da
paginação, reutilizando aritmética de domínio e desempate estável. Ordenar só a
página visível não atende M02. Novo parâmetro terá validação backend/BFF e vínculo
com a chave de leitura, preservando total/cobertura integrais e reautorização.

Navegação deve identificar publicação/refeição/item originais e revalidar acesso;
não abrir outro rascunho como se fosse a publicação analisada nem inserir descrição
clínica no URL. O contrato de navegação ainda precisa ser conferido no editor.
Esses itens são próximo trabalho autorizado, não funcionalidades já disponíveis.
