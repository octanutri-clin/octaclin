# FOOD01 — handoff da interface para Luna alto

## Estado e limites

Worktree `/workspace/octaclin/.worktrees/pos320-food01-planejamento`, branch
`feat/pos320-food01-planejamento`, base `d36b12e7` (PA07/#423 mergeada).
Implementação autorizada pelo proprietário em “Pode seguir”. Backend T02–T05
implementado nesta branch; conferir relatório e Git antes de assumir.
Aguardar a confirmação manual do usuário de troca para Luna alto antes de T06.
Não criar worktree/PR paralela; a entrega FOOD01 terá uma PR única após integração.
Checkout principal tem alteração preexistente em next-env; não tocar.

Leia [plano](plan-pos-320-food01.md), [checklist](todo-pos-320-food01.md),
AGENTS root/Web e docs Next da versão instalada antes de alterar framework.
Referência R017 já examinada; não repetir pesquisa nem copiar código GPL.
Nenhuma dependência nova prevista. Não alterar backend/schema para facilitar UI.
Se surgir incompatibilidade de contrato, registrar evidência e devolver para Sol.

## Produto confirmado — não reabrir

1. Biblioteca pessoal ou da clínica, pessoal por padrão. Medidas da clínica
   podem ser usadas por colegas, mas somente criador edita/desativa.
2. Equivalência explícita em gramas, inclusive líquidos; sem densidade/mL→g.
3. Editar/desativar biblioteca não atualiza itens já inseridos, nem rascunhos.
   Reaplicação é escolha explícita; não afeta publicações existentes.

Biblioteca apenas para alimento existente do catálogo. Não criar FOOD02,
FOOD03 etc. Caminho manual permanece. Seleção no item e nas substituições.
Não mudar portal/PDF: eles recebem os fatos publicados pelos fluxos existentes.

## API backend fechada

Base: `/planos-alimentares/alimentos/:alimentoId/medidas-caseiras`.
Sessão Professional, vínculo ativo, permissões reais no backend.
SuperAdmin/Client/Collaborator não ganham os novos poderes de biblioteca.
Preservar seus caminhos legados de planos.

- GET `?pagina=1&limite=25`: `{itens,total,pagina,limite}`; limite1–100,
  página1–10000. Ordenação criadaEm DESC/id DESC estável. Lista ativas pessoais
  próprias e da clínica. Não misturar páginas/respostas de alimentos diferentes.
- POST: `{chaveIdempotencia:UUID,nome:string,quantidadeReferencia:number,
  pesoReferenciaGramas:number,escopo?:'pessoal'|'clinica'}`.
  Nome trim1–40; números0,001–10000, até3 casas, sem strings/null/NaN.
  Padrão pessoal. Gerar chave por intenção de criação; retry da MESMA intenção
  conserva chave/payload, alterações posteriores usam nova chave. Replay igual
  retorna registro atual sem duplicar; payload diferente com mesma chave409.
- PATCH `/:medidaId`: `{revisaoEsperada:number,nome?,quantidadeReferencia?,
  pesoReferenciaGramas?,ativa?:false}`. Não envia escopo/proprietário/tenant;
  não reativa. Nome/números têm as regras acima. Revisão stale409, não repetir
  automaticamente com revisão nova. Ao desativar, confirmar e retirar da lista
  de opções novas; a seleção já aplicada no plano permanece materializada.
- Cada item de resposta (inclusive POST/PATCH):
  `{id,alimentoComposicaoId,nome,quantidadeReferencia,pesoReferenciaGramas,
  escopo,revisao,ativa,podeEditar}`. Sem UUID proprietário/tenant, cipher,
  chave de criação ou metadados de paciente.
- Status: validação400; papel/permissão/vínculo403; medida não autorizada404;
  conflito de revisão/estado/idempotência409; conteúdo cifrado indisponível503.
  Não exibir mensagem crua desconhecida/stack. Reusar sanitização da interface.

## BFF — implementar com testes antes do código

Rotas Web sob `/api/planos-alimentares/alimentos/[alimentoId]/medidas-caseiras`
coleção GET/POST e `[medidaId]` PATCH; sem pacienteId na biblioteca.
Referência interna: `app/api/planos-alimentares/alimentos/route.ts` e
`app/api/pacientes/[id]/planos-alimentares/_proxy.ts`.
Usar `executarProxyPlanoAlimentar`, `lerCorpoLimitado` e
`montarConsultaPermitida`; sessão/permissão antes de encaminhar escrita,
limite de corpo proposto4KiB. GET apenas pagina/limite, sem repassar query livre.
Params Next assíncronos e UUIDs validados; erros e sucessos private/no-store.
Estender catálogo de autorização e os testes existentes de BFF. Não colocar
sessão/backend URL/token no navegador nem payload clínico em cache/log/URL.

## Contrato editorial e aritmética

`AlimentoEdicao` backend aceita:

```ts
medidaCaseira?: {id: string; revisao: number; aplicacaoId: string} | null;
```

- Na seleção/reaplicação explícita: novo `crypto.randomUUID()` para aplicacaoId,
  mais ID/revisão recebidos da biblioteca. Campos factuais continuam quantidade,
  unidade (nome) e porcaoGramas. Snapshot/reference-base não são enviados como
  autoridade. Manter equivalência em memória para feedback enquanto o usuário
  edita quantidade; contexto já aplicado não acompanha edição da biblioteca.
- No save, o backend resolve nome/peso; primeiro uso exige acesso atual,
  revisão/estado/fonte válidos. Saves seguintes reconhecem a mesma chave do
  item+alimento+nonce e usam contexto cifrado anterior. Alterar quantidade usa
  esse contexto original; reaplicar biblioteca usa nonce novo e regras atuais.
- `null` significa **usar peso manual**, mesmo que peso/unidade não mudem.
  Omissão (`undefined`) serve a clientes antigos: se todos os fatos coincidirem,
  backend preserva seleção anterior. Não usar omissão como botão de desligar.
- Trocar alimento, digitar unidade/peso manual ou converter a item manual
  desvincula a seleção explicitamente. Cópia/duplicação/modelo/receita/versão
  nova transportam fatos; NÃO propagar descriptor/nonce privado ao novo item.
- Reabrir rascunho: a resposta profissional tem `medidasCaseirasAplicadas`,
  mapa por chaveCliente com `{nome,quantidadeReferencia,pesoReferenciaGramas}`.
  Essa base vem do snapshot cifrado do rascunho, sem consultar biblioteca atual.
  Usar para restaurar equivalência em memória junto ao descriptor do documento.
  Não enviar esse mapa no save; ele não é campo aceito do DTO. Não recebê-lo em
  publicação/portal/PDF. Resposta sem mapa e descriptor sem base: conservar fatos,
  não inferir equivalência pela biblioteca atual; mostrar limitação e oferecer
  reaplicação explícita ou peso manual. Não inventar base pelo peso arredondado.
- Atualizar tipos Web e TODOS os normalizadores/allowlists:
  `lib/edicao-plano.ts`, `lib/plano-alimentar-api.ts`, helpers/formulário/editor,
  `formularioDoDocumento`, `documentoDoFormulario` e conversão de alimento.
  Descartar contexto novo ao sair/trocar paciente/plano/aba; sem persistência local.
- Preview fiel: q × pesoReferencia ÷ quantidadeReferencia; entradas com até3
  casas representadas em inteiros milésimos, BigInt no produto/razão,
  único arredondamento half-up para3 casas no peso. Verificar limite do resultado
  exato0,001–10000 antes de arredondar. Não arredondar fator intermediário.
  Casos:2,5×25/1=62,5;3×25/2=37,5;1×1/3=0,333;1×1,001/2=0,501;
  0,001×0,999/1 é abaixo do mínimo, não pode virar0,001 artificialmente.
  Comparar com `dominio/medidas-caseiras.spec.ts` do backend.
- Quantidade vazia/inválida: manter texto e intenção no autosave, sem inventar
  peso/zero; backend conserva edição pendente e impede revisão/publicação.
  Nunca substituir todo o formulário pelo ACK; preserva digitação/IME/ordem/foco.

## UI, testes e aceites T06

Componente separado de biblioteca/seletor para não aumentar indiscriminadamente
`plano-alimentar-profissional.tsx`. Rotular nome/equivalência/escopo, padrão
pessoal, status/vazio/erro/carregando e lista paginada. Reusar modal/componentes
existentes; teclado, foco restaurado, labels explícitos e confirmação de desativar.
Só mostrar editar/desativar com podeEditar. Edição da biblioteca não reaplica
seleção no plano; oferecer reaplicação explícita se desejada.

Toda aplicação/alteração do item respeita posse PA07, callbacks da geração
corrente e trava de cópia. Respostas tardias de busca/CRUD não alteram outro
alimento, item, plano ou paciente. Salvar biblioteca não significa salvar plano.
Remoção/desativação da biblioteca não limpa o item selecionado silenciosamente.

Testes RED/GREEN dos helpers e BFF; Playwright desktop/mobile sintético cobrindo
criar/usar/editar/desativar, escopo, conflitos, paginação, quantidade parcial,
manualnull, recarga, troca rápida de contexto, cópia e segunda aba consulta.
Axe/teclado, regressões PA02–PA07, portal/PDF sem novos campos. Após T06,
produzir handoff para Sol6.1 médio integrar/revisar/T07–T08. Não declarar
revisão própria independente. CI final e PR única somente após integração.

## Operação e ferramentas

Node22.21.1 conferido por SHA256 oficial nesta rodada, executável
`/workspace/.toolchains/food01/node-v22.21.1-linux-x64/bin/node`.
Backend node_modules é symlink de dependências com lockfile idêntico da PA06.
Preparar Web com lockfile verificado, sem nova instalação desnecessária.
Espaço local limitado (~500MiB fora de container); não limpar trabalho alheio.
Migration1075 só ensaiada em descartável. Antes de deploy futuro: identificar
alvo/role, aplicar com owner fora de banda mediante autorização e verificar
registro/coluna/FORCE RLS/grants DML da role runtime. Nenhuma evidência externa
foi obtida. Não executar down destrutivo, migration externa, merge/deploy.
