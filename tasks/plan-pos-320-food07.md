# FOOD07 — plano técnico: metadados e localização de receitas

> Execução futura: usar `superpowers:executing-plans` tarefa por tarefa. **Somente planejamento autorizado** nesta rodada. Q1–Q3 e S1–S3 respondidas e incorporadas: duas bases de ingredientes, porções fracionárias com prévia e envio porcionado ao portal. Plano consolidado para revisão/autorização de implementação; parâmetros técnicos abaixo são escolhas de engenharia propostas, não ratificação clínica. Nenhuma implementação, migration externa, merge ou deploy autorizado.

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

### Complementos de porcionamento — respostas aprovadas

| ID | Decisão do proprietário | Contrato incorporado |
| --- | --- | --- |
| S1 | Poder cadastrar ingredientes também por porção | Bases explícitas `receita_inteira` e `por_porção` (enum técnico `por_porcao`); legados sem base conhecida não ganham escala por inferência |
| S2 | Porções fracionárias com prévia | Solicitar0,5/1,5etc.; prévia e confirmação obrigatórias; precisão/limites técnicos abaixo |
| S3 | Ajustar também receitas enviadas ao portal | Escolha de porções individual por receita do lote, snapshot independente do destino e mesma matemática do editor |

Campos de organização continuam opcionais. Rendimento da preparação inteira é obrigatório apenas para escalar a base `receita_inteira`; base `por_porcao` já define uma porção e pode ter rendimento total informado separadamente. Receitas sem base conhecida mantêm fluxo legado explícito sem escala. Não há outra decisão funcional bloqueante identificada nesta rodada; o plano e a execução ainda exigem aceite do proprietário.

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
  baseQuantidades?: 'receita_inteira' | 'por_porcao';
  etiquetas: string[];
  rendimentoPorcoes?: number;
  tempoPreparoMinutos?: number;
}
interface AlteracaoMetadadosReceita {
  baseQuantidades?: 'receita_inteira' | 'por_porcao' | null; // omissão preserva; null revoga
  etiquetas?: string[];
  rendimentoPorcoes?: number | null;
  tempoPreparoMinutos?: number | null;
}
```

Limites técnicos propostos, não clínicos: até10 etiquetas com1–40 caracteres cada após trim/espaços/NFC; deduplicar conforme a normalização HMAC atual (NFKD sem acentos, lowercase pt-BR, trim/espaços), preservando grafia da primeira. `Café` e ` cafe ` são a mesma etiqueta. Rejeitar controles, strings vazias, objetos/chaves especiais, tipos errados, tags com aparência de email/UUID/identificador longo conforme padrão já usado na categoria. Isso não garante ausência de dados pessoais: UI explica “Use etiquetas de organização, sem dados do paciente”; não usar tags para inferir alergias/condições.

Rendimento total da preparação: inteiro1–1000 porções; porções desejadas:0,001–1000 com até3casas, incluindo0,5/1,5. Tempo total: inteiro1–10080 minutos. Ausente não vira0/1. Limites só protegem entrada/UX; não classificam adequação. Para base `por_porcao`, a base matemática é exatamente1porção, sem converter esse fato em rendimento total fictício. O profissional descreve preparo nas instruções existentes; sem passos estruturados novos, soma de tempos, rendimento em peso ou cálculo de densidade nesta entrega.

Create sem metadados mantém formato legado. PUT sem propriedade `metadados` preserva metadados existentes para cliente antigo; objeto presente é alteração parcial: campos omitidos preservam, `etiquetas: []` limpa, `rendimentoPorcoes:null`/`tempoPreparoMinutos:null` removem explicitamente. `metadados:null`, `etiquetas:null`, valores0/negativos/fracionários, strings numéricas, unknown keys são rejeitados, inclusive em serviço; não usar `IsOptional` para aceitar null inadvertidamente. Versão esperada permanece obrigatória; cada update válido segue incremento atual. Não confiar em interface TypeScript ou casts.

`lerConteudoReceita(valor:unknown)` valida legado/novo, preservando regras atuais de itens/quantidades, falhando com mensagem sanitizada para ciphertext/estrutura inválida sem write. Não converter receita FOOD05 em manual nem aceitar proveniência nova através dessa biblioteca.

### Listagem e privacidade

Novo `POST /planos-alimentares/receitas/consulta`, análogo ao padrão de grupos, com body `{pagina?,limite?,origem?,tipo?,categoria?,etiqueta?}`. Default25, máximo100, pagina até `PAGINA_MAXIMA`; filtros AND, etiqueta exata normalizada; categoria mantém semântica existente. Response `{itens,total,pagina,limite}`, com resumo atual + metadados profissionais validados. Ordem estável `atualizado_em DESC,id DESC`. Offset é paginação viva: edição pode deslocar resultado; não prometer snapshot de busca. Ajustar página vazia após arquivar sem duplicar ação.

Preservar GET antigo e POST/PUT/DELETE existentes. Novo POST consulta só exige `planos_alimentares.ler`; tenant/escopo derivados da sessão. Filtrar antes de count/skip/take por SQL parametrizado e RLS. Nenhum scan de todo ciphertext, paginação em memória, limite100 silencioso ou autocomplete global de tags. Termos/etiquetas não vão em URL, logs, auditoria ou cache persistente. BFF body pequeno com leitura limitada (8KiB para consulta), private/no-store; backend valida body. Não alterar limite de payload dos itens legacy sem prova de necessidade.

Conteúdo cifrado é fonte da verdade; `etiquetas_hashes text[] not null default '{}'` é apenas índice derivado, com limite10 em constraint e índice GIN. Derivar por `gerarHashPerfilExato(tenantId,'tag',valor)`, na mesma transação da versão/ciphertext. Não permitir cliente fornecer hashes. Para registros antigos vazios não há backfill de conteúdo nem mudança de versão. Casos manuais de drift devem falhar/ser diagnosticados sem expor payload; não reparar lendo retroativamente todo acervo ao listar.

### Snapshot, compartilhamento e portal

Tags internas não podem entrar no snapshot entregue ao paciente nem na resposta HTTP (esconder em JSX não basta). `projetarConteudoReceitaPaciente` faz allowlist explícita de instruções/itens e rendimento/tempo em `metadados` públicos próprios sem etiquetas. Usar na criação de novos envios e na resposta ao portal. Versão/nome vêm do snapshot. Leitores aceitam ausência de metadados em envios antigos; jamais completam a partir do cadastro atual.

Congelar conteúdo no momento do envio/agendamento conforme310; editar biblioteca exige novo envio explícito para mudar entrega. Replay da mesma chave não atualiza snapshot. Cronograma/canais/consentimentos/retirada/profissional responsável não são modificados. Retorno portal valida e projeta campos conhecidos de snapshot em vez de repassar JSON cru; testar injeção de tag/unknown key e erros sanitizados. Instruções são texto, sem novo HTML/rich text.

### Porcionamento determinístico compartilhado

A proposta de rendimento somente informativo foi substituída pelas decisões Q2/S1–S3.

| Base confirmada | Fórmula | Exemplo |
| --- | --- | --- |
| Receita inteira | fator = porções desejadas / rendimento total |500g para4porções, solicitar0,5→62,5g |
| Por porção | fator = porções desejadas |125g por porção, solicitar1,5→187,5g; rendimento total4 não entra novamente na divisão |
| Não informada (legado) | Escala indisponível | Inserir/enviar quantidades cadastradas é opção explícita, sem inventar base |

- Backend único `porcionarReceita` usado pelo editor e compartilhamento. Multiplicar quantidade e porcaoGramas de cada item/alternativa pela mesma razão; identidade/preparo/unidade e concentrações por100g permanecem iguais. Nutrientes totais do plano são recalculados pelo motor existente sobre os pesos confirmados; nenhuma equivalência clínica ou otimização FOOD05.
- Aritmética racional/inteiros escalados, uma rodada half-up para3casas; usar padrões/helpers públicos compatíveis de `medidas-caseiras.ts`/`micronutrientes.ts` sem refatoração transversal. Não copiar nem importar branch446. Prévia mostra original, porções solicitadas, quantidades efetivas e aviso quando arredondadas; todo novo cálculo parte da receita original, não de prévia já arredondada. Fixture independente por `fractions.Fraction` Python pode registrar razões/rounding sem dependência externa e apenas dados sintéticos.
- Quantidade e porcaoGramas finais devem respeitar0,001–10.000 e até3casas; dado inválido/ausente, resultado fora da faixa ou arredondado para zero bloqueia **a confirmação inteira**, identifica linha e não clamp/omite/aplica parte. Concentrações ausentes não viram zero. Não inventar densidade, fator de cocção ou medida caseira.
- Formulário mostra base antes dos ingredientes. Selecionar outra base em receita preenchida abre confirmação: os valores digitados serão reinterpretados naquela base; não converter silenciosamente nem permitir salvar a mudança sem conferência. Conversor automático de base não faz parte desta entrega. Legados requerem confirmação explícita da base de seus valores; cadastrar rendimento sozinho não habilita escala. Alteração incrementa versão/CAS como as demais edições.
- Prévia `POST /planos-alimentares/receitas/:receitaId/previa-porcionamento`, body `{versaoEsperada,porcoesDesejadas}` e permissão de leitura existente. Fonte autorizada/versão/arquivamento revalidados; cliente não fornece composição, fator, tenant ou resultado canônico. Resposta `{receitaId,versao,porcoesDesejadas,baseQuantidades,rendimentoPorcoes?,itens,avisos,fingerprint}` por allowlist; fingerprint SHA256 da serialização canônica dos fatos matemáticos e resultado, não token nem autorização. Sem paciente no cálculo genérico nem escrita.
- Para aplicar no plano, a confirmação solicita a mesma prévia novamente e compara versão/fingerprint/solicitação antes de inserir os valores canônicos; alteração pede nova conferência. Alterar números depois segue edição manual existente. Uma confirmação local aceita uma única intenção de aplicação, desabilita dupla ação e ignora respostas tardias; retries da prévia são read-only. Depois, autosave60s/ACK/PA07 e backend atual revalidam e persistem os pesos efetivos. Não criar endpoint de escrita paralela no plano, capability ou proveniência FOOD05.
- Tempo e números no texto das instruções não são escalados: UI informa que instruções gerais precisam de revisão profissional. Quantidades estruturadas são a referência. No portal, rótulo explícito “Quantidades para X porções”, separado de “Rendimento da preparação original”, quando conhecido. Não apresentar1,5porções ajustadas como receita inteira que ainda rende4.

### Envio personalizado: confirmação, snapshot e replay

- Estender DTO existente com `porcionamentos?: Array<{receitaId:string;porcoesDesejadas:number;fingerprintPrevia:string}>`, até10, sem repetição, todos pertencentes a `receitaIds`. Ausência conserva envio legacy das quantidades cadastradas. Novo UI oferece modo explícito `quantidades_cadastradas` ou `porcionado` por receita; nunca adivinhar pelo rendimento. Itens porcionados exigem prévia e confirmação; itens sem base podem seguir modo legacy sem receber rótulo de porcionados.
- Nova gravação em `compartilhar` revalida paciente/carteira/consentimentos, versão, base, fontes e cálculo **dentro da transação**, confronta fingerprint da prévia e cria snapshot com resultado atual. Reusar locks existentes; fixar ordem estável de receitas por UUID no lote e proteger leitura do vínculo contra transferência durante a operação pelo padrão transacional de paciente existente, sem copiar a arquitetura FOOD05. Testar transferências concorrentes; não ampliar permissões.
- Idempotência atual ainda não cobre porções: incorporar pedido completo normalizado (paciente, receitas/versões, modos/porções/fingerprint, canais e agendamento explícito) ao hash canônico de envio. Excluir horário dinâmico de “agora”; distinguir ausência de agendamento de data fixa. Mesma chave/corpo retorna os mesmos shares/bytes; mesma chave com diferente porção/base/versão/paciente/canais/horário recebe409, sem novas entregas. Não usar apenas receitaId/versão como identidade matemática.
- Reutilizar `snapshotCriptografado` existente, sem tabela paralela: manter campos legacy `{nome,conteudo,versao}` e adicionar contexto interno opcional versionado `{schemaVersao:1,algoritmo:'porcionamento-receita-v1',baseQuantidades,rendimentoOriginalPorcoes?,porcoesDesejadas,fatorExato,hashPedidoCompartilhamento,fingerprint,...fatosNecessarios}`. Conteúdo público guarda somente itens ajustados, instruções e metadados permitidos; etiquetas/hashes/contexto interno nunca saem na projeção paciente. Guardar parâmetros mínimos suficientes para reproduzir o cálculo, não duplicar PII nem copiar dados de paciente para a biblioteca.
- Encapsular leitura do snapshot em helper validado que aceita o formato antigo e novo. Usar em todas as leituras do service (`listarEnvios`, listagem portal e detalhe); auditar consumidores/workers sem refazer o transporte310. Novo contexto/regras são internos; não repassar JSON cru. Reader antigo sem contexto nunca preenche rendimento/porções a partir da biblioteca viva.
- Retry de share novo usa o hash congelado no ciphertext para comparar **comando original**, não recalcula o snapshot por ter mudado a biblioteca. Revalidar acesso atual obrigatório; não criar nova ação nem dispensar autorização por hash. Share legado sem hash admite somente replay compatível com contrato antigo e sem `porcionamentos`; tentar introduzir personalização na mesma chave recebe409. Nada de reescrever snapshot antigo para completar hash.
- Agendamento congela a receita personalizada na confirmação, não no disparo. Worker não recalcula ao ativar; preserva consentimentos/janela e aviso externo genérico, nunca receita ou porções em e-mail/WhatsApp/push. Editar biblioteca ou mudar porções exige nova prévia, nova chave e novo envio explícito.
- Antes de qualquer writer novo, todos os leitores do snapshot e projeções devem estar no release compatível. Depois de shares personalizados, rollback para backend antigo que retorne JSON cru pode vazar contexto interno ou interpretar porções incorretamente; exigir release compatível/correção adiante e manter schema/ciphertext/histórico.

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

## Tarefas sequenciais e TDD — plano consolidado

Sem execução nesta rodada. Cada tarefa: escrever teste funcional RED, rodar e observar assertion falhar, implementar mínimo GREEN, executar regressões afetadas e commit. Erro de setup não é RED. Interfaces exatas do domínio:

- `normalizarMetadadosReceita(entrada:unknown):MetadadosReceitaV1` e `mesclarMetadadosReceita(anterior,alteracao)` preservam omissão/removem explicitamente.
- `lerConteudoReceita(valor:unknown):ConteudoReceitaNutricional` valida legado e novo; `projetarConteudoReceitaPaciente` entrega somente allowlist pública.
- `porcionarReceita(conteudo:ConteudoReceitaNutricional,porcoesDesejadas:number):ResultadoPorcionamento` produz `{estado:'calculavel',itens,baseQuantidades,rendimentoOriginalPorcoes?,porcoesDesejadas,fatorExato,avisos}` ou `{estado:'indisponivel',motivos}`. Fator racional no resultado em strings; nunca BigInt cru em JSON.
- `ServicoPorcionamentoReceita.prever(tenantId,usuario,receitaId,{versaoEsperada,porcoesDesejadas})` retorna a prévia/fingerprint; uma função de resolução recebe EntityManager da transação para compartilhar, sem transação aninhada.
- `lerSnapshotCompartilhamentoReceita(valor:unknown)` aceita legacy/novo e separa público/interno; `hashPedidoCompartilhamentoReceita(pedidoNormalizado)` define comparação de replay.

### T01 — metadados, duas bases e matemática

Arquivos BE relativos a `octaclin-backend/src/modulos/planos-alimentares/`: modificar `dominio/receitas-nutricionais.ts`; criar `dominio/metadados-receita.ts`, `dominio/porcionamento-receita.ts` e respectivas `.spec.ts`; DTOs de metadados/prévia em `aplicacao/dtos-receitas-metadados.ts` e `.spec.ts`, referenciados pelo DTO existente.

- [ ] RED: base inteira500g/4/0,5→62,5; por_porção125g/1,5→187,5 mesmo com rendimento4; fração periódica com resultado half-up/resíduo, independência de cálculos sucessivos, por100g/tempo/instruções intactos, alternativas escaladas pela mesma razão.
- [ ] RED: ausência/zero/NaN/Infinity/precisão excessiva/limites, alvo0,001 e1000, gram/quantidade abaixo/acima da faixa, legado sem base e inteiro sem rendimento; não converter desconhecido em1, não clamp nem confirmar parte.
- [ ] RED: tags e normalização; unknown/null/objeto/chaves especiais, omissão vs limpeza; mudança de base exige confirmação frontend T06. Fixture racional independente e resultados esperados fixados antes da implementação.
- [ ] GREEN e commit. Sem importar código446 ou dependência externa.

### T02 — persistência cifrada, índice e consulta

Modificar ORM receita, serviço de receitas/spec, `opcoes-typeorm.ts`; criar migration candidata1080/spec e `infraestrutura/banco-dados/metadados-receitas.integracao.spec.ts`. Consome T01; produz `consultar(tenantId,usuario,consulta)` e atualização metadata/cifra/índice/CAS atômica.

- [ ] RED: cliente antigo preserva novos metadados; SQL filtra antes de count/offset com101+receitas; tenant/escopo/role negativos; hashes não saem em DTO/auditoria.
- [ ] RED Postgres real: defaults/constraints/GIN, FORCE RLS e runtime sem DDL/bypass, CAS concorrente, rollback da cifra/índice/versão, página/total corretos. Arquivar sob lock evita sobrescrever edição nova; não alterar permissões por conveniência.
- [ ] GREEN focado e descartável; commit. Número de migration novamente conferido antes de criar.

### T03 — prévia autorizada de porcionamento

Criar `aplicacao/servico-porcionamento-receita.ts`/spec; modificar módulo/controlador existente; reusar código autorizado de resolução de fonte e serviço receitas sem criar bypass de escopo.

- [ ] RED: receita atual/legada, arquivada, versão stale, outra clínica/pessoal de outro profissional, fonte revogada; DTO manipulado com composição/fator/tenant é rejeitado. Nenhuma gravação na prévia.
- [ ] RED: fingerprint muda com quantidades/base/versão, não com serialização arbitrária de chaves; confirmar prévia alterada exige reabrir. Reutilização dentro do EntityManager de compartilhar não abre transação independente.
- [ ] GREEN serviço/controller/typecheck; commit. Não considerar fingerprint autorização.

### T04 — compartilhamento porcionado e snapshot independente

Modificar `aplicacao/servico-compartilhamento-receitas.ts`, DTO compartilhamento e specs; criar `aplicacao/snapshot-compartilhamento-receita.ts`/spec; ampliar integração Postgres real de T02. Consome T01/T03 e transação310.

- [ ] RED: preview1,5 confirmado gera quantidades congeladas corretas, tags/contexto interno ausentes do HTTP; histórico antigo igual; edição posterior da biblioteca não altera share; worker agendado não recalcula.
- [ ] RED: lote misto modos legacy/porcionado, até10, sem IDs duplicados/extras; versões/fingerprint stale, fonte/consentimento/carteira revogados; uma falha não deixa share/entrega parcial.
- [ ] RED: replay idêntico mantém UUID/ciphertext/entregas; mesma chave com porção diferente ou trocar modo recebe409; legado sem hash não aceita upgrade de modo; compare pedido original sem Date.now variável.
- [ ] RED Postgres com contenção controlada: editar/compartilhar, lotes recíprocos com fontes em ordem inversa, transferência do paciente e revogação; locks ordenados, autorização transacional e rollback. Inspecionar linhas e bytes cifrados após rejeição.
- [ ] GREEN serviço/snapshot/descartável/regressões310; commit. Não ampliar regra de acesso a pacientes.

### T05 — BFF e contratos tipados

Criar `octaclin-web/app/api/planos-alimentares/receitas/consulta/route.ts` e `[receitaId]/previa-porcionamento/route.ts`; modificar `lib/plano-alimentar-api.ts`, `scripts/test-planos-alimentares-bff.mjs` e `scripts/planos-alimentares-bff.spec.ts`; projetar respostas por allowlist backend.

- [ ] RED sem sessão/perm, body inválido/>8KiB para consulta/prévia, query arbitrária e metadata interna injetada; private/no-store. Receitas legacy GET/PUT/POST/DELETE continuam.
- [ ] GREEN cliente `consultarReceitasNutricionais`, `preverPorcionamentoReceita` e envio estendido; BFF/authz/typecheck; commit. O novo campo do share não carrega ciphertext ou capability clínica no navegador.

### T06 — biblioteca, prévia e portal

Modificar componentes `biblioteca-receitas-nutricionais.tsx`/`receitas-compartilhadas-portal.tsx`; extrair formulário metadata/painel porcionamento apenas para evitar acoplamento. Nova spec visual `octaclin-web/tests/visual/food07-metadados-receitas.spec.mjs` no config desktop/mobile real.

- [ ] RED duas bases, mudança confirmada sem conversão silenciosa, campos opcionais e limpeza; paginação101+, filtros/reset/estado vazio/erro/página após arquivar; seleção de compartilhamento preservada entre páginas com versões corretas.
- [ ] RED prévia fracionária com original/efetivo/avisos, confirmar/cancelar, duplo clique/retry, resposta antiga/trocar paciente/perder posse PA07. Confirmar aplicação obtém resultado atual e insere uma vez; persistência só via autosave/ACK existentes.
- [ ] RED lote: porções individuais por receita, prévia e confirmação explícita de envio, código indisponível explica bloqueio, acesso retirada/legado permanece; portal mostra “Quantidades para1,5porções” sem confundir rendimento original4, sem tags/hashes/contexto.
- [ ] RED teclado/foco/reflow/Axe desktop/mobile, macros por peso efetivo, nenhum tempo/texto escalado. GREEN visual/BFF/portal/regressões310/FOOD04/PA07; commit.

### T07 — gates, revisão independente e PR

- [ ] Regressões backend/Web, domínio/snapshots/publicação/portal, PostgreSQL/RLS/concorrência/rollback; Node22, typechecks/builds/lint aplicáveis.
- [ ] R4 independente da entrega completa, identificação/limitações e correções TDD dos achados; não confundir parecer próprio/estático com execução independente.
- [ ] Atualizar roadmap/checklist/handoff e abrir PR individual Draft FOOD07; diff/segredos/links e CI/scanners no HEAD. Sem merge, migration externa, deploy, infra, cobrança ou FOOD05-MDL. Revisar composição com446 separadamente sem alterar PR aprovada.

## Review Focus — entradas com cobertura obrigatória

1. Writer antigo/omissão ou mudança de base perde/interpreta errado metadata → T01/T02/T06.
2. Tags/contexto interno vazam por snapshot cru no portal → T04/T05/T06, asserção de HTTP e snapshot público, não só JSX.
3. Filtro só atua nos primeiros100 ou seleção muda ao paginar → T02/T06,101+receitas e estado assíncrono.
4. Divisão duplicada na base por_porção, arredondamento acumulado ou composição por100g escalada → T01/T03, oráculo independente e limites antes de confirmar.
5. Replay com porção nova, paciente transferido, snapshot recalculado ao disparar ou rollback para reader antigo → T04/T07, Postgres real e contrato operacional reader-first.

## Gates e comandos previstos (ainda NOT RUN)

- G00 análise documental: branch/base/paths/referências/decisões rastreados; Q1–Q3 e S1–S3 aprovadas; plano consolidado aguarda aceite de implementação.
- G01 domínio/DTO/service: `pnpm --dir octaclin-backend exec jest --runInBand metadados-receita porcionamento-receita dtos-receitas-metadados servico-receitas-nutricionais servico-porcionamento-receita snapshot-compartilhamento-receita servico-compartilhamento-receitas`; incluir novos testes de projeção/legacy.
- G02 banco: suite Testcontainers específica deve ser incluída em `pnpm test --runInBand` do CI Backend; flag única documentada e habilitada no workflow se necessário, provar asserções executadas (nenhum skipped como PASS). Sem conexão externa. Não reutilizar suite com apenas mocks como evidência RLS.
- G03 Web: `pnpm --dir octaclin-web test:planos-alimentares:bff`, `pnpm --dir octaclin-web test:authz`, lint/typecheck/build dos pacotes afetados; `pnpm --dir octaclin-web exec playwright test tests/visual/food07-metadados-receitas.spec.mjs` usando config/projetos reais (não presumir nome de projeto sem conferir). Regressão PA07 e Axe no mesmo config, Node22.
- G04 segurança: matriz authz/RLS/CAS, projeções, limites, revisão independente; CodeQL/Semgrep/Trivy/Dependency Review no HEAD.
- G05 CI/entrega técnica: todos os checks aplicáveis no commit exato, skips explicados; PR Draft e sem merge.
- G06 operação: BLOCKED/separado até autorização pós-retorno e regularização real. Não reivindicar prontidão produtiva por teste descartável ou data03/11.

## Evidências desta rodada

Executado somente leitura de main atualizada, arquivos/contratos/testes existentes e duas referências externas específicas; branch limpa criada de main. Nenhum teste de runtime, migration ou CI foi executado nesta etapa documental. A chamada `pnpm security:secrets` inicializou automaticamente o ambiente pnpm e reportou Already up to date; não houve mudança versionada de dependências/lockfiles. Não criar symlink de node_modules para outra worktree nem reinstalar sem necessidade. Espaço do executor observado97% usado é limitação para futura prova local; não apagar artefatos sem critério/autorização. Se execução local for inviável, gates oficiais de banco/Playwright no CI devem executar exatamente os cenários, sem declarar PASS de teste bloqueado.

Verificação documental executada: links locais dos quatro arquivos PASS; scanner de segredos local PASS; diff check PASS. O scanner executou em Node24.19.0/pnpm11.19.0 e emitiu aviso de engines; não constitui validação de runtime compatível. Nenhum teste de implementação executado ou declarado PASS.

## Histórico de decisão — respostas do proprietário

Q1 integral aprovado; Q3 tags internas e rendimento/tempo em novos envios aprovado. Q2 passou de proposta informativa para **ajuste de quantidades por rendimento**, incluído nesta fase de planejamento. Essa alteração não autoriza runtime automaticamente. S1–S3 foram respondidas posteriormente: duas bases, frações e envio porcionado aprovados; este plano substitui as alternativas anteriores. A versão anterior do plano está preservada no commit691b34d3.
