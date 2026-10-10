# Fase 309 — Preferências individuais e resumos de notificações

> Reconciliação em 2026-10-10: Fase 309 integrada pelo PR #386 (`34d186ec`),
> confirmada no GitHub neste ciclo. CI principal pós-merge `38000687212` aprovado;
> step PostgreSQL/Testcontainers da PR 310, que inclui a 309, aprovado.
> Aplicação operacional da 1065 não consultada. O conteúdo anterior abaixo
> registra o ciclo anterior ao merge; handoff corrente: `tasks/plan.md` (311).

## Estado e handoff

Planejamento e análise de gaps em 2026-10-09; implementação nesta branch.
Base: `1dec202f`, merge da
Fase 308/PR #385 confirmado no GitHub. Branch única:
`feature/fase-309-preferencias-notificacoes`; worktree:
`/workspace/octaclin/.worktrees/feature-fase-309-preferencias-notificacoes`.
Plano e implementação seguem na PR #386, aberta como draft e ainda não mergeada. Código funcional e
migration 1065 registrados; nenhum envio real, migration operacional ou ação
de produção executados. Handoff/evidências atuais: `tasks/plan.md` e
`tasks/todo.md`.

Planejamento: GPT-6.1 Sol médio. Implementação executada após a troca manual
para GPT-6 Luna alto. Se surgir incompatibilidade nos contratos, ou alteração
de autorização, crypto, transporte externo ou rollback que exceda este plano,
registrar o fato e solicitar retorno ao Sol; não resolver enfraquecendo controles.

## Decisões do proprietário

Confirmadas neste ciclo:

- `mensagem_recebida`, `solicitacao_agendamento` e `falha_envio` sempre imediatas.
- `formulario_respondido`, `tarefa_concluida`, `automacao_executada` configuráveis.
- Digest interno **e por e-mail**, com contagens, período e links genéricos,
  sem nome, identificador de paciente ou conteúdo clínico.
- Geração do resumo interno no próximo acesso ao console após o vencimento;
  diário às 09:00 e semanal segunda às 09:00 no fuso escolhido. Ausência longa
  gera um único resumo do período pendente, com datas reais.
- Configurações afetam eventos novos. Pendentes preservam a decisão original.
  Padrão imediato para todas as classes; resumo/silenciamento exigem opção.

- E-mail disponibilizado para envio junto da geração no próximo acesso;
  opt-in individual desligado por padrão. Não há geração de digest offline.
- Uma tentativa externa por resumo; entrega incerta não é reenviada. Mostrar
  “envio não confirmado”; resumo interno permanece disponível.
- Desligar e-mail cancela tudo ainda não iniciado, inclusive elegibilidade de
  eventos antigos sem resumo. Resumos internos e modos/fusos ficam intactos.

Todas as decisões de produto estão fechadas e implementadas. Nenhuma pergunta
de produto permanece pendente.

## Escopo e risco

R4: migration aditiva, isolamento tenant/usuário, e-mail cifrado do titular e
efeito externo. Alterações em notificações internas e página de preferências;
preservar destinatários atuais, permissões e canais externos dos pacientes.
Resumo não é diagnóstico nem alerta clínico. Links abrem módulos existentes,
onde as permissões continuam autoritativas. Nenhuma ampliação para Patient ou
Client; Collaborator continua recebendo somente os três tipos operacionais.

## Gaps verificados no código

| Fonte atual | Capacidade observada | Lacuna / ação mínima |
| --- | --- | --- |
| `modulos/notificacoes/dominio/tipo-notificacao.ts` | Seis tipos, não cinco da auditoria histórica | Política central de obrigatórios/opcionais e modos |
| `dominio/destinatarios-notificacao.ts` | SuperAdmin, responsável Professional e Collaborator operacional; Client/Patient excluídos | Preferência filtra entrega, nunca concede destinatário |
| `aplicacao/registrar-notificacao.ts` | Fan-out na mesma transação de origem; `orIgnore` | Buscar preferências em lote e congelar modo/fuso/vencimento/e-mail por evento |
| Migration 1020 e extensões 1039/1048 | RLS FORCE, unicidade tenant/usuário/tipo/recurso, índices de leitura | Migration 1065 para preferências, snapshots e resumos; preservar índice existente |
| `aplicacao/servico-notificacoes.ts` | Lista 20, até 50 via DTO; conta não lidas e decifra nomes na leitura | Contar só individuais imediatas e resumos; geração transacional sem decifrar pacientes |
| `apresentacao/controlador-notificacoes.ts` | JWT, três papéis e `console.acessar` | GET/PUT próprias preferências, POST geração e leitura de resumos |
| `components/app/sino-notificacoes.tsx` | Poll 5s e marcar todas, sem tela de preferências | Resumos acessíveis, link para preferências e geração independente do poll imediato |
| `app/api/notificacoes/route.ts`, `lidas/route.ts` | Wrappers BFF e permissão; sem cabeçalho explícito de cache | No-store em sucesso/erro, novos BFFs e harness dedicado |
| `lib/server/autorizacao-rotas.ts` | Toda `/conta` liberada para qualquer autenticado | Nova página precisa verificar papel e permissão no servidor; não depender do middleware |
| `comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp.ts` | SMTP/Gmail e controles de rede; configuração por ambiente | Reutilizar transporte para destinatário usuário, sem acoplar ao fluxo paciente |
| `auth/aplicacao/servico-recuperacao-senha.ts` | Exemplo de envio sistêmico com adapter e template controlado | Referência para montar contexto sem criar canal/template editável pelo tenant |
| `usuarios/infraestrutura/usuario.orm.ts` | E-mail cifrado, ativo, papel e tenant; sem preferência | Identidade pelo JWT; destinatário resolvido novamente no servidor |
| `infraestrutura/processamento/papel-processo.ts`, `rodada-por-tenant.ts` | Gate web/worker e isolamento de rodadas | Usar gate existente para processar e-mail pendente; geração interna permanece por acesso |
| `rls-isolamento-tenant.integracao.spec.ts` e CI | Prova real PostgreSQL com runtime sem BYPASSRLS | Incluir tabelas/constraints novas e concorrência real, além de mocks |

Paths de domínio/aplicação/apresentação sem prefixo de módulo são relativos
a `octaclin-backend/src/modulos/notificacoes/`; os demais paths backend partem
de `octaclin-backend/src/`. Paths Web partem de `octaclin-web/`. Auditoria de produto: `docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`
seções 2/10; roadmap vigente 309. Não reabrir fases já integradas.

## Contrato de produto

Página `/conta/notificacoes`, acessível pelo sino. Apenas SuperAdmin,
Professional, Collaborator com `console.acessar`. Mostra obrigatórios fixos,
classes elegíveis, fuso IANA e checkbox de e-mail desligado inicialmente.
Collaborator vê explicação de que seus tipos atuais são obrigatórios; não pode
configurar classes que não recebe. Opções por classe: `imediato`, `diario`,
`semanal`, `silenciado`. Mostrar explicitamente horário de geração e que o
resumo fica disponível no próximo acesso; não prometer entrega offline.

Sem preferências persistidas: todas imediatas, fuso `America/Sao_Paulo`,
e-mail false. O fuso inicial é estável, não inferido do navegador. Aceitar
somente fusos válidos por `Intl.DateTimeFormat`, máximo 80 caracteres, e
calcular vencimento usando `cron-parser` já instalado. Próximo vencimento é
estritamente posterior ao instante do evento: um evento exatamente às 09:00
entra no próximo período. Cobrir DST, virada de ano e segunda-feira.

Silenciado: evento permanece registrado para deduplicação, fora do sino,
contador e digest. Não elimina o fato de origem; ele permanece no módulo.
Resumo não marca individuais como lidas; as individuais em modo digest não
aparecem no sino. Ler um resumo marca apenas esse resumo. Falha de e-mail
não apaga resumo nem muda contagens do sino.

Configuração concorrente: o snapshot usado é o lido na transação que registra
o evento. Uma troca de preferência não reclassifica snapshots existentes.
Reentrega do mesmo evento preserva a linha original pelo índice único.

## Persistência implementada — migration 1065

Reconfirmar que 1065 está livre antes de escrever; nunca renumerar migration
já integrada. Uma migration aditiva, com comentário `@aplicacao fora-de-banda`,
registrada em `opcoes-typeorm.ts`, junto das entidades:

1. `preferencias_notificacao_usuario`: tenant_id, usuario_id (único composto),
   três colunas de modo opcionais, timezone, email_resumo boolean default false,
   criado_em/atualizado_em. CHECK de modos. FK de usuário que prove mesmo
   tenant, usando constraint composta em usuarios quando necessário.
2. `resumos_notificacao_usuario`: id, tenant_id, usuario_id, periodo_inicio_em,
   periodo_fim_em (instantes reais dos eventos incluídos), gerado_em, lido_em,
   contagens JSONB de allowlist, contagens_email JSONB separadas, estado_email,
   tentativa_email_em, finalizado_email_em. Não persistir destinatário, texto,
   erro bruto, payload clínico ou resposta do provider. Estados de envio:
   `nao_solicitado`, `pendente`, `reservado`, `enviado`, `incerto`, `falhou`,
   `cancelado`. CHECK de estados, limites não negativos e tipos opcionais.
3. `notificacoes`: modo_entrega default `imediato` NOT NULL, timezone_resumo
   nullable, resumo_previsto_em nullable, email_resumo default false,
   resumo_id nullable. CHECK coerente (datas/fuso apenas diário/semanal,
   obrigatórios sempre imediatos; vínculo resumo somente modo digest).
   FK composta resumo/tenant/usuário para impedir vínculo cruzado;
   ON DELETE RESTRICT preserva vínculo e deduplicação.
   Nenhum backfill de digest: linhas antigas ficam imediatas.

A chave `(tenant_id,id)` de usuários já existe pelo índice
`ux_usuarios_tenant_id_id` da migration 1021. Reutilizá-la; não criar índice
redundante nem removê-la no down da 1065. Criar UNIQUE `(tenant_id,usuario_id,id)`
na tabela de resumos para suportar a FK composta de notificações. Testar essa
FK negativa explicitamente. Preservar todas as constraints existentes.

Novas tabelas: ENABLE + FORCE RLS com USING/WITH CHECK tenant de `app.tenant_id`,
seguindo migration 1020. RLS é por tenant; filtro por usuário é obrigatório em
toda operação da aplicação. Configurar remoção em cascade de preferências
quando o usuário for eliminado; remover resumos/vínculos na ordem correta em
procedimentos de exclusão existentes, sem apagar dados clínicos por cascata.
Não criar nova política legal de retenção; mapear o procedimento administrativo
atual e registrar qualquer lacuna encontrada antes do rollout.
Índices para pendentes `(tenant_id,usuario_id,resumo_previsto_em)` WHERE resumo_id IS NULL AND modo digest; resumo por
tenant/usuário/data e e-mail pendente. Evitar índices redundantes existentes.
Constraints e JSONB devem concordar com DTO/política; testar dados inválidos.

Nenhuma credencial nova nem atualização de lockfile/dependência prevista.
Rollback: reverter código preservando schema aditivo. Não rodar down em
produção; remover tabelas/colunas perde snapshots, preferências e resumos.
O código antigo ignora os modos e volta a listar notificações individuais:
registrar essa limitação (possível reaparição) no runbook. Down somente em
banco descartável, na ordem FK/colunas/tabelas.

## Algoritmos que o Luna deve implementar

### Escrita de evento

Preservar `registrarNotificacao(gerenciador,tenantId,evento)` e sua transação.
Resolver destinatários pela função existente. Consultar preferências em uma
busca com tenant e IDs elegíveis; sem N+1, sem decifrar nomes/e-mails. Política
obrigatória prevalece até sobre dado legado inválido. Congelar modo e, para
digest, fuso/vencimento/e-mail. Insert `orIgnore` continua sendo a deduplicação.
Falha de banco propaga e reverte fato de origem; não esconder erro como sucesso.

### Geração de resumo

Endpoint **POST** dedicado, não gerar em GET/prefetch. Recebe corpo vazio,
identidade JWT e relógio do servidor; sem usuário, tenant, horário ou intervalo
fornecidos pelo cliente. Disparar na montagem do sino e no máximo uma vez por
minuto enquanto console ativo, separado do poll de imediatas a cada 5s.

Dentro de `ExecutorTenant`, travar a linha do usuário com `pessimistic_write`,
filtrando tenant e ID; verificar ativo/papel. Serializar gerações do mesmo
usuário, inclusive duas abas/instâncias. Fixar `agora` depois de obter trava.
Selecionar apenas notificações desse usuário em modo diário/semanal, sem
resumo_id e com vencimento <= agora. Se vazias, retornar `{ gerado: false }`.
Criar um resumo e vincular **exatamente** essas linhas na mesma transação;
agregar contagens no banco por tipo e contagens_email só de snapshots opt-in.
Usar CTE UPDATE RETURNING/agregação ou operação equivalente sem carregar
histórico/pacientes em memória. SQL parametrizado, índices apropriados, timeout
transacional documentado (5s); timeout reverte tudo e próximo acesso retoma.

Um resumo reúne todos os vencidos, inclusive vários dias ou fusos históricos;
o período mostra min/max dos instantes de eventos, não finge uma janela civil
uniforme. Vencimentos futuros ficam pendentes. Falha após insert antes de
vincular reverte tudo. Novo evento concorrente entra nesse resumo apenas se
visível à seleção; caso contrário entra no próximo, uma única vez.

### Leitura e marcação

GET central preserva `itens` para individuais imediatas e acrescenta `resumos`
(até 10 recentes). `naoLidas` soma individuais imediatas não lidas + resumos
não lidos; cada resumo conta uma vez, não uma vez por evento.
DTO resumo: id, período, geradoEm, lidoEm, contagens por tipo e estadoEmail
genérico. Sem destinatário, pacienteId, recursoId, nome, ORM cru ou erro bruto.
Links de destino derivados por tipo na Web e filtrados pelas permissões atuais.
As individuais imediatas preservam seu contrato existente.

POST lidas mantém ids opcionais e acrescenta idsResumos (UUID, até 50 cada).
Ausência dos dois marca todas as imediatas e resumos já gerados. Se qualquer
lista fornecida, marcar somente IDs explícitos; lista vazia não vira marcar
tudo. Tenant/usuário/lidoEm null sempre no UPDATE. Nunca marcar pendentes ou
silenciadas como efeito de “marcar todas”.

### E-mail — contrato fechado

Destinatário exclusivamente do usuário vinculado ao resumo, ativo e com papel
de console; resolver e-mail cifrado na tentativa. Não aceitar endereço, URL,
canal, remetente ou template na requisição de preferências/geração.
Texto controlado: período + contagens_email + link HTTPS para login/console
obtido da configuração Web existente; sem token, UUID ou informação clínica
na URL. Nome da clínica e nomes de pacientes não entram no corpo/assunto.
Sem evento opt-in no agregado: estado não solicitado, nenhuma tentativa.

Reutilizar `AdaptadorEmailSmtp` e sua configuração sistêmica, como recuperação
de senha; registrar a classe existente como provider em `ModuloNotificacoes`,
como já fazem auth/comunicações, sem alterar auth nem duplicar transporte. Não usar
`MensagemNotificacaoOrm`/outbox paciente, que exigem canal/template e semântica
de paciente. Não alterar transporte, políticas SSRF ou preferências paciente.
Persistir intenção no resumo na mesma transação da geração; processador do
módulo notificações consome estado durável respeitando papel worker/all,
`executarPorTenantAtivo`, limite 50 resumos por rodada e timeout do transporte.
Rede fora de transação; reivindicação durável antes do efeito externo.
Máquina de estados e cancelamento:

1. Na geração, e-mail só vira `pendente` se houver contagens_email > 0 e a
   preferência atual ainda estiver ligada. Sem snapshot opt-in fica
   `nao_solicitado`; opção desligada com snapshot antigo fica `cancelado`.
   A geração nunca chama rede; o worker faz o envio após commit.
2. PUT de preferências trava o usuário, na mesma ordem usada por geração e
   claim. Ao desligar, atualizar eventos digest ainda sem resumo para
   email_resumo=false e mudar resumos `pendente` para `cancelado`, na mesma
   transação. Essa revogação é a exceção aprovada à imutabilidade do snapshot;
   não altera modo/fuso nem notificação interna. Reativar não ressuscita nada
   cancelado; somente eventos novos tornam-se elegíveis.
3. Worker faz preparação sem efeito externo: usuário ativo, papel/permissão
   atuais, opt-in vigente, e-mail decifrável e origem Web válida. Falha certa
   de preparação fica `falhou`, mensagem genérica, sem chamada ao adapter.
   Opt-out/desativação/perda de papel antes do claim fica `cancelado`.
4. Claim transacional: travar usuário primeiro, verificar elegibilidade de novo,
   depois resumo tenant/usuário/id e `estado_email=pendente`; atualizar para
   `reservado` + tentativa_email_em e COMMIT. Destinatário só em memória.
   Concorrência/duas instâncias podem produzir no máximo uma chamada ao adapter.
5. Fora de transação, chamar adapter uma vez. Sucesso confirmado vira
   `enviado`; erro após começar chamada vira `incerto`, independentemente do
   texto do erro. Não deduzir “não enviado” de timeout/HTTP/erro do transporte.
   Finalização condicional ao mesmo claim e estado reservado.
6. Reserva antiga (>10 minutos) sem conclusão vira `incerto`, nunca volta a
   pendente. Se o processo morrer antes de chamar rede, pode perder o e-mail:
   é a limitação explícita escolhida para impedir duplicatas. Não oferecer
   botão de reenviar nem retry automático de reservado/incerto/falhou.
7. Desligar opção após claim não promete cancelar envio já iniciado.
   `enviado` significa aceite confirmado pelo transporte, não leitura nem
   chegada na caixa de entrada. UI rotula `incerto` como “envio não confirmado”.

Testar desativar antes de geração, após geração/antes de claim, após claim;
reativar sem ressuscitar; queda após commit do claim; sucesso externo seguido
por falha de persistência; duas instâncias, reserva vencida e isolamento por
usuário/tenant. Erros do provider nunca vão para banco, resposta ou log.

E-mail real, habilitação de provider ou envio para pessoas dependem de ambiente
e autorização próprios; testes usam adaptador fake e destinatários sintéticos.

## API e BFF

- `GET /notificacoes/preferencias`: modos, timezone, emailResumo, classesElegiveis,
  obrigatórias (derivadas da política), nunca entidade de usuário.
- `PUT /notificacoes/preferencias`: substituição completa validada de
  `{ modos: { formulario_respondido, tarefa_concluida, automacao_executada },
  timezone, emailResumo }`; rejeitar chaves desconhecidas e tentativa de mudar
  obrigatórias. Collaborator só pode persistir modos padrão das inelegíveis.
- `POST /notificacoes/resumos/gerar`: `{ gerado: boolean }`; corpo vazio.
- `GET /notificacoes`: contrato estendido descrito acima.
- `POST /notificacoes/lidas`: marcação descrita acima.

Backend: guardas atuais e `console.acessar`, papel/usuário revalidados no serviço.
BFF: wrappers `exigirPermissaoBff` e `requisitarBackendAutenticado`, mesmo escopo;
`Cache-Control: private, no-store` em respostas de sucesso/erro. Usar helpers de
erro existentes; nunca ecoar stack/provider/dado de entrada. Confirmar proteção
de origem/CSRF existente (`middleware.ts`, `origemMutacaoPermitida` em
`lib/server/seguranca-bff.ts`) em métodos mutáveis e adicionar teste negativo.
Página `/conta/notificacoes` verifica papel/permissão explicitamente no servidor;
middleware libera `/conta` genericamente e não é autorização suficiente.

## UI e integração de fixtures

Novo componente de preferências com carregamento, vazio/padrões, erro + retry,
salvar pendente/sucesso/falha, campos rotulados e obrigatórios explicados.
Separar ação de salvar de geração/envio; navegação não manda PUT.
Resumo no sino com datas, contagens e links de módulo; não colocar vários links
dentro de um Link. Revisar semântica Menu/role/foco ao expandir conteúdo; botão
marcar lido acessível. Exibir falha de geração com retry sem esconder imediatas.
Preservar última resposta boa do poll; leitura não aguarda e-mail.

Atualizar `octaclin-backend/scripts/api-demo-local.mjs` para os endpoints,
estado de preferência e geração idempotente sintéticos. Atualizar fixtures
existentes que interceptam `**/api/notificacoes**` para distinguir paths/métodos;
compatibilidade na Web com `resumos` ausente durante rollout/fixtures antigas.
Não registrar erro bruto nem usar localStorage/Cache Storage para estado.

## Mapa de arquivos para implementação

No backend, dentro de `src/modulos/notificacoes/`, usar esta divisão:

- Novos `dominio/politica-notificacoes.ts` e `calendario-resumo.ts`, com testes;
  manter `tipo-notificacao.ts` e `destinatarios-notificacao.ts` como contratos.
- Novos `infraestrutura/preferencia-notificacao-usuario.orm.ts` e
  `resumo-notificacao-usuario.orm.ts`; ampliar `notificacao.orm.ts`.
- Novos `aplicacao/servico-preferencias-notificacoes.ts`,
  `servico-resumos-notificacoes.ts` e `processador-email-resumos.ts`, com testes;
  ampliar `dtos.ts`, writer, serviço de leitura e controlador existentes.
- Registrar no `modulo-notificacoes.ts`, em `opcoes-typeorm.ts` e na migration
  `1720000001065-ConfigurarResumosNotificacoes.ts`, com spec. Nomes podem mudar
  por convenção local sem mudar a divisão/contrato.

Na Web, criar página `app/conta/notificacoes/page.tsx` e componente
`components/conta/preferencias-notificacoes.tsx`; ampliar API/sino existentes.
BFFs novos: `app/api/notificacoes/preferencias/route.ts` (GET/PUT) e
`app/api/notificacoes/resumos/gerar/route.ts` (POST). Harness dedicado:
`scripts/notificacoes-bff.spec.ts`, runner `test-notificacoes-bff.mjs`, script
`test:notificacoes:bff` em package.json e integração a `test:authz`.
Playwright: `tests/visual/fase-309-notificacoes.spec.mjs`, incluindo axe;
reutilizar fixtures de sessão e projetos desktop/mobile existentes.
Ajustar demo mock e interceptações globais; não copiar credenciais/fixture real.

Não usar novas dependências. Helpers puros primeiro; entidades e SQL depois;
serviços transacionais antes de UI. Controles de rede vêm do adapter existente.

## Sequência e checkpoints

1. Reconfirmar Git/base/instruções e decisões fechadas; começar pelos
   testes de política pura, fuso, vencimento e snapshots. Implementar helpers.
2. Testar migration, registro e entidades. Criar 1065 aditiva, constraints e
   RLS; ampliar integração PostgreSQL. Checkpoint: nenhuma persistência de PII.
3. Testar e implementar preferências + writer em lote, preservando todos os
   destinatários/callers e rollback da transação de origem.
4. Testar geração concorrente, agregação, leitura e marcação. Checkpoint:
   cenário de dois POSTs produz um resumo e nenhuma contagem duplicada.
5. Testar e implementar e-mail pelo contrato fechado, transporte fake e limites.
   Checkpoint: opt-in, usuário ativo, claim durável e falha sem falso enviado.
6. BFFs, página protegida, tipos/API/sino, demo mock e harness; testes negativos.
7. Desktop/mobile/axe, checks aplicáveis, diff e scanner. Atualizar evidências
   neste plano e estado/checklist/roadmap. Uma PR contendo planejamento e código.
8. Solicitar revisão R4 independente; aplicação da migration 1065 somente pelo
   procedimento fora de banda com ambiente/banco/branch/role confirmados.

## Matriz mínima de testes e gates

| Propriedade | Prova exigida |
| --- | --- |
| Obrigatórios/padrões | Seis tipos, obrigatórios imutáveis mesmo com dados inconsistentes; antigo imediato |
| Destinatários | SuperAdmin, responsável, Collaborator; negativos Patient/Client, outro profissional, tenant e usuário |
| Preferências | GET padrão, PUT válido, enum/fuso/chave/tipo inválidos; tentativa de IDs externos e classes inelegíveis |
| Temporal | Antes/exato/depois 09:00, segunda, DST em fuso válido, intervalo semanal, virada anual |
| Snapshot | Mudar preferência não altera evento anterior; reentrega preserva snapshot; consulta em lote |
| Digest | Sem evento/antes prazo, tipos silenciados fora; agregação dias offline, futuro separado, min/max corretos |
| Concorrência/rollback | Duas conexões PostgreSQL mesmo usuário, gera uma vez; rollback não consome; outro usuário independente |
| Banco | FORCE RLS sem BYPASSRLS, USING/WITH CHECK, FK tenant/usuário cruzada negada, CHECKs e índice dedup preservado |
| Leitura | Contador misto, limite 10 resumos, ordenação determinística, DTO sem PII/IDs clínicos |
| Marcação | Um/todos, listas vazias explícitas, IDs cruzados, pendentes/silenciadas intactos |
| E-mail | Uma tentativa externa, claim durável, incerto sem retry, cancelamento e reativação sem ressurreição; destino do titular, provider falso |
| BFF/UI | 401/403/CSRF, no-store, defaults, guardar/retry, obrigatório fixo, digest, desktop/mobile/axe |
| Demo/CI | Mock novos endpoints e smoke; Governança; migration fora de banda; PR Gate |

Após implementação: Jest focado `src/modulos/notificacoes` + migration 1065;
backend typecheck/build e Jest integral (writer toca domínios transversais);
PostgreSQL descartável via `pnpm --dir octaclin-backend test:rls:testcontainers`
ou gate real identificado da CI. Mocks não comprovam RLS/concorrência.
Web lint/typecheck/build; harness novo `test:notificacoes:bff` integrado a
`test:authz`; Playwright focado da fase em desktop/mobile + axe.
`pnpm test:migracoes-fora-de-banda`, `pnpm test:guardas-controladores`,
`pnpm test:tooling-agentes`, `git diff --check`, `pnpm security:secrets`.
Revisar scripts/governança que enumeram superfícies ao criar rotas e tabelas.
Registrar PASS/FAIL/NA/SKIPPED com motivo; não interromper checks e marcá-los PASS.

## Fontes e limites de verificação

Lockfiles observados: Next 16.3.8, React 19.3.0, TypeORM 1.1.1 e cron-parser
5.10.1. Nenhuma atualização de versão proposta.

- Guia oficial Next instalado na worktree 308:
  `octaclin-web/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  (lido no planejamento): métodos mutáveis separados de GET, Route Handlers em app.
- https://raw.githubusercontent.com/harrisiirak/cron-parser/v5.10.1/README.md
  (consultado): `currentDate`, `tz` e DST; usar dependência existente.
- TypeORM: `ExecutorTenant` usa `DataSource.transaction` com o mesmo
  EntityManager; lock pessimistico está exercitado no teste Postgres abaixo se
  o Testcontainers concluir. Não declarar prova real se o container não iniciar.

## Estado de implementação e evidências

Implementação registrada nesta branch; PR #386 aberta em draft. A migration 1065 é
aditiva e o rollback preserva os dados por recusa explícita. Nenhuma aplicação
operacional da migration ou envio real foi feito.

- PASS: Node 22.23.3/pnpm 11.25.0; backend typecheck/build; Jest integral: 267 suítes/2.416 testes passaram (3 suítes/40 testes ignorados);
  Playwright 6/6 desktop/mobile + axe; Web/backend checks e harnesses conforme
  `tasks/plan.md`; scanner de secrets, migration governance, guardas, tooling e matriz.
- PASS: pós-merge 308 `37987983251`, Semgrep `37987983322`, Trivy `37987983323`
  e CodeQL `37987983326` concluídos com sucesso sobre `1dec202f`.
- PASS: Web lint/typecheck/build; lint sem erros, com 63 avisos preexistentes.
- PASS: `test:authz` integral, incluindo o harness BFF da Fase 309.
- FAIL (ambiente): PostgreSQL Testcontainers excedeu 180s no `beforeAll` sem
  iniciar container. Migration, FORCE RLS e concorrência continuam sem prova real;
  testes marcados `skip` não são evidência.
- SKIPPED/NA: provider, staging/produção, envio real e migration fora de banda;
  nenhum alvo operacional foi consultado. Monitor produção `37977323201` segue
  com FAIL de saúde externa sem causa diagnosticada ou vínculo demonstrado.
