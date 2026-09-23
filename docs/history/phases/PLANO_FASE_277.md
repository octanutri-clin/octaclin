# Fase 277 — Recorrência e duplicação de consulta (PB-19)

## 1. Objetivo

Terceiro item da Onda 4 do audit de produto (estrutura). Fecha o gap descrito em
`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, quick-win 13 e seção 5.6: criar uma consulta hoje
exige preencher os 16 campos do formulário a cada ocorrência; não existe recorrência ("toda quarta
às 9h por 8 semanas") nem duplicação ("repetir este agendamento" com um clique).

## 2. Risco (R2/R3 — uma tabela nova + uma coluna nova, sem dado clínico)

Migration aditiva com uma tabela nova (`agenda_recorrencias`) e uma coluna nova opcional em
`agenda_consultas` (`recorrencia_id`). Nenhuma tabela existente perde coluna ou muda tipo. Nenhum
dado clínico envolvido — só metadado operacional da própria agenda (mesma classificação de
`agenda_bloqueios_manuais`/`expedientes_profissionais`). RLS habilitada e forçada na tabela nova,
mesmo padrão de `1720000001006-CriarBloqueiosManuaisAgenda` e `1720000001052-CriarExpedientesETiposAtendimento`.

Rollback: `drop table ... cascade` na tabela nova e `drop column` na coluna nova de
`agenda_consultas` (down da migration). Sem backfill: tabela nova nasce vazia, coluna nova nasce
nula.

## 3. Escopo confirmado pelo proprietário (2026-09-23)

Quatro decisões tomadas via pergunta direta ao proprietário, registradas aqui para não depender de
memória de conversa:

1. **Escopo de recorrência: semanal OU diária, com término por contagem de ocorrências OU por
   data-fim** (opção mais ampla, não a recomendada por mim — eu havia sugerido só semanal por
   contagem, no molde exato do exemplo do audit). O desenho da seção 4 cobre as duas frequências e
   os dois critérios de término.
2. **Conflito parcial é best-effort**: a série cria as ocorrências sem conflito e reporta as
   puladas com o motivo, em vez de rejeitar a série inteira por causa de uma colisão pontual.
3. **Duplicação avulsa entra nesta fase** (opção não recomendada por mim, que sugeria deixar de
   fora) — um botão "Duplicar consulta" que repete a última consulta uma única vez, sem virar
   série, pedindo só a nova data/hora.
4. **Ocorrências da série não respeitam expediente** (recomendado por mim): mesmo comportamento da
   criação manual hoje, que já pode agendar fora do expediente do profissional (PB-18 restringiu
   isso só ao agendamento público). A série é só automação em lote da mesma ação manual — não
   introduz uma regra nova de validação.

## 4. Desenho técnico (lido no código antes de codar)

### 4.1 Fluxo de criação de consulta atual (ponto de reuso)

`ServicoAgenda.criarConsulta` (`servico-agenda.ts:291-332`) é o único ponto de entrada que grava
uma `agenda_consultas`, cria o evento no Google Calendar e dispara notificações/webhook — tudo
dentro de uma única chamada pública. Internamente delega a escrita no banco para
`criarRegistroInterno` (`servico-agenda.ts:740-834`), que resolve paciente/profissional, valida
conflito (`validarConflitoHorario`, `servico-agenda.ts:941-980`, contra `agenda_consultas` +
`AgendaBloqueioExternoOrm` + `AgendaBloqueioManualOrm`) sob um advisory lock
(`bloquearAgendaProfissional`, `servico-agenda.ts:1006-1015`) e grava protegido pela constraint de
exclusão do Postgres `ex_agenda_consultas_profissional_horario_ativo`
(`salvarConsultaProtegidaContraSobreposicao`, captura o erro `23P01`).

**Decisão de desenho**: a série recorrente e a duplicação avulsa reutilizam `criarConsulta`
integralmente, chamando-o uma vez por ocorrência em vez de duplicar a lógica de
validação/persistência/integrações. Isso preserva de graça todas as garantias existentes (lock,
constraint de exclusão, evento no Google, notificação, webhook `consulta.criada`) sem reescrever
nada — o único código novo é o que gera a lista de datas de ocorrência e o laço que itera sobre
`criarConsulta`, capturando conflito por ocorrência (best-effort) sem interromper a série.

Isso também resolve a decisão 4 automaticamente: `criarConsulta`/`criarRegistroInterno` nunca
consultou `expedientes_profissionais` (só `ServicoAgendamentoPublico` consulta), então reutilizá-lo
sem alteração já garante que a série não valida expediente — sem precisar de nenhum código
condicional para desligar essa checagem.

### 4.2 Tabela nova: `agenda_recorrencias`

Agrupador leve, no molde de `pacotes_sessao` (`pacote-sessao.orm.ts`, já documentado como
"agrupador **opcional** de consultas"), mas guardando a *regra* da série em vez de dinheiro:

- `id` uuid pk.
- `tenant_id` uuid.
- `paciente_id` uuid — dono da série, para listagem/exibição.
- `profissional_id` uuid nullable — mesma nulidade de `agenda_consultas.profissional_id`.
- `frequencia` varchar(10), `check (frequencia in ('diaria', 'semanal'))`. O dia da semana da
  recorrência semanal **não é armazenado**: é sempre o dia da semana da primeira ocorrência
  (`inicio_primeira_ocorrencia`), evitando um campo redundante que poderia divergir dele.
- `inicio_primeira_ocorrencia` timestamptz — igual ao `inicioEm` da primeira consulta da série.
- `duracao_minutos` int — mesma duração aplicada a todas as ocorrências.
- `criterio_termino` varchar(10), `check (criterio_termino in ('contagem', 'data'))`.
- `total_ocorrencias` int nullable.
- `termina_em` timestamptz nullable.
- `check` cruzado garantindo exatamente um critério preenchido:
  `check ((criterio_termino = 'contagem' and total_ocorrencias is not null and termina_em is null)
  or (criterio_termino = 'data' and termina_em is not null and total_ocorrencias is null))`.
- `criado_em`, `atualizado_em`.
- RLS habilitada e forçada, política `isolamento_tenant_agenda_recorrencias` com
  `current_setting('app.tenant_id', true)`, índice `(tenant_id, paciente_id)`.

`agenda_consultas` ganha `recorrencia_id` uuid nullable, `references agenda_recorrencias(id)`, sem
FK composta por tenant (mesmo padrão do `consulta_id` do PB-24 e do `pacote_id` já existente —
validação de "mesmo tenant" fica na aplicação), com índice parcial
`(tenant_id, recorrencia_id) where recorrencia_id is not null`. Nenhum número de ocorrência é
armazenado por linha: a fase não entrega gestão de série (cancelar a partir da N-ésima, etc.), só
criação, então a posição de cada consulta na série não é um dado que qualquer tela precisa ler
depois de criada — se uma fase futura precisar, dá para derivar ordenando por `inicio_em`.

### 4.3 Geração das datas de ocorrência

Função pura nova (sem I/O), a partir de `inicioEm` (primeira ocorrência), `frequencia` e o critério
de término:

- `semanal`: soma 7 dias a cada passo, mesmo horário do dia.
- `diaria`: soma 1 dia a cada passo, mesmo horário do dia.
- Para de gerar quando atinge `totalOcorrencias` (critério por contagem) ou quando a próxima data
  ultrapassaria `terminaEm` (critério por data) — **e sempre** para num teto de segurança de
  **52 ocorrências**, independente do critério escolhido, para impedir uma série de anos gerada por
  engano (ex.: recorrência diária com `terminaEm` muito distante). O teto é validado no DTO
  (`totalOcorrencias` limitado a 2–52) e reforçado de novo no serviço como segunda linha de defesa.

### 4.4 Serviço novo: `ServicoAgenda.criarConsultasRecorrentes`

1. Valida que exatamente um critério de término foi enviado (o DTO já garante isso via validador
   customizado, ver 4.6).
2. Gera a lista de datas de ocorrência (4.3).
3. Cria a linha de `agenda_recorrencias` numa transação curta e isolada.
4. Itera as datas **sequencialmente** (não em paralelo — preserva a semântica do advisory lock por
   profissional e evita duas ocorrências da mesma série competindo pelo mesmo lock ao mesmo tempo),
   chamando `criarConsulta(tenantId, { ...dadosBase, inicioEm: dataDaOcorrencia, recorrenciaId },
   usuario)` para cada uma:
   - `BadRequestException` (conflito de horário, vindo de `validarConflitoHorario` ou da
     constraint de exclusão) é capturada e registrada como ocorrência pulada, com o motivo; a série
     continua para a próxima data.
   - Qualquer outro erro (paciente/profissional não encontrado, dado inválido) é um erro de entrada
     genuíno, não um conflito pontual — propaga e aborta a série inteira, sem criar nada.
5. Se nenhuma ocorrência foi criada, apaga a linha de `agenda_recorrencias` (nenhuma série órfã sem
   consulta nenhuma) e lança `BadRequestException` explicando que todos os horários estavam
   indisponíveis.
6. Retorna `{ recorrenciaId, criadas: ConsultaAgendaRespostaDto[], puladas: Array<{ inicioEm:
   string; motivo: string }> }`.

`criarConsulta`/`criarRegistroInterno` ganham um parâmetro opcional `recorrenciaId` (undefined em
todo o resto do fluxo existente, sem mudança de comportamento) só para gravar a coluna nova na
criação — evita um segundo `UPDATE` por ocorrência.

### 4.5 Serviço novo: `ServicoAgenda.duplicarConsulta`

1. Carrega a consulta de origem (`tenantId` + `consultaId`; 404, não 403, se não existir ou for de
   outro tenant — mesmo padrão de recurso fora de escopo usado em todo o domínio).
2. Monta um `CriarConsultaAgendaDto` copiando `pacienteId`, `profissionalId`, `duracaoMinutos`
   (derivado de `fimEm - inicioEm` da origem), `modalidade`, `linkTeleconsulta`, `local`,
   `observacoes`, `emailContato`, `whatsappContato`, `valorCentavos`, `formaPagamento`, `pacoteId`;
   com `inicioEm` vindo do corpo da requisição (nova data/hora) e `enviarNotificacoes: true` fixo
   (duplicar é sempre uma ação explícita da equipe, notificação faz sentido por padrão). Não copia
   `referenciaExterna` (chave de idempotência de sistema externo — duplicar não pode colidir com a
   origem nem herdar identidade de outro sistema).
3. Chama `criarConsulta` com esse payload — reaproveita 100% da validação/integração existente.

### 4.6 DTOs novos

```ts
export class CriarConsultaRecorrenteDto extends CriarConsultaAgendaDto {
  @IsIn(['diaria', 'semanal'])
  frequencia: 'diaria' | 'semanal';

  @IsOptional() @IsInt() @Min(2) @Max(52)
  totalOcorrencias?: number;

  @IsOptional() @IsDateString()
  terminaEm?: string;

  // validador de classe: exatamente um entre totalOcorrencias/terminaEm precisa estar presente
}

export class DuplicarConsultaAgendaDto {
  @IsDateString()
  inicioEm: string;
}
```

### 4.7 Endpoints novos (autenticados, sob `/agenda`, mesmo guard stack de `ControladorAgenda`)

- `POST /agenda/consultas/recorrentes` — `agenda.consultas.criar`. Corpo:
  `CriarConsultaRecorrenteDto`. Resposta: `{ recorrenciaId, criadas, puladas }`.
- `POST /agenda/consultas/:consultaId/duplicar` — `agenda.consultas.criar`. Corpo:
  `DuplicarConsultaAgendaDto`. Resposta: `ConsultaAgendaRespostaDto` (mesmo formato de
  `criarConsulta`).

### 4.8 Frontend (`painel-agenda.tsx`)

- Modal "Nova consulta": logo após a linha Data e hora/Duração, um checkbox "Repetir esta
  consulta"; marcado, revela: select de Frequência (Semanal/Diária) e um par de campos
  mutuamente exclusivos — "Número de ocorrências" (`number`, 2–52) ou "Até uma data" (`date`),
  com um seletor simples decidindo qual dos dois está ativo (mesmo padrão de campo condicional já
  usado no restante do formulário, ex. Local vs. Link da sala conforme `modalidade`). No submit,
  quando marcado, chama o novo `criarSerieRecorrenteAgenda(...)` em vez de `criarConsultaAgenda`, e
  o resultado popula `consultas` com todas as `criadas` de uma vez; a mensagem de sucesso relata
  quantas foram criadas e, se houver puladas, quantas e por quê (resumido, sem listar cada motivo
  técnico).
- Painel de consulta selecionada (onde já existem os botões Concluída/Falta/Cancelar/Remarcar): um
  botão "Duplicar" que abre um `Modal` simples pedindo só a nova data/hora e chama
  `duplicarConsultaAgenda(consultaId, novoInicioEm)`.

## 5. Fora de escopo (gaps que continuam)

- Gestão da série depois de criada (ver todas as ocorrências de uma `recorrencia_id`, cancelar a
  partir de uma ocorrência específica, editar a série inteira de uma vez) — esta fase só cria; a
  coluna `recorrencia_id` em `agenda_consultas` deixa a informação disponível para uma fase futura
  sem precisar de nova migration.
- Validação de expediente nas ocorrências da série — decisão explícita do proprietário de manter o
  comportamento atual da criação manual (ver seção 3, item 4).
- Recorrência mensal ou personalizada (ex. "toda segunda e quarta") — só diária e semanal de um
  único dia entram nesta fase, conforme o exemplo do audit de produto.
- Duplicação em lote (duplicar várias consultas de uma vez) — só a duplicação avulsa de uma
  consulta por vez entra nesta fase.
- Revalidação retroativa de bloqueios manuais contra ocorrências já criadas — gap pré-existente já
  documentado (um bloqueio `ferias` criado depois não cancela consultas que já existem dentro do
  intervalo); esta fase não piora nem resolve esse gap, só o herda com mais superfície porque uma
  série cria mais linhas de uma vez.

## 6. Validações planejadas

- Specs da migration (padrão dos precedentes).
- Specs de serviço: geração de datas de ocorrência (semanal/diária, por contagem/por data, teto de
  52); `criarConsultasRecorrentes` best-effort (todas criadas; algumas puladas por conflito; todas
  puladas → erro e sem linha órfã de `agenda_recorrencias`; erro de paciente/profissional aborta a
  série inteira); `duplicarConsulta` (campos copiados corretamente, `referenciaExterna` não
  copiada, 404 para consulta de outro tenant).
- `pnpm --dir octaclin-backend typecheck` / `build`.
- `pnpm --dir octaclin-web typecheck` / `lint` / `build`.
- Playwright do painel de agenda cobrindo o checkbox de repetição e o botão de duplicar, sem
  regredir os cenários existentes de criação/remarcação de consulta.
- `git diff --check`, `pnpm security:secrets`.

## 7. Validações realizadas (2026-09-23)

- `npx jest` (octaclin-backend): **PASS** — 2083 passados, 31 pulados (pré-existentes), 0 falhas,
  217 de 220 suites (3 puladas, pré-existentes).
- `pnpm test:migracoes-fora-de-banda`: **PASS** — 13/13.
- `pnpm test:redacao-auditoria`: **PASS** — 24/24 (inclui as chaves novas `consultaOrigemId`,
  `frequencia`, `totalCriadas`, `totalPuladas` adicionadas a `CHAVES_SEGURAS`).
- `pnpm --dir octaclin-backend typecheck`: **PASS**.
- `pnpm --dir octaclin-web typecheck`: **PASS**.
- `pnpm --dir octaclin-web lint`: **PASS** (0 erros; avisos pré-existentes não relacionados a esta
  fase, confirmados por número de linha antes da mudança).
- `pnpm --dir octaclin-web build`: **PASS**, incluindo as duas rotas BFF novas
  (`/api/agenda/consultas/recorrentes`, `/api/agenda/consultas/[consultaId]/duplicar`) na listagem
  de build.
- Playwright `tests/visual/jornadas-criticas.spec.mjs` (desktop-chromium + mobile-chromium):
  **PASS** — 16/16, incluindo os 2 cenários novos desta fase (série recorrente com ocorrência
  pulada reportada; duplicação avulsa) e sem regressão nos 6 cenários pré-existentes do arquivo.
- `git diff --check`: **PASS** (sem espaço em branco inválido).
- `pnpm security:secrets`: **PASS** (nenhum secret real identificado).
- Descoberto durante a implementação (não estava no plano original): bug pré-existente da Fase 276
  em `opcoes-typeorm.ts` — `ExpedienteProfissionalOrm` e `TipoAtendimentoOrm` registrados no módulo
  Nest mas ausentes do `entities[]` do `DataSource` real, o que quebraria em produção no primeiro
  acesso a expediente/tipos de atendimento (`EntityMetadataNotFoundError`). Corrigido no mesmo
  branch por tocar o mesmo array que a entidade nova desta fase (`AgendaRecorrenciaOrm`) precisa;
  adicionado teste de regressão genérico `opcoes-typeorm.entidades.spec.ts` (varre `**/*.orm.ts` e
  confirma presença de cada `*Orm` exportado em `entities[]`) para essa classe de falha não se
  repetir.
- Divergência menor do plano: o nome da função cliente do frontend ficou
  `criarConsultasRecorrentesAgenda` (o plano citava `criarSerieRecorrenteAgenda`) — sem impacto de
  comportamento, só nomenclatura.
- Aplicação fora de banda da migration em staging/produção com role owner **não executada nesta
  fase** — continua responsabilidade do proprietário, fora do escopo deste agente.
