# PA05 — preferências de exibição das refeições

Planejamento autorizado e D01–D03 confirmadas em 2026-10-14. Base `main`
`64f54b88` (PR #418), conteúdo idêntico ao HEAD aprovado `37d7979`.
Branch `docs/pos320-pa05-planejamento`; worktree isolada. Esta etapa altera
somente documentação; implementação aguarda autorização do proprietário.
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
novo e revisão zero, impedindo replay da versão anterior. O requisito novo é
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

T00/documentação PASS após verificações registradas no checklist; T01–T09
SKIPPED nesta rodada, pois implementação não foi autorizada. R4 cruzada, banco,
frontend, CI e rollout PA05 ainda não executados; CI da PA04 não prova PA05.
Uma PR de entrega futura reúne estes documentos e a implementação.

GPT-6.1 Sol médio: persistência, CAS, hash, projeção e integração R4.
GPT-6 Luna alto: componente isolado de preferências e estados visuais após
contratos backend fechados. Sol médio encerra integração/segurança/PR.
Não recomendar Luna sozinho para migration e projeção clínica desta fase.
Antes de qualquer troca, avisar modelo alvo e pausar para mudança manual.
Pesquisa restrita a R014/R041 e testes focados primeiro reduzem custo de tokens.

Próxima ação: autorização de implementação pelo proprietário; iniciar T01 com
RED de defaults/normalização, sem reabrir D01–D03 nem instalar bibliotecas.
