# PA05 — preferências de exibição das refeições

Planejamento autorizado e D01–D03 confirmadas em 2026-10-14. Base `main`
`64f54b88` (PR #418), conteúdo idêntico ao HEAD aprovado `37d7979`.
Branch `feat/pos320-pa05-preferencias`; worktree isolada. Implementação
autorizada pelo proprietário em 2026-10-14; o usuário confirmou Luna alto para
T07/T08. Backend/contratos e interface implementados; retorno ao Sol confirmado,
revisão R4 estática concluída após quatro correções. Gates finais em execução.
Origem: item 18, Onda 1 do [roadmap](../docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md).
Checklist: [T00–T09](todo-pos-320-pa05.md).

## Decisões de produto

| ID | Decisão confirmada | Consequência |
| --- | --- | --- |
| D01 | Profissional + portal + impressão/PDF | Dois conjuntos de preferências: profissional e paciente. A entrega/PDF para paciente usa o conjunto paciente. |
| D02 | Uma configuração por versão para todas as refeições | Rascunho mutável; publicação congela preferências. Alteração da entrega exige nova versão e publicação. |
| D03 | Substituições recolhidas com botão para ver as liberadas | Recolhimento não muda liberação, preferência clínica nem escolha registrada. |

Decisões PA03/PA04 preservadas: refeições recolhidas inicialmente no editor;
resumos da lista por versão salva não passam a depender destas preferências.
Não adicionar autosave (PA06), sincronização entre abas (PA07) ou edição de modelos.

## Contrato de apresentação proposto

Objeto versionado `preferenciasApresentacao` com `schemaVersao: 1`, conjuntos
`profissional` e `paciente`, e flags booleanas `horario`, `macros`,
`medidasCaseiras`, `orientacoes`, `substituicoesExpandidas` e `modoCompacto`.
Payload explícito exige os dois conjuntos completos; validar formato/booleans
sem coerção de strings e rejeitar versão desconhecida. Projeção paciente contém
somente o conjunto paciente, nunca configurações internas, cipher ou revisão CAS.

- Defaults para configuração explícita: exibir campos existentes, substituições
  conforme limites por item e modo compacto desligado. Sem snapshot (legado),
  conservar exatamente a apresentação anterior de cada superfície.
- `macros` controla blocos existentes de energia/P/C/G; manter rótulos que
  distinguem metas, subtotal previsto e resumo salvo. Não introduzir nesta PR
  novos indicadores ou cálculo nutricional no portal.
- `medidasCaseiras=false` oculta quantidade/unidade de apresentação caseira,
  mantendo obrigatoriamente a porção em gramas, nome e identidade do alimento.
  Quantidades não são apagadas, recalculadas ou substituídas por zero.
- `orientacoes` controla orientações das refeições e texto geral apresentado
  na entrega, sem esconder alertas de erro, segurança, condição especial,
  justificativas obrigatórias ou validação no formulário profissional.
- No editor, preferências mudam a apresentação/preview; os controles para
  conferir/editar os campos continuam acessíveis. Inputs desmontados não podem
  perder valores. Toda mudança passa pelo dirty guard FND02 e save explícito.
- `modoCompacto` reduz espaçamento, mantendo foco, labels, legibilidade e alvos
  de toque. Não é a preferência de expandir/recolher refeições da PA03.
- `substituicoesExpandidas=false` mantém principal e escolha atual identificados,
  mostra botão “Ver substituições” quando houver liberadas e expande em memória.
  Quando true, respeita `substituicoesVisiveisInicialmente` por item e o “Ver mais”
  legado. Não usar zero no campo legado (ele valida 1–20).
- No PDF não existe expansão interativa: imprimir todas as alternativas
  liberadas, mesmo recolhidas na tela. Jamais imprimir alternativas não liberadas
  na saída identificada como entrega ao paciente. Resetar expansão na troca de
  versão/item/paciente; resposta tardia não pode recuperar apresentação anterior.
- Cópia de refeições PA02 leva alimentos/substituições já previstos pelo
  contrato, mas preserva preferências da versão de destino. Nova versão do mesmo
  plano herda a apresentação publicada. Aplicação de modelos não a substitui.

Ausência legítima de snapshot é legado; cipher/JSON inválido não é legado.
Falha de leitura deve indicar apresentação indisponível, impedir publicação ou
PDF paciente incoerente e permitir reconferência autorizada sem expor dados.
Não ativar defaults silenciosamente após corrupção.

## Auditoria da main e gaps

| Gap | Evidência atual | Correção planejada |
| --- | --- | --- |
| G01 — Persistência | `PlanoAlimentarVersaoOrm` tem snapshots cifrados de cálculo/totais, sem apresentação | Coluna nullable cifrada própria, sem misturar UI com cálculo; migration aditiva nova |
| G02 — Concorrência | `atualizarRascunho` trava plano/versão, mas DTO não contém revisão de apresentação | Revisão inteira monotônica por rascunho para CAS de preferências, conferida sob lock |
| G03 — Ciclo da versão | Save invalida revisão; nova versão copia buffers; hash clínico não inclui apresentação | Copiar snapshot, incluir apresentação explícita no novo hash, invalidar revisão na mudança |
| G04 — Formulário | `formularioDaVersao`/payload/save e dirty guard controlados manualmente | Preservar os dois conjuntos na reidratação, validação, erro/save e troca de paciente |
| G05 — Portal | `ServicoPortalPaciente` monta allowlist e filtra alternativas liberadas | Reusar projeção mínima, transportar somente preferências paciente e preservar escolhas |
| G06 — Impressão | `ResumoVersao` imprime árvore profissional completa | Saída paciente via projeção backend comum ao portal; apresentação interna identificada |
| G07 — Recolhimento | `TrocasLiberadasItem` aceita limite 1–20; impressão usa o mesmo DOM | Novo estado visual separado do limite; PDF sempre inclui liberadas e exclui ações |
| G08 — Histórico | Detalhe salva por versão, lista PA04 usa snapshots de totais | Histórico usa suas preferências; listagem PA04 continua leve e independente |
| G09 — Provas | Testes de planos, portal e visual existem; não há casos PA05 | TDD de persistência, authz/RLS, corrupção, CAS e impressão desktop/mobile |

### Arquivos e fronteiras reais

Backend:
- `src/modulos/planos-alimentares/dominio/plano-alimentar.ts` e novo helper
  de apresentação puro com normalização/projeção e testes próprios.
- `aplicacao/dtos.ts`, `aplicacao/servico-planos-alimentares.ts`, controlador
  e respectivos testes: save/read, nova versão, revisão/publicação e prévia.
- `infraestrutura/plano-alimentar-versao.orm.ts` e migration nova registrada em
  `src/infraestrutura/banco-dados/opcoes-typeorm.ts`. Na base atual, último
  registro é `1720000001071`; reconferir numeração antes de criar a próxima.
- `src/modulos/pacientes/aplicacao/servico-portal-paciente.ts` e testes:
  projeção publicado atual e escolhas; reusar helper de domínio, sem dependência
  circular entre serviços de aplicação.

Web:
- `lib/plano-alimentar-api.ts`, `lib/portal-api.ts` e helper de apresentação.
- `components/pacientes/plano-alimentar-profissional.tsx`: extrair painel de
  preferências/preview em componente pequeno, preservando estado do editor.
- `components/portal/plano-alimentar-paciente.tsx` e `trocas-liberadas-item.tsx`.
- `app/api/pacientes/[id]/planos-alimentares/[planoId]/rascunho/route.ts`
  usa PUT (não PATCH); `_proxy.ts` reaproveitado. Portal passa pelo BFF existente
  `app/api/portal/paciente/route.ts`, que é proxy; backend é fronteira de projeção.
- Nova rota de preview paciente apenas se necessária para impressão console;
  wrapper existente, sessão/permissão, parâmetros allowlisted e `private,no-store`.
- `tests/visual/acessibilidade.spec.mjs`, scripts BFF/nutrição/cópia existentes.

## Persistência e concorrência

Proposta técnica: `apresentacao_snapshot_criptografado bytea NULL` e
`apresentacao_revisao integer NOT NULL DEFAULT 0 CHECK >= 0` na tabela existente.
Nenhuma tabela paralela, novo tenant/RLS ou preferência clínica em localStorage.
A revisão é metadado interno; os dois conjuntos ficam juntos cifrados.

PUT legado sem o objeto preserva preferências já salvas. PUT com o objeto exige
`apresentacaoRevisaoEsperada` inteira e identidade da versão de rascunho
(`rascunhoIdEsperado`); conferir ambas sob lock antes de qualquer escrita.
Incrementar revisão após cada gravação explícita de apresentação; replay velho
retorna 409 e preserva o estado local para reconciliação. Rascunho novo tem ID
novo; revisão zero é reservada à ausência legada. Se herdar snapshot explícito,
inicia revisão 1. Isso distingue perda de snapshot de ausência legítima; o ID
novo impede replay da versão anterior mesmo quando as revisões coincidem. O requisito novo é
condicional ao objeto novo, preservando clientes antigos sem autorização extra.

Gravar apresentação, filhos e cálculo na mesma transação já existente. Nenhum
commit parcial em conflito/validação. Novo rascunho herda snapshot; publicação
não modifica versão já publicada; apresentação explícita entra no hash revisado
para representar a entrega conferida. Hash/snapshots legados não são recalculados.
Não alterar matemática, RLS, papéis, carteira ou editor completo por preferência.

O save completo exige avaliação/cálculo válido. Preparar preferências antes disso
permanece estado local não salvo, com dirty guard; não criar segundo save de
rascunho nem sugerir que já persistiu. Após revisão/publicação, nova edição exige
revisão novamente, conforme o fluxo atual.

## Segurança e impressão — R4

Revalidar tenant, paciente, plano, versão, carteira e permissões em cada leitura
ou escrita. Travas usam ordem canônica existente, inclusive transferência do
paciente. Configuração de exibição não concede papel, consentimento ou acesso.

Extrair projeção paciente estrita a partir das regras existentes do portal,
com dados mínimos e somente alternativas liberadas. A prévia para impressão do
console usa essa projeção autoritativa; nunca confiar somente em tipos TS ou
CSS para eliminar alternativas privadas. Draft preview é explicitamente
rascunho, sem publicação no portal. Portal continua usando só publicado atual.
Impressão interna e entrega paciente devem ser identificadas sem confusão.

Não registrar conteúdo, cipher, hashes clínicos ou configurações contextualizadas
em logs/telemetria/auditoria. Não persistir contexto clínico no browser. Estado
pendente deve ser abortado/descartado na troca de paciente, perda de acesso ou
versão. Leitores legados e recursos de compartilhamento não ganham permissões.

Migration somente em PostgreSQL descartável durante desenvolvimento. Preservar
1070/1071 e anteriores. Rollback recomendado: reverter código e manter colunas
aditivas/histórico; down não deve apagar snapshots clínicos de produção. Plano
externo de implantação precisa identificar ambiente/banco/branch/role e requer
autorização operacional própria. Merge não comprova migration ou deploy.

## Referências específicas consultadas

Catálogo, mapa inverso, matriz item 18 e JSON apontam somente R014/R041.
Nenhum outro repositório foi consultado. Inspeção pública em 2026-10-14, sem
executar código externo, sem instalação, sem dataset ou dado de paciente.

| Referência | Revisão e licença verificadas | Uso / decisão |
| --- | --- | --- |
| [R014 — React Hook Form](https://github.com/react-hook-form/react-hook-form) | v7.90.0, commit `8ac7cc0bcc1f50f887230d50b1929d977b4d3fb4`, MIT; release 2026-10-10, não arquivado | Contratos de defaultValues/reset/shouldUnregister ajudam a evitar perda de campos ocultos. Não migrar o editor; primitives/estado atuais bastam para seis flags por conjunto |
| [R041 — Storybook](https://github.com/storybookjs/storybook) | v10.6.2, commit `5f00d7d0a78e069aa304bdb886da923e012ef2e0`, MIT; release 2026-10-12, não arquivado | Args/estados explícitos orientam matriz sintética de UI. Playwright atual cobre a PA05; infraestrutura Storybook fica para ENG15 |

Evidência fixada:
- [R014 LICENSE](https://github.com/react-hook-form/react-hook-form/blob/8ac7cc0bcc1f50f887230d50b1929d977b4d3fb4/LICENSE),
  SHA256 `e8eeb472f0a5889c2c51625b86a3f9b8630680adb9f49a125352e2e426392780`.
- [R014 types/form.ts](https://github.com/react-hook-form/react-hook-form/blob/8ac7cc0bcc1f50f887230d50b1929d977b4d3fb4/src/types/form.ts),
  SHA256 `252bd6733b5ee4bfb3153010639753b8f22327dd64ec389667a9f3b04d6f9945`.
- [R041 LICENSE](https://github.com/storybookjs/storybook/blob/5f00d7d0a78e069aa304bdb886da923e012ef2e0/LICENSE),
  SHA256 `bc90586179d44dcb313a9a289d687a2f26226303b2066bd21dbefd2378e894e5`.
- [R041 args.mdx](https://github.com/storybookjs/storybook/blob/5f00d7d0a78e069aa304bdb886da923e012ef2e0/docs/writing-stories/args.mdx),
  SHA256 `973ef0fde7e321333098b83e776640cb6a9a41533feb5c0da819384bc24347b7`.

Os pacotes não aparecem no package.json/lockfile Web atuais. Licença MIT não
é aprovação de segurança de uma dependência: nenhuma instalação proposta,
nenhum scan de pacote instalado alegado. Caso TDD demonstre necessidade real,
registrar alternativa, compatibilidade, versão e gates antes de adotar.

## Gates, execução e modelos

T00 e T01–T08 implementados, com evidências no checklist.
Prova PG específica executada com fixture descartável; gate integral de
Timescale/pgvector continua pendente no CI. Revisão R4 estática independente PASS
após correções; T09 e rollout ainda não concluídos. CI da PA04 não prova PA05.
Uma PR de entrega futura reúne estes documentos e a implementação.

GPT-6.1 Sol médio: persistência, CAS, hash, projeção e integração R4.
GPT-6 Luna alto: componente isolado de preferências e estados visuais após
contratos backend fechados. Sol médio encerra integração/segurança/PR.
Não recomendar Luna sozinho para migration e projeção clínica desta fase.
Antes de qualquer troca, avisar modelo alvo e pausar para mudança manual.
Pesquisa restrita a R014/R041 e testes focados primeiro reduzem custo de tokens.

Próxima ação: finalizar os gates locais/CI e preparar T09 com GPT-6.1 Sol médio.
Não reabrir D01–D03 nem instalar
bibliotecas.

## Registro da implementação de interface — Luna alto

Worktree `/workspace/octaclin/.worktrees/pos320-pa05-planejamento`, branch
`feat/pos320-pa05-preferencias`. Conferir status/log antes de escrever. Backend
final validado conforme [evidências](../docs/governance/EVIDENCIAS_PA05_BACKEND_2026-10-14.md).
Planejamento inicial: commit `49faa367`; consultar log para checkpoint técnico.
A alteração next-env.d.ts no checkout principal permanece intocada.

### Contrato entregue

- Detalhe de versão/GET rascunho: `apresentacaoEstado` (`legado`, `configurada`,
  `indisponivel`), `apresentacaoRevisao` e, se válida, `preferenciasApresentacao`
  com `schemaVersao:1`, `profissional`/`paciente` e as seis flags.
- PUT rascunho: incluir objeto completo + `rascunhoIdEsperado` (draft.id atual)
  + `apresentacaoRevisaoEsperada` recebida. Atualizar ambos do retorno após save;
  nunca codificar revisão zero fixa. Omissão conserva preferências existentes.
  409 conserva formulário local e exige reconferência/reload explícito.
- Herança: snapshot explícito novo começa revisão1; legado sem snapshot revisão0.
  Refinamento técnico comprovado em RED/GREEN: zero para snapshot herdado não
  permitia distinguir snapshot perdido de legado. Publicadas não são alteradas.
- `GET .../versoes/:numero/apresentacao-paciente` (BFF já implementado) e helper
  `obterApresentacaoPacientePlano` entregam DTO permitido, com status, dados de
  paciente/porção e somente alternativas liberadas. Sem prefs profissionais,
  revisão CAS, cipher, justificativas de cálculo ou hash clínico.
- Portal conserva publicado atual e escolha atual; recebe preferências paciente
  planas + estado. Ausência/legado mantém UI antiga. Indisponível NÃO é default:
  mostrar mensagem, impedir saída/PDF incoerente e permitir reconferência do
  rascunho somente pelo fluxo autorizado. Não imprimir dados de fallback antigo.

### Implementação entregue

1. Painel pequeno de preferências, separado do arquivo grande do editor; integrar
   FormularioPlano/formularioDaVersao/payload/dirty/save. Ocultar apresentação
   nunca apaga campos ou esconde erros/justificativas obrigatórias. Metas e
   valores matemáticos permanecem os mesmos. PA01–04/FND02 continuam funcionando.
2. `horario/macros/medidasCaseiras/orientacoes` controlam apresentação existente;
   porção em gramas e alimento principal permanecem visíveis. Modo compacto
   somente espaçamento. Preferência profissional não modifica resumos PA04.
3. Portal: expansão em memória independente do limite por item; principal e
   escolha atual identificados mesmo recolhidos. Respeitar `Ver mais` quando
   expandida configuração padrão; não mandar zero no campo legado.
4. Impressão paciente: usar SOMENTE DTO da nova rota. O `ResumoVersao` atual
   contém alternativas internas e NÃO pode continuar no DOM impresso da saída
   paciente. Substituir a cópia `somente-imprimir`; conferir print media em teste.
5. `PlanoAlimentarPaciente`/renderer compartilhado deve suportar preview draft
   identificado como rascunho e sem botões de registrar escolha. Portal mantém
   ações legítimas. PDF inclui todas as alternativas liberadas, mesmo recolhidas
   na tela, e exclui ações. Não fazer escolha de paciente com sessão profissional.
6. Antes de `window.print()`, buscar projeção publicada relevante, aguardar
   renderização e conferir paciente/plano/versão ainda atuais. Abort/sequence
   guard, limpeza no erro/403/404/troca; falha impede impressão de preview antigo.
7. Testes sintéticos T07/T08: save/reidratação, 409, erro de corrupção, saída não
   salva, aplicação/cópia sem mudar prefs destino, troca A→B/versão com request
   pendente, alternativas privadas ausentes em DTO/PDF, flags independentes,
   principal/gramas/escolha, print das liberadas e teclado/axe/overflow nos dois
   projetos Playwright. Extrair testes por responsabilidade para evitar acoplamento.

### Ambiente e conclusão

Node22.21.1 disponível em `/tmp/octaclin-pa02-toolchain/node-v22.21.1-linux-x64/bin`;
use PATH correspondente e `corepack pnpm` (11.25.0). Dependências congeladas
backend/Web instaladas. Nenhuma biblioteca nova. Containers descartáveis foram
encerrados; PostgreSQL image permanece para repetir testes locais.

T07/T08 foram implementados na worktree e testados localmente; detalhes e
contagens estão em [todo-pos-320-pa05.md](todo-pos-320-pa05.md). O retorno ao Sol
foi confirmado; revisão R4 estática PASS e CI/PR T09 em execução. Uma PR reúne
plano/código; nenhuma PR
documental separada.
Não fazer merge/deploy/migration externa. A autorrevisão inicial não era
independente; revisão estática cruzada e correções estão em
[REVISAO_R4_PA05_2026-10-14.md](../docs/governance/REVISAO_R4_PA05_2026-10-14.md).
Migração1072 precisa de procedimento externo próprio.
