# PA07 — T04 para Luna alto (troca manual pendente)

## Contexto e objetivo

Branch `feat/pos320-pa07-planejamento`, worktree
`/workspace/octaclin/.worktrees/pos320-pa07-planejamento`, base `62a50104`.
Usuário autorizou implementação em “Siga”. D01 confirmada: segunda aba em
consulta, botão “Editar nesta aba”, anterior pausa e preserva edição local.
Plano: [PA07](plan-pos-320-pa07.md). [Evidências do núcleo](../docs/governance/EVIDENCIAS_PA07_NUCLEO_2026-10-16.md).

Sol implementou núcleo/adaptadores/hook e integração inicial (59 unitários,
42 BFF, typecheck, lint sem erros e2 E2E PASS). **Ainda não existe interface
de aviso/retomada e não há PR.** Não declarar fase completa neste checkpoint.

## Escopo do Luna — somente T04

Criar aviso pequeno em `components/pacientes/aviso-edicao-abas-plano.tsx`,
integrar JSX no editor e expandir `tests/visual/pa07-coordenacao-abas.spec.mjs`.
Pode ajustar controles visuais de `refeicao-ordenavel.tsx` para desabilitar
arraste enquanto consulta, preservando o botão de expandir/recolher. Sem refactor
geral. Núcleo `coordenacao-abas-plano*.ts`, hook e fila de saves permanecem fora
do escopo T04; se falhar comportamento de concorrência, registrar RED e retornar
ao Sol. Não introduzir dependências, backend, migrations ou storage persistente.

### Contrato disponível no editor

`edicaoEntreAbas` de `useCoordenacaoAbasPlano`:

- `estado`: inicializando/editando/consulta/transferindo/reconferir/indisponivel.
- `podeEditar`: booleano para renderização; false significa bloquear campos
  editoriais. Guardas de callbacks já existem independentemente do disabled.
- `assumir(): Promise<void>`: tentativa explícita de transferência/aquisição,
  pausa origem e lê a versão autorizada. Não passar documento/revisão do cliente.
- `revalidar()`: usado pelo lifecycle; não chamar em loop/timer de UI.

No core, `reconferir` pode também indicar uma leitura em andamento. Clique
repetido é recusado sem duplicar aquisição. UI deve desabilitar seu próprio
botão enquanto aguarda `assumir()`, incluindo try/finally, sem habilitar campos
otimisticamente. Nunca mudar `posseEdicaoRef` ou `contextoEdicao` pela interface.

### Interface e ações

1. Exibir status de consulta em outra aba e botão **Editar nesta aba** fora de
   qualquer fieldset desabilitado. Durante transferência, status de espera;
   erro/consulta final permite tentar novamente, sem afirmar que a aba travou.
2. `editando`: estado normal. `indisponivel`: aviso de que não foi possível
   coordenar abas; evitar edição simultânea. Não prometer trava neste estado.
3. `reconferir`: valores locais permanecem. Reusar
   `setConfirmarReconciliacao(true)`/modal **Recarregar rascunho** para escolha
   explícita **Descartar e recarregar**. Depois, oferecer retomada explícita.
   Descartar não deve salvar nem copiar valores antigos sobre revisão nova.
4. Corrigir status fixo “Salvamento automático ativo” quando não há posse:
   **Salvamento automático pausado nesta aba**. Preservar estado real de save
   e última confirmação; não transformar pausa/erro em “Salvo”.
5. Desabilitar visualmente todos os botões de mutação editorial em consulta:
   salvar, revisar, publicar, criar nova versão, arquivar, adicionar/remover/
   duplicar/reordenar refeições e aplicar modelo/receita/cópia. Não basta fieldset
   dos inputs: vários botões ficam fora. Não bloquear seleção/cálculo combinado,
   ON/OFF do plano/refeição, expansão de refeições, histórico ou navegação com
   guard. Criar outro plano mantém contrato de descarte existente.
6. `role=status` para informação/progresso; `alert` apenas falha que pede ação;
   teclado, foco visível, layout desktop/mobile. Mudança em outra aba não deve
   roubar foco, apagar seleção de texto ou descrever detalhe de implementação.

## TDD e aceite mínimo T04

- Escrever/observar RED antes da UI. Spec existente tem fixture sintética por
  contexto, duas páginas reais e2 casos (desktop/mobile) de consulta.
- Adicionar teste: B assume; A fica sem edição/auto, mantendo texto local; B só
  edita após leitura. B salva mudança; A tenta retomar com texto antigo e precisa
  reconferir, sem sobrescrever. Descarte explícito e nova retomada carregam salvo.
- Cobrir botão por teclado, aviso sem foco roubado, estado de espera e falha;
  Axe no painel. Verificar ON/OFF/seleção continuam independentes em consulta.
- Acrescentar testes visuais não substitui testes de integração completos T05.
  Marcar rede incerta, envio em voo, revogação e todos os writers como pendentes
  se não executados. Fixtures não devem ter dados reais nem dependência de outro
  spec. Não expor instância global/test-only API na aplicação.
- Rodar teste unitário existente, typecheck, lint direcionado e Playwright T04.
  Corrigir e repetir antes do handoff. Sem merge/deploy/ativação externa.

## Ambiente / comandos

```bash
export PATH=/tmp/octaclin-pa03-toolchain/bin:/tmp/octaclin-pa02-toolchain/node-v22.21.1-linux-x64/bin:$PATH
```

Web node_modules é symlink para dependências do worktree PA06 (mesmo lockfile).
Não instalar ou mutar dependências compartilhadas. Next16.3.8; guia instalado
`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
já lido. Para localhost3317, iniciar servidor **desta worktree**, em webpack:

```bash
node node_modules/next/dist/bin/next dev --webpack --hostname localhost --port 3317
E2E_WEB_URL=http://localhost:3317 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/pa07-coordenacao-abas.spec.mjs --reporter=line --timeout=90000
node scripts/test-nutricao-plano.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Executar de `octaclin-web`; encerrar somente servidor criado para esta tarefa.
Espaço livre baixo (~699MiB): não remover artefatos de usuário/outras fases;
reavaliar antes de build/instalação. Não versionar next-env gerado. Checkout
principal tem alteração preexistente do usuário e permanece intocado.

## Retorno ao Sol

Ao concluir T04, registrar arquivos/commits, RED/GREEN, comandos/resultados e
limites. Avisar e pausar para troca manual a Sol6.1 médio. Ele executará T05–T07:
revisão dos callbacks/lifecycle e base editorial, regressões completas,
PostgreSQL/RLS/CAS/CI, revisão cruzada e PR única. CI antigo não aprova PA07.
