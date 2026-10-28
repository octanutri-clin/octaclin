# FOOD07 — plano técnico: metadados e localização de receitas

> Execução futura: usar `superpowers:executing-plans` tarefa por tarefa. **Somente planejamento autorizado** nesta rodada. Q1/Q3 aprovadas; Q2 ampliada pelo proprietário para ajuste de quantidades por rendimento. Detalhes S1–S3 enviados em perguntas complementares permanecem pendentes. Recomendações não ratificadas estão identificadas abaixo. Nenhuma implementação, migration externa, merge ou deploy autorizado.

**Objetivo:** completar metadados e localização da biblioteca existente, preservando receitas, planos aplicados e envios históricos.

**Arquitetura:** estender conteúdo cifrado e serviços da Fase310, mantendo alimentos, quantidades e instruções atuais. Filtro de etiqueta por índice HMAC tenant-aware no PostgreSQL antes da paginação; projeções distintas para biblioteca e portal. Incluir porcionamento determinístico por rendimento usando os contratos nutricionais existentes, sem fonte nova ou dependência externa. Não depende da equivalência por nutriente FOOD05.

**Stack:** NestJS/TypeORM/PostgreSQL com FORCE RLS, cifra/HMAC existentes; Next.js/BFF/React. Node `>=22 <23`, pnpm exato declarado no checkout. Reutilizar Jest, Testcontainers, Playwright e Axe existentes.

**Especificação:** FOOD07 em [roadmap](../docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md); item19 da [matriz](../docs/pos-320/02_Matriz_71_Sugestoes_OctaClin.md). Decisões Q1–Q3 e complementos S1–S3 abaixo.

## Base, isolamento e autorização

- Worktree `/workspace/octaclin/.worktrees/pos320-food07-planning`, branch `docs/pos320-food07-planning`, criada de origin/main `2f24fcb178ff6cbd4623a233a665cce1416bfd9f` em28/10/2026; fetch conferido nesta rodada.
- PR446 permanece Ready for Review no HEAD aprovado2ed4ad40; sem mudança. Nenhum arquivo/G06 da outra worktree foi movido ou descartado; `next-env.d.ts` preexistente preservado lá.
- FOOD07 não depende do motor FOOD05 nem de1079. A futura migration deve usar número livre superior ao1079 reservado pela PR446; candidato1080, confirmar novamente antes de criar/registrar. Não importar1079 para esta branch nem encadear a PR em446.
- A main contém FOOD04/1078; testes descartáveis poderão aplicar o conjunto do checkout. Integração futura com446 precisa reconciliação de registro TypeORM, DTO/API/UI e ensaio combinado, sem modificar a PR aprovada.
- Nova PR individual Draft somente para FOOD07; implementação depende do fechamento de decisões e autorização. G06 produtivo permanece separado/BLOCKED; main auto-deploy exige zero merge sem nova autorização.

## Decisões para fechamento

| ID | Pergunta enviada | Proposta preferencial | Estado |
| --- | --- | --- | --- |
| Q1 | Tags livres, rendimento em porções e tempo total em minutos opcionais, mais paginação/filtros? | Escopo aprovado integralmente | APROVADO pelo proprietário |
| Q2 | Rendimento informativo ou ajuste automático de quantidades? | Proprietário escolheu **também ajustar quantidades pelo rendimento** | APROVADO como ampliação do planejamento; substitui proposta somente informativa |
| Q3 | Destino dos metadados? | Tags só console; rendimento/tempo em novos envios explícitos ao portal | APROVADO; históricos preservados |

### Complementos funcionais para porcionamento — pendentes

| ID | Pergunta enviada | Recomendação |
| --- | --- | --- |
| S1 | Base dos ingredientes: receita inteira confirmada ou permitir cadastro também por porção? | Receita inteira explicitamente confirmada + rendimento. Legados sem inferência/ajuste até confirmação do profissional |
| S2 | Aplicação com porções fracionárias ou só inteiras? | Frações como0,5/1,5, com prévia e confirmação |
| S3 | Escalar apenas ao inserir no plano ou também personalizar envio ao portal? | Apenas plano nesta entrega; portal recebe preparo completo e rendimento informado |

O aceite anterior de campos opcionais permanece: uma receita pode continuar sem rendimento, sem inventar1porção. O ajuste proporcional exige dados/base confirmados. S3 não reabre a aprovação de exibir rendimento/tempo nos novos envios: decide se as quantidades do envio também podem ser personalizadas. Se o proprietário escolher múltiplas bases ou envio individualizado, detalhar os contratos correspondentes antes de implementar. Nenhum ponto pendente é aprovado por silêncio.

## Gaps observados e reuso

| Superfície real | Situação | Uso/alteração proposta |
| --- | --- | --- |
| `dominio/receitas-nutricionais.ts` / `ConteudoReceitaNutricional` | Conteúdo `instrucoes?` + itens; categorias livres normalizadas; receitas/refeições prontas e escopos pessoal/clínica | Tags, rendimento, tempo ausentes: RESIDUAL CONFIRMADO. Ingredientes/instruções/categorias JÁ COBERTOS, não recriar |
| `infraestrutura/receita-nutricional.orm.ts` | Nome/conteúdo cifrados; categoria em coluna; versão, autoria e arquivamento existentes | Metadados no ciphertext atual; coluna aditiva só para índice HMAC de etiquetas |
| `aplicacao/servico-receitas-nutricionais.ts` | Criar/listar/obter/editar/arquivar; CAS e lock no editar; cifra/auditoria/tenant | Reusar escopo, versão e transação; validar novo conteúdo também na leitura; listagem SQL antes de decifrar somente página |
| `aplicacao/dtos.ts` / controlador | Filtros categoria/origem/tipo/página/limite existentes | Não substituir endpoints atuais. Novo DTO/body de consulta para etiqueta; limites exatos abaixo |
| `aplicacao/servico-compartilhamento-receitas.ts` | Snapshot cifrado por envio, versão esperada/locks, agendamento, opt-in, retirada e primeira leitura | Preservar transporte/canais; snapshot e resposta de paciente passam por allowlist, sem tags internas |
| `biblioteca-receitas-nutricionais.tsx` | Edição e categoria existem; listagem fixa página1/limite100, UI só filtro categoria | Paginação real e filtros; formulário metadados; seleção/edição não descartadas silenciosamente em troca de filtro |
| `lib/plano-alimentar-api.ts` e BFF receitas | Tipos/proxies/auth existentes | Tipos aditivos, nova consulta e privacidade; sem URL/token/contexto clínico no client |
| `receitas-compartilhadas-portal.tsx` | Exibe instruções/itens da cópia enviada | Q3 aprovado: exibir rendimento/tempo do snapshot, nunca consultar a biblioteca atual para completar histórico |
| `ServicoGruposSubstituicoes.indices` + `CriptografiaDadosSensiveis.gerarHashPerfilExato` | HMAC por tenant e normalização existente | Reutilizar primitiva para etiqueta; não copiar sistema de favoritos/grupos nem compartilhar índices entre tenants |

Todos paths BE acima relativos a `octaclin-backend/src/modulos/planos-alimentares/`; FE componentes em `octaclin-web/components/{pacientes,portal}`. Code review estático, não prova teste/runtime. Nenhuma lacuna exige FOOD05-MDL.

## Contratos propostos

### Conteúdo e normalização

Manter `instrucoes?: string; itens: ItemModeloPlanoAlimentar[]`. Acrescentar `metadados?: MetadadosReceitaV1` ao JSON cifrado:

```ts
interface MetadadosReceitaV1 {
  schemaVersao: 1;
  baseQuantidades?: 'receita_inteira'; // candidato, depende de S1
  etiquetas: string[];
  rendimentoPorcoes?: number;
  tempoPreparoMinutos?: number;
}
interface AlteracaoMetadadosReceita {
  baseQuantidades?: 'receita_inteira' | null; // omissão preserva; null revoga
  etiquetas?: string[];
  rendimentoPorcoes?: number | null;
  tempoPreparoMinutos?: number | null;
}
```

Limites técnicos propostos, não clínicos: até10 etiquetas com1–40 caracteres cada após trim/espaços/NFC; deduplicar conforme a normalização HMAC atual (NFKD sem acentos, lowercase pt-BR, trim/espaços), preservando grafia da primeira. `Café` e ` cafe ` são a mesma etiqueta. Rejeitar controles, strings vazias, objetos/chaves especiais, tipos errados, tags com aparência de email/UUID/identificador longo conforme padrão já usado na categoria. Isso não garante ausência de dados pessoais: UI explica “Use etiquetas de organização, sem dados do paciente”; não usar tags para inferir alergias/condições.

Rendimento-base proposto: inteiro1–1000 porções; a precisão do número de porções desejadas depende de S2; tempo total: inteiro1–10080 minutos. Ausente não vira0/1. Limites só protegem entrada/UX; não classificam adequação. Porções desejadas fracionárias foram levadas a S2; não confundir precisão da solicitação com peso/quantidade aplicados. O profissional descreve preparo nas instruções existentes; sem passos estruturados novos, soma de tempos, rendimento em peso ou cálculo de densidade nesta entrega.

Create sem metadados mantém formato legado. PUT sem propriedade `metadados` preserva metadados existentes para cliente antigo; objeto presente é alteração parcial: campos omitidos preservam, `etiquetas: []` limpa, `rendimentoPorcoes:null`/`tempoPreparoMinutos:null` removem explicitamente. `metadados:null`, `etiquetas:null`, valores0/negativos/fracionários, strings numéricas, unknown keys são rejeitados, inclusive em serviço; não usar `IsOptional` para aceitar null inadvertidamente. Versão esperada permanece obrigatória; cada update válido segue incremento atual. Não confiar em interface TypeScript ou casts.

`lerConteudoReceita(valor:unknown)` valida legado/novo, preservando regras atuais de itens/quantidades, falhando com mensagem sanitizada para ciphertext/estrutura inválida sem write. Não converter receita FOOD05 em manual nem aceitar proveniência nova através dessa biblioteca.

### Listagem e privacidade

Novo `POST /planos-alimentares/receitas/consulta`, análogo ao padrão de grupos, com body `{pagina?,limite?,origem?,tipo?,categoria?,etiqueta?}`. Default25, máximo100, pagina até `PAGINA_MAXIMA`; filtros AND, etiqueta exata normalizada; categoria mantém semântica existente. Response `{itens,total,pagina,limite}`, com resumo atual + metadados profissionais validados. Ordem estável `atualizado_em DESC,id DESC`. Offset é paginação viva: edição pode deslocar resultado; não prometer snapshot de busca. Ajustar página vazia após arquivar sem duplicar ação.

Preservar GET antigo e POST/PUT/DELETE existentes. Novo POST consulta só exige `planos_alimentares.ler`; tenant/escopo derivados da sessão. Filtrar antes de count/skip/take por SQL parametrizado e RLS. Nenhum scan de todo ciphertext, paginação em memória, limite100 silencioso ou autocomplete global de tags. Termos/etiquetas não vão em URL, logs, auditoria ou cache persistente. BFF body pequeno com leitura limitada (8KiB para consulta), private/no-store; backend valida body. Não alterar limite de payload dos itens legacy sem prova de necessidade.

Conteúdo cifrado é fonte da verdade; `etiquetas_hashes text[] not null default '{}'` é apenas índice derivado, com limite10 em constraint e índice GIN. Derivar por `gerarHashPerfilExato(tenantId,'tag',valor)`, na mesma transação da versão/ciphertext. Não permitir cliente fornecer hashes. Para registros antigos vazios não há backfill de conteúdo nem mudança de versão. Casos manuais de drift devem falhar/ser diagnosticados sem expor payload; não reparar lendo retroativamente todo acervo ao listar.

### Snapshot, compartilhamento e portal

Tags internas não podem entrar no snapshot entregue ao paciente nem na resposta HTTP (esconder em JSX não basta). `projetarConteudoReceitaPaciente` faz allowlist explícita de instruções/itens e rendimento/tempo em `metadados` públicos próprios sem etiquetas. Usar na criação de novos envios e na resposta ao portal. Versão/nome vêm do snapshot. Leitores aceitam ausência de metadados em envios antigos; jamais completam a partir do cadastro atual.

Congelar conteúdo no momento do envio/agendamento conforme310; editar biblioteca exige novo envio explícito para mudar entrega. Replay da mesma chave não atualiza snapshot. Cronograma/canais/consentimentos/retirada/profissional responsável não são modificados. Retorno portal valida e projeta campos conhecidos de snapshot em vez de repassar JSON cru; testar injeção de tag/unknown key e erros sanitizados. Instruções são texto, sem novo HTML/rich text.

### Ajuste por rendimento — extensão aprovada, contratos propostos

A alternativa “somente informativo” foi substituída expressamente pelo proprietário. O desenho a seguir depende de S1–S3 e não é autorização de implementação.

- Exemplo proposto: ingredientes500g no preparo que rende4porções; selecionar0,5porção aplica62,5g. Fator exato = porções desejadas / rendimento-base; multiplicar cada quantidade e peso pela mesma razão. Nutrientes por100g não são multiplicados pelo fator; totais de macros/micros vêm do motor atual após aplicar os pesos efetivos. Tempo de preparo e números escritos nas instruções não são escalados.
- Metadados precisam declarar base confirmada, candidata `baseQuantidades: 'receita_inteira'`; ausência em receita antiga significa desconhecida, não receita inteira/uma porção. Não habilitar escala só porque algum cliente preencheu rendimento; confirmar base na edição com versão esperada. Não migrar/escrever legados automaticamente.
- Prévia server-side proposta `POST /planos-alimentares/receitas/:receitaId/previa-porcionamento`, permission `planos_alimentares.ler`, body `{versaoEsperada,porcoesDesejadas}`; proposta para S2: desejadas0,001–1000 com até3casas se frações aprovadas, ou1–1000inteiras. Sem tenant/composição enviados pelo cliente. Reusar escopo/fonte autorizada; recusar versão stale/arquivada/indisponível. Nenhuma gravação no plano ou biblioteca. A confirmação deve obter novamente o resultado autorizado para a mesma versão/solicitação antes de inserir; mudança exige nova conferência, sem substituir silenciosamente o formulário.
- Usar aritmética racional/inteiros escalados determinística, com padrões existentes de `medidas-caseiras.ts` e `micronutrientes.ts`; helpers dessas áreas não devem ser exportados/refatorados amplamente só para reaproveitar detalhes privados. Não copiar código da branch446 nem depender do merge FOOD05. Arredondar uma vez para3casas, half-up proposto, exibir original/calculado/efetivo e aproximação quando houver resíduo.
- Preservar unidade declarada, revalidar limites atuais de quantidade e porcaoGramas, ambos0,001–10.000 e até3casas. Não inventar densidade ou conversão culinária. Aplicar mesmo fator às alternativas já cadastradas se pertencentes ao preparo, sem afirmar equivalência nutricional e sem alterar concentrações. Tratar inconsistências de medida/gramas explicitamente; nunca “corrigir” uma das duas silenciosamente.
- Se qualquer item/alternativa selecionado produzir zero por arredondamento, ultrapassar limite, contiver valores não finitos ou dado obrigatório faltar, bloquear aplicação proporcional inteira e indicar a linha. Oferecer outra quantidade de porções ou retorno ao fluxo manual existente. Não clamp, remover item ou aplicar resultado parcial automaticamente.
- Preview→confirmação é local ao formulário: inserir só após confirmar e usar persistência/autosave/ACK/PA07 atuais. Cancelar, resposta antiga, perda de posse e troca paciente não alteram nada. Todas as prévias partem da base original salva, não de uma prévia já arredondada. Valores confirmados tornam-se independentes da biblioteca e não alteram planos publicados ou aplicações anteriores.
- Opção legacy “Inserir quantidades cadastradas” deve ser claramente distinta de “Ajustar por porções”, preservando o uso de receitas sem rendimento/base. Nenhuma publicação, liberação de alternativa ou gravação antecipada é adicionada.
- S3 recomendado: novos envios ao portal continuam snapshot da receita completa, mostrando rendimento e tempo; aplicação de porções no plano não altera esse snapshot. Se S3 aprovar envio personalizado, o plano de snapshot/preview/idempotência precisará ser ampliado antes de implementar.


## Migration candidata e autorização

Uma migration aditiva proposta: `1720000001080-MetadadosReceitasNutricionais.ts`, classe/registro correspondentes; **confirmar número livre após decisões e na base de implementação**. Adicionar somente `etiquetas_hashes`, constraint de cardinalidade e índice GIN; campos sem query ficam cifrados. Não editar1033/1066/1078/1079, não recriar policies, não conceder DDL ao runtime. Não exige nova tabela/tag global nem dependência npm.

Preservar FORCE RLS e grants existentes; provar acesso de runtime e ausência de acesso entre tenants em PostgreSQL real. Down deve recusar remoção destrutiva de histórico/índice ou ter estratégia explicitamente aprovada; preferir manter schema aditivo e correção adiante. Dados novos cifrados podem ser ignorados/lost por writers antigos: rollback após novas gravações exige reader/writer compatível, não só revert da imagem. Sem alteração de produção/staging até autorização própria, mesmo após03/11; data não desbloqueia quota/G06.

## Permissões (preservar contrato real)

| Papel | Leitura/escrita biblioteca | Paciente/compartilhamento |
| --- | --- | --- |
| Professional | Permissão ler/gerenciar; pessoais do próprio vínculo + clínica do tenant. Contrato atual permite editar receita clínica acessível; não importar política autor/admin FOOD04 | Fluxo310 revalida responsável/carteira/aceite; não ampliar |
| SuperAdmin | Mantém regra existente no tenant autenticado; pessoal exige vínculo conforme service | Não conceder novo direito de envio ou assumir paciente por esta fase |
| Client/colaborador sem papel permitido | Rejeitado nas rotas de receitas atuais | Sem novo acesso |
| Patient | Sem acesso à biblioteca/etiquetas | Apenas snapshot ativo próprio, conforme portal310 |

Se auditoria adicional achar risco existente de permissão, relatar evidência e menor correção separadamente; não ampliar esta fase para refazer autorização. Dados internos livres, snapshots e índice cifrado elevam risco a R4 para revisão independente de fronteiras.

## Tarefas sequenciais e TDD

Cada tarefa começa com RED reproduzível, correção mínima GREEN, regressões afetadas e commit intencional; etapas de implementação ainda NOT RUN. Arquivos novos só após decisões.

### T01 — domínio e DTOs de metadados

Arquivos: modificar `dominio/receitas-nutricionais.ts`, `aplicacao/dtos.ts`; criar `dominio/metadados-receita.ts` e `.spec.ts`, `aplicacao/dtos-receitas-metadados.spec.ts`.

Interfaces: `normalizarMetadadosReceita(entrada:unknown):MetadadosReceitaV1`, `mesclarMetadadosReceita(anterior:MetadadosReceitaV1|undefined,alteracao:unknown):MetadadosReceitaV1|undefined`, `lerConteudoReceita` e projeção paciente. Os nomes/tipos exportados devem coincidir em tarefas posteriores.

- [ ] RED: legado sem campos não ganha valores fictícios; tags Café/cafe duplicam só uma vez; payload estranho/null/0/NaN/Infinity/frações/limites/unknown keys falha; omissão vs limpeza explícita preserva/remova exatamente.
- [ ] Executar Jest focado e confirmar assertion de comportamento antes de implementar; não classificar erro de setup como RED.
- [ ] Implementar funções/DTOs estritos; GREEN e commit. P1/P2 do Review Focus abaixo cobertos aqui.

### T02 — persistência e consulta tenant-aware

Arquivos: ORM receita, migration candidata + `.spec.ts`, `opcoes-typeorm.ts`, serviço de receitas + spec; nova `metadados-receitas.integracao.spec.ts` em `infraestrutura/banco-dados/`.

Consome T01 e primitiva HMAC; produz `consultar(tenantId,usuario,consulta)` e grava conteúdo/índice sob CAS existente.

- [ ] RED serviço: criar/editar/ler, cliente antigo sem metadata preserva; filtro aplicado antes da página, total correto com101+ receitas; segredo/hash não sai em DTO/auditoria; escopos/tenant/role negativos.
- [ ] RED PostgreSQL real: schema anterior→migration candidata; defaults antigos; HMAC por tenant, GIN/constraint, FORCE RLS e role runtime sem DDL/bypass; CAS simultâneo ganha só uma escrita; falha índice/cifra/versão faz rollback integral; filtro count/page real.
- [ ] Estender leitura validada, lock/CAS e índices na mesma transação. Arquivar deve adquirir lock antes de carregar/save para não sobrescrever metadados numa corrida com edição; não mudar outras permissões ou API de versão.
- [ ] GREEN focado e integração descartável; commit. Testar arquivar/editar e compartilhar/editar com barreira controlada; snapshots permanecem da versão conferida, erro409 em versão stale. Nenhum banco externo.

### T03 — fronteira de compartilhamento e portal

Arquivos: serviço de compartilhamento existente; criar sua spec focada se ainda ausente; integrar fixtures PostgreSQL da tarefa anterior; tipos API e componente portal conforme Q3 aprovado.

Consome leitura/projeções T01, não recebe novo payload clínico do navegador. Produz snapshots públicos allowlisted e resposta pública minimizada.

- [ ] RED: tag interna e unknown key injetadas no conteúdo não aparecem em share/portal; snapshot antigo permanece igual após editar rendimento; replay não substitui bytes; novo envio recebe novos números; agendamento preserva versão congelada; fonte/aceite/vínculo revogados falham conforme contrato310.
- [ ] Implementar projeção na criação e leitura; não voltar ao conteúdo vivo ao abrir portal. GREEN serviço, persistência e regressões310; commit.

### T04 — BFF e tipos do console

Arquivos: criar `octaclin-web/app/api/planos-alimentares/receitas/consulta/route.ts`; modificar `lib/plano-alimentar-api.ts`, `scripts/test-planos-alimentares-bff.mjs` e `scripts/planos-alimentares-bff.spec.ts`; rotas portal só se projeção adicional BFF for necessária.

Produz `consultarReceitasNutricionais(consulta,signal?)` por POST body; tipos explícitos para metadados interno/público, atualização parcial e resposta paginada. GET legado continua.

- [ ] RED: sem sessão/perm, body>8KiB, unknown field backend rejeitado, query arbitrária não passa, private/no-store; nenhuma tag em URL. Cancelamento mantém sinal AbortController sem capturar PII.
- [ ] Implementar wrapper existente e validar contratos; GREEN BFF/authz/typecheck; commit.

### T05 — formulário, paginação e filtros

Modificar `biblioteca-receitas-nutricionais.tsx`; extrair apenas formulário de metadados em componente próprio se reduzir acoplamento, sem reescrever compartilhar/arquivar. Criar spec `octaclin-web/tests/visual/food07-metadados-receitas.spec.mjs` no config completo existente.

- [ ] RED desktop/mobile: campos opcionais, editar/limpar/preservar; filtro origem/tipo/categoria/etiqueta+reset; próxima/anterior com total101; estado vazio/erro/loading e página após arquivar.
- [ ] RED respostas tardias: consultaA não substitui consultaB; troca paciente não carrega compartilhamento anterior; mudança de filtro não aplica receita selecionada antiga ou perde rascunho de edição; cancelar sem writes. Paging não perde seleção explícita de compartilhar até10 nem confunde dados/resumos de páginas distintas; manter mapa mínimo em memória ou limpar somente com confirmação, versão conferida antes do envio.
- [ ] Fluxo de aplicação legacy mantém quantidades cadastradas; novo ajuste por rendimento depende de T06 e confirmação explícita; autosave60s/ACK e PA07 preservados.
- [ ] Implementar UI, AbortController/geração, teclado/labels/erros e reflow; GREEN Playwright desktop/mobile + Axe; commit. Conforme Q3 aprovado, mostrar somente tempo/rendimento de novos snapshots no portal com regressão do antigo.

### T06 — porcionamento server-side e prévia de confirmação

Arquivos propostos: criar `dominio/porcionamento-receita.ts` + `.spec.ts`, `aplicacao/servico-porcionamento-receita.ts` + `.spec.ts`; registrar no módulo/controlador de planos; DTOs específicos e BFF `receitas/[receitaId]/previa-porcionamento/route.ts`; UI de prévia junto da biblioteca. Contratos exatos dependem de S1–S3; não implementar variantes por inferência.

- [ ] RED: exemplo500g/4→0,5=62,5g; razão periódica; mínimo/máximo; alternativa; composição por100g intacta; macros após peso efetivo; instruções/tempo imutáveis; desconhecido/zero/frações inválidas sem NaN/Infinity; nenhum clamp.
- [ ] RED: receita legada sem base não habilita escala; versão alterada entre prévia/confirmar, arquivamento, fonte revogada e outro tenant/profissional recusados. Base reaproveitada original impede arredondamento acumulado.
- [ ] RED BFF/UI desktop/mobile: sem sessão, corpo adulterado, resposta tardia, confirmação repetida/retry, trocar paciente, cancelar e perder posse PA07; nenhuma persistência antes de confirmação, autosave60s/ACK preservados.
- [ ] RED persistência descartável: pesos/quantidades confirmados salvos e histórico íntegro, rollback integral em falha; não usar mock como prova de snapshot/concorrência.
- [ ] GREEN por módulo, integração nutricional/regressões FOOD04 e compartilhamento; commit. Não afirmar equivalência FOOD05 nem alterar446.

### T07 — revisão, integração e PR individual

- [ ] Executar regressões afetadas (receitas310, compartilhamento, FOOD04, planos, autosave/PA07, BFF/portal), PostgreSQL/RLS e builds em Node22.
- [ ] Solicitar revisão independente R4 da entrega estabilizada, nomear revisor/escopo/limitações e corrigir achados com TDD; revisão própria não é independente.
- [ ] Atualizar checklist/handoff/roadmap com decisões, comandos e commit. Diff/segredos/links; abrir PR FOOD07 Draft individual; CI/scanners do HEAD. Sem merge/DDL externo/infra. Integração com FOOD05 futura verificada sem alterar446.

## Review Focus — falhas com testes obrigatórios

Porcionamento adiciona RED/GREEN de razão exata, arredondamento, unidades, legado sem base e resultado inválido em T06. Ajuste no plano não deve mudar receita completa enviada ao portal enquanto S3 não aprovar outra regra.

1. Cliente antigo salva sem metadata e apaga dados novos → T01/T02 preservam omissão, explicitam null/[] e lock.
2. Tags internas vazam por snapshot cru → T01/T03 testam payload HTTP real projetado, não somente JSX.
3. Total paginado falso/filtro só nos primeiros100 → T02/T05 usam101+ registros e SQL count antes de paginação.
4. Resposta tardia/confusão de paciente/página aplica outra receita → T05 cancela/ignora resposta por identidade e confirma versão/seleção.
5. Reversão para writer antigo remove tags/metadados ou perde snapshots → T02/T03 comprovam compatibilidade/snapshots; documentação bloqueia rollback não compatível.

## Gates e comandos previstos (ainda NOT RUN)

- G00 análise documental: branch/base/paths/referências/decisões rastreados; Q1/Q3 aprovadas e Q2 ampliada; detalhes S1–S3 PENDENTES.
- G01 domínio/DTO/service: `pnpm --dir octaclin-backend exec jest --runInBand metadados-receita dtos-receitas-metadados servico-receitas-nutricionais servico-compartilhamento-receitas`; incluir novos testes de projeção/legacy.
- G02 banco: suite Testcontainers específica deve ser incluída em `pnpm test --runInBand` do CI Backend; flag única documentada e habilitada no workflow se necessário, provar asserções executadas (nenhum skipped como PASS). Sem conexão externa. Não reutilizar suite com apenas mocks como evidência RLS.
- G03 Web: `pnpm --dir octaclin-web test:planos-alimentares:bff`, `pnpm --dir octaclin-web test:authz`, lint/typecheck/build dos pacotes afetados; `pnpm --dir octaclin-web exec playwright test tests/visual/food07-metadados-receitas.spec.mjs` usando config/projetos reais (não presumir nome de projeto sem conferir). Regressão PA07 e Axe no mesmo config, Node22.
- G04 segurança: matriz authz/RLS/CAS, projeções, limites, revisão independente; CodeQL/Semgrep/Trivy/Dependency Review no HEAD.
- G05 CI/entrega técnica: todos os checks aplicáveis no commit exato, skips explicados; PR Draft e sem merge.
- G06 operação: BLOCKED/separado até autorização pós-retorno e regularização real. Não reivindicar prontidão produtiva por teste descartável ou data03/11.

## Evidências desta rodada

Executado somente leitura de main atualizada, arquivos/contratos/testes existentes e duas referências externas específicas; branch limpa criada de main. Nenhum teste de runtime, migration ou CI foi executado nesta etapa documental. A chamada `pnpm security:secrets` inicializou automaticamente o ambiente pnpm e reportou Already up to date; não houve mudança versionada de dependências/lockfiles. Não criar symlink de node_modules para outra worktree nem reinstalar sem necessidade. Espaço do executor observado97% usado é limitação para futura prova local; não apagar artefatos sem critério/autorização. Se execução local for inviável, gates oficiais de banco/Playwright no CI devem executar exatamente os cenários, sem declarar PASS de teste bloqueado.

Verificação documental executada: links locais dos quatro arquivos PASS; scanner de segredos local PASS; diff check PASS. O scanner executou em Node24.19.0/pnpm11.19.0 e emitiu aviso de engines; não constitui validação de runtime compatível. Nenhum teste de implementação executado ou declarado PASS.

## Histórico de decisão — respostas do proprietário

Q1 integral aprovado; Q3 tags internas e rendimento/tempo em novos envios aprovado. Q2 passou de proposta informativa para **ajuste de quantidades por rendimento**, incluído nesta fase de planejamento. Essa alteração não autoriza runtime automaticamente. S1–S3 concentram os detalhes ainda necessários. A versão anterior do plano está preservada no commit691b34d3.
