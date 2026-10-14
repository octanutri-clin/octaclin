# PA03 — macros no cabeçalho de refeições recolhidas

Planejamento autorizado em 2026-10-14. Implementação ainda não autorizada.
Base auditada: main `5b47fb128e27dff0d72d9f5f0929c0ec0218a671`, merge #416.
Branch: `docs/pos320-pa03-planejamento`. Checkout isolado:
`/workspace/octaclin/.worktrees/pos320-pa03-planejamento`.
A worktree PA02 e seus commits foram preservados.

## Dependências e referências consultadas

- FND02/#411, PA01/#414 e PA02/#415+#416 presentes no código da main.
- GitHub confirmou #416 mergeada e os cinco workflows do seu HEAD `38c3596`
  SUCCESS; CI `38583138559`, inclusive Backend, Web, Governança, Demo e PR Gate,
  SUCCESS. Isso comprova integração/CI, não publicação ou operação produtiva.
- Consultadas somente as entradas PA03 do roadmap, catálogo/mapa inverso,
  matriz da sugestão 46 e JSON `entries[].prs`. Nenhum candidato externo PA03
  consta do JSON; catálogo e matriz recomendam primitives/código atual.
- Decisão: REUTILIZAR o domínio nutricional e componentes do OctaClin.
  Não instalar biblioteca de accordion, decimal, UI ou cálculo. dnd-kit já
  pertence à PA01; preservar sua integração. Nenhum repositório externo foi
  clonado ou auditado por analogia com outro ID.
- Fontes: `docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md` (PA03),
  `01_Catalogo_GitHub_OctaClin` (mapa PA03), `02_Matriz_71_Sugestoes_OctaClin.md`
  (46), `03_Catalogo_GitHub_OctaClin.json` (mapeamento por ID).

## Decisões de produto confirmadas

| ID | Decisão do proprietário nesta sessão |
| --- | --- |
| D01 | Somente o editor do profissional no console. Portal, impressão/PDF e visualização publicada permanecem nos fluxos existentes. |
| D02 | Todas as refeições recolhidas na carga inicial. Controles individuais e expandir/recolher todas, sem persistir preferência entre acessos. |
| D03 | Indicadores parciais: `—` no afetado e “Dados incompletos”; conservar os demais calculáveis. Refeição sem alimentos: “Sem alimentos”. |

Escolhas de engenharia para executar D01–D03: manter o subtotal no cabeçalho
também ao expandir; abrir a nova refeição após adicionar/duplicar/colar para
revisão, ou o destino após acrescentar itens. Essas ações explícitas não mudam
o padrão da carga inicial. Ao recarregar o formulário pelo fluxo existente,
inclusive após save, voltar ao padrão recolhido, sem inferir identidade por
nome ou posição. Nenhuma decisão clínica nova ou protocolo está envolvido.

## Gaps e reutilização

| Gap | Evidência na main | Ação limitada à PA03 |
| --- | --- | --- |
| G01: refeições não recolhem | `refeicao-ordenavel.tsx` sempre renderiza children; h4 mostra apenas “Refeição N” | Botão independente de expansão, nome visível no cabeçalho, corpo mantido montado e hidden. Não colocar ações/drag dentro do botão de expansão. |
| G02: falta subtotal por refeição | `refeicoesPrevistas` alimenta painel global; existem porções e totais globais em `nutricao-plano.ts` | Novo cálculo estrito de subtotal no mesmo módulo, compartilhando arredondamento existente. |
| G03: ausência vira zero na prévia atual | `numero()` e `nutrientesDaPorcao()` tratam undefined/NaN/negativos como zero; testes atuais documentam isso | Preservar comportamento legado do painel global; o novo subtotal valida os dados antes e mantém indicador ausente, sem somar só o subconjunto disponível. |
| G04: conversão pode ocultar ausência | `alimentoDoModelo()` espalha `nutrientesVazios` antes dos dados de entrada; modelos/biblioteca usam esse caminho | Preservar ausência real na projeção local usada pelo subtotal. Testar modelo/catálogo com densidades ausentes; não chamar catálogo em N+1 para completar. |
| G05: required oculto pode bloquear save sem foco | Editor mantém campos required e form depende de validação nativa antes de onSubmit | Capturar invalid de controles recolhidos, revelar a refeição e focar o primeiro inválido após o DOM atualizado, com erro acessível. |
| G06: estado e identidade | PA01 ordena por chaveCliente; PA02 duplica/cola e #416 trava colagem/save | Visibilidade em memória por chaveCliente, reset na aplicação de nova carga; preserve trava, dirty, payloads e chaves novas. |
| G07: regressões assumem campos visíveis | Specs PA02, Fase269, modelos e console usam fill/getByRole em campos atualmente abertos | Expandir explicitamente nos testes de edição; novos casos devem provar o padrão recolhido. Não relaxar nem excluir asserções de autorização, ordem ou payload. |

Código adicional auditado: `painel-nutricional.tsx`, converters e form do editor,
`copia-refeicoes-plano.ts`, DTOs/API de planos, serviço e os domínios backend
`calculo-nutricional.ts` / `plano-alimentar.ts`, specs nutricionais e de cópia.
ADRs 002/004/006 e políticas de dados/código externo preservados.

## Contrato de cálculo

1. Somar apenas alimentos principais. Substituições, mesmo preferidas/liberadas,
   são alternativas e não entram no subtotal nem no total basal do plano.
2. A massa é `porcaoGramas`. Quantidade/unidade são medida caseira; não multiplicar
   quantidade novamente. Usar energia informada pela fonte, não derivar kcal de
   `4P + 4C + 9G`, nem aplicar percentual das metas a cada refeição.
3. Para cada contribuição válida, usar exatamente
   `round((densidade * gramas / 100 + 1e-10) * 10000) / 10000`; somar essas
   porções e arredondar a soma a quatro casas com o mesmo epsilon. Reutilizar
   `arredondar4` no módulo existente. Formatar somente na apresentação.
4. Zero numérico é válido. undefined, null, NaN, Infinity, valores negativos,
   strings numéricas ou overflow não são zero. Porção deve ser finita,
   maior que zero e no máximo 10.000 g, conforme domínio backend.
5. Uma porção inválida afeta todos os indicadores. Uma densidade ausente/inválida
   afeta somente seu indicador, que fica indisponível para toda a refeição;
   não apresentar soma parcial desse indicador como total. Fibra/sódio ausentes
   não bloqueiam energia/P/C/G, pois não são exibidos nesta entrega.
6. `itens=[]` ou somente placeholders sem identificação de alimento significam
   “Sem alimentos”, com indicadores indisponíveis. Um placeholder misturado
   com alimentos reais significa dados incompletos, sem fingir refeição completa.
7. O resultado do helper deve declarar estado completo/incompleto/sem alimentos
   e valores opcionais de energia/P/C/G. Aceitar ausências no tipo de entrada e
   validá-las em runtime; os tipos API de dados salvos não comprovam completude.
8. G04 exige verificar o dado antes de qualquer fallback. Se o tipo interno do
   formulário precisar aceitar Partial de densidades, ajustar apenas view types
   e adapters necessários, preservando validação estreita antes de converter
   para DTOs completos. O helper PA02 continua recusando snapshots incompletos.
   Não criar metadados persistidos paralelos nem alterar APIs públicas.
9. Apresentação pt-BR existente: kcal sem casas; P/C/G em gramas com uma casa.
   Exemplo: `250 kcal · P 17,0 g · C 32,5 g · G 12,5 g`. Ausência é `—`,
   nunca NaN/Infinity/0 fabricado. Dar nomes acessíveis completos às abreviações.
10. São prévias do formulário, inclusive de alterações não salvas. O backend
    continua autoridade no save. Após resposta salva, conferir subtotal com
    os nutrientesPorcao dos snapshots retornados e total global, sem criar
    coluna ou subtotal persistido. Fonte de catálogo pode mudar no recálculo:
    atualizar a prévia com a resposta, sem prometer igualdade com dados antigos.

Fixture aritmética independente (energia não coincide com 4/4/9 de propósito):

| Item | Dados por 100 g: kcal/P/C/G | Porção | Resultado kcal/P/C/G |
| --- | --- | --- | --- |
| A sintético | 100 / 10 / 20 / 5 | 150 g | 150 / 15 / 30 / 7,5 |
| B sintético | 200 / 4 / 5 / 10 | 50 g | 100 / 2 / 2,5 / 5 |
| Subtotal | — | — | 250 / 17 / 32,5 / 12,5 |

Com P ausente em B: energia 250, P indisponível, C 32,5 e G 12,5.
Testar também as bordas de arredondamento já existentes nos specs backend/Web;
igualdade antes de formatar tem precisão de 0,0001, não tolerância visual frouxa.

## Contrato de interação, validação e foco

- Refator mínimo: `RefeicaoOrdenavel` recebe aberto/aoAlternar e subtotal de
  apresentação. Estado controlado no editor, Set de chaveCliente; toggles não
  chamam atualizar(), não marcam dirty nem geram PUT/auditoria.
- Carga aplicada ao editor reseta expansão. Ordenar não muda a expansão da
  identidade; remover elimina sua chave; duplicar cria outra e abre só a cópia.
  Colar abre o destino apenas depois de aplicação bem sucedida. Falha PA02 não
  muda conteúdo, visibilidade nem a seleção da origem.
- Toggle type=button com aria-expanded/aria-controls e foco visível. Corpo com
  id estável e hidden quando recolhido, conservando estado dos editores montados.
  Ações de ordenação, cópia, remoção e alça permanecem disponíveis e independentes.
- Não desabilitar campos ocultos para escapar de required, nem excluir refeições
  recolhidas de montarEntrada(). Não salvar automaticamente ao expandir/recolher.
- invalid nativo pode ocorrer antes de salvar()/validarFormulario(). No capture,
  cancelar foco automático somente para controle oculto; revelar refeições
  afetadas, mostrar erro acessível e focar o primeiro inválido após commit de DOM.
  Agrupar múltiplos invalid para não disputar foco. Não executar reportValidity
  recursivamente dentro desse handler. Controles já visíveis mantêm validação
  existente, e o callback não contorna a guarda síncrona de cópia da #416.
- Se erro de validarFormulario exigir corrigir nome/alimento/porção, abrir a
  refeição correspondente e fornecer acesso ao primeiro campo corrigível.
- Sem aria-live por tecla nos subtotais. Não depender só de cor/tooltips.
  Layout com wrap/min-w-0, alvos de 44 px, nomes longos acessíveis, sem overflow.
  Expandir/recolher todas mantém foco no controle global; esconder corpo não
  deixa foco retido em elemento invisível.

## Execução e arquivos

| Tarefa | Depende | Entrega / arquivo principal | Checkpoint |
| --- | --- | --- | --- |
| T00 | autorização de planejamento | Este plano, checklist, D01–D03 e reconciliação #416 | Base/referências/escopo confirmados; runtime intacto |
| T01 | autorização de implementação, T00 | `lib/nutricao-plano.ts`, `scripts/nutricao-plano.spec.ts`; adapters internos mínimos para G04 | RED/GREEN: completude, zeros, alternativas, porções, arredondamento e source sem densidades; testes legados intactos |
| T02 | T01 | `refeicao-ordenavel.tsx`, editor; estado/toggle e cabeçalho | Todas recolhidas inicialmente; dados retidos e dirty intacto; subtotal reage ao formulário |
| T03 | T02 | Editor: invalid capture, erros e foco | Salvar com required recolhido revela/foca campo e não envia PUT inválido; sem erro not focusable |
| T04 | T03 | Nova spec `tests/visual/pa03-subtotal-refeicao.spec.mjs`; regressões existentes | Desktop/mobile, axe, DnD, PA02/269, modelos/receitas, save/rehidratação e contexto |
| T05 | T04 | Gates locais/CI e revisão cruzada R4 quando viável | Resultados específicos, sem inferir PG ou independência; HEAD correto aprovado |
| T06 | T05 | Uma PR PA03 reunindo plano e implementação, estado e rollback | Handoff final; nenhuma migration/merge/deploy/ativação pelo agente |

Usar o runner nutricional existente, já incluído em test:authz do CI. Não criar
outro framework de testes. Novo componente pequeno de apresentação só se isso
reduzir acoplamento; não extrair todo o editor nem refatorar BFF/backend.

## Segurança, regressão e gates

Risco futuro mínimo R4 por apresentação de dados clínicos. Autorizações,
tenant/carteira, FORCE RLS, criptografia, snapshots e BFF/no-store permanecem
na fronteira existente. Não há chamada externa, novo dado em URL/log/analytics,
Cache Storage ou persistência de preferência. Estados de expansão são efêmeros.

Testar: zeros reais; ausências por indicador; porções inválidas/limites;
arredondamento por item antes da soma; energia independente dos macros;
opcionais ausentes; fonte/catálogo sem densidade; readonly; valores não salvos;
50 refeições; edição de quantidades/substituições; nome/ordem; expansão sem dirty;
required recolhido e requestSubmit; foco/axe/desktop/mobile; cópia pendente e
save bloqueado; destino removido; navegação de paciente/plano e reset de estado;
payload com todas as refeições; snapshots novos retornados após save.

Comandos de implementação (não executados nesta análise documental):

```sh
pnpm --dir octaclin-web test:nutricao-plano
pnpm --dir octaclin-web test:copia-refeicoes
pnpm --dir octaclin-web test:planos-alimentares:bff
pnpm --dir octaclin-web test:proteger-alteracoes-nao-salvas
pnpm --dir octaclin-web exec playwright test tests/visual/pa03-subtotal-refeicao.spec.mjs tests/visual/pa02-copia-refeicoes.spec.mjs tests/visual/fase-269-duplicar-plano.spec.mjs tests/visual/console-regression.spec.mjs --grep 'PA03|PA02|Fase 269|reordena refeições pela alça|edita o modelo em cópia isolada' --reporter=list
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm --dir octaclin-backend test -- --runInBand src/modulos/planos-alimentares/dominio/calculo-nutricional.spec.ts src/modulos/planos-alimentares/dominio/plano-alimentar.spec.ts
pnpm security:secrets
git diff --check
```

Node 22 / pnpm 11.25.0 conforme manifests. Um processo Playwright, workers=1,
ambos os perfis. Compiladores/typecheck/BFF/build devem rodar sem Next dev
regenerando `.next` simultaneamente: a PA02 demonstrou falha em tipos gerados
nesse cenário. Ao corrigir falha real, repetir testes afetados; nunca retirar
testes de drag/foco/validação para obter green. CI do HEAD e revisão cruzada
devem declarar autoria, escopo e limitações. PG real específico: NA enquanto
nenhum contrato backend/schema mudar; não declarar prova de banco pelo browser.

Rollback: reverter apresentação/toggles/helper/adapters PA03; versões e dados
persistidos permanecem no schema existente. Sem migration prevista.

## Modelos e continuidade

- Planejamento/gaps/contratos: GPT-6.1 Sol médio.
- Implementação deste handoff: GPT-6 Luna alto, com checkpoints T01–T04.
- Revisão final de cálculo, foco/validação e regressões R4: GPT-6.1 Sol médio;
  revisão cruzada por outro agente quando viável, com independência declarada.
- Avisar e pausar antes de cada troca manual. Não iniciar implementação por
  inferência desta autorização de planejamento. Não reabrir D01–D03.
- PASS nesta etapa: base/merge/CI anterior conferidos, referências PA03,
  leitura dos contratos e decisões de produto. Testes runtime PA03, revisão R4
  da implementação, CI PA03 e operação externa: SKIPPED/não iniciados.
