# Desenho de migration - criptografia de campos PHI residuais (Fase 261)

> **Status: proposta, nao decidida, nao executada.** Nenhum DDL deste
> documento foi aplicado em nenhum ambiente. Este arquivo existe para que o
> dono do produto decida se, quando e em que ordem executar -- por decisao
> explicita da Fase 261 ("desenhar a migration sem executar"). Depois de uma
> decisao, o trabalho vira PR e o `docs/history/phases/fase-261-*.md`
> registra o que foi de fato feito; este arquivo nao e reescrito para
> parecer historico.

## 1. Escopo

O audit inicial da Fase 261 encontrou cinco campos com conteudo clinico ou
de negocio sensivel ainda em texto claro, fora do padrao ja aplicado a
`evolucoes_clinicas.conteudo`, `acompanhamento_tarefas.descricao`,
`condutas_terapeuticas` e `mensagens_notificacao.conteudo`:

| # | Tabela.coluna | Tipo atual | Selecionado na UNION da timeline? |
| --- | --- | --- | --- |
| 1 | `logs_diario_rapido.valor` | `jsonb not null` | Nao (branch usa literal `'Registro de habitos'`) |
| 2 | `evolucoes_clinicas.titulo` | `varchar(180) not null` | Sim, posicao `titulo` |
| 3 | `acompanhamento_tarefas.titulo` | `varchar(180) not null` | Sim, posicao `titulo` |
| 4 | `documentos_emitidos.motivo_cancelamento` | `varchar(300) nullable` | Nao (branch usa `documento.titulo`, coluna diferente) |
| 5 | motivo de cancelamento em `agenda_consultas.payload.historico[].motivo` | jsonb, campo dentro de array append-only | Nao (branch usa `consulta.titulo`, nao o `payload`) |

So os alvos 2 e 3 tocam a query UNION ALL compartilhada
(`ServicoPacientes.listarLinhaDoTempoPaginada`,
`servico-pacientes.ts:796-1030`) -- os outros tres sao isolados. Isso muda a
ordem de risco: os alvos 1, 4 e 5 sao conversoes de coluna relativamente
diretas; 2 e 3 exigem tambem uma mudanca na query compartilhada.

## 2. Padrao adotado (sem novidade arquitetural)

Nenhum mecanismo novo. Reusa exatamente o que ja existe:

- `CriptografiaDadosSensiveis` (`infraestrutura/seguranca/criptografia-dados-sensiveis.ts`):
  AES-256-GCM, IV aleatorio de 12 bytes por chamada, envelope versionado com
  `keyId`, suporte a chave anterior via `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR`
  para leitura dupla durante rotacao.
- Coluna irma `bytea`, nunca transformer de `@Column` nem subscriber --
  `criptografar()`/`descriptografar()` chamados explicitamente no service,
  igual a `tituloCriptografado` em `servico-condutas-terapeuticas.ts`.
- Migration puramente aditiva por fase, registrada em
  `infraestrutura/banco-dados/opcoes-typeorm.ts`, com `up`/`down` simetricos
  (ADR implicito do `octaclin-backend/AGENTS.md`: "nova migration deve ser
  aditiva quando possivel, ter rollback ou limite de nao reversao
  documentado").
- Sem indice de busca cifrado (ADR-017): nenhuma das cinco colunas e
  filtrada por conteudo em nenhuma query hoje (confirmado por leitura
  direta de `listarLinhaDoTempoPaginada` -- o `WHERE` so usa `tipo`, `data`,
  `responsavelId` e cursor por `id`/`data`). Sem filtro, sem indice cego a
  desenhar.
- Precedente de migration real mais proximo:
  `1720000001018-CriptografarConteudoNotificacoes.ts` -- so adiciona a
  coluna `bytea` nullable, sem backfill, sem tocar a coluna antiga. E o
  modelo para a Fase A abaixo.
- Nao ha precedente no repositorio de uma migration que faca backfill e
  DROP da coluna antiga depois. Este desenho descreve a Fase C como a
  primeira desse tipo -- por isso ela exige decisao e revisao cruzada
  separadas, e nao decorre automaticamente das Fases A/B.

## 3. Por alvo

### 3.1 `logs_diario_rapido.valor`

- Coluna nova: `valor_criptografado bytea null`.
- `valor` perde o `not null` (ALTER COLUMN ... DROP NOT NULL) para permitir
  linha nova sem duplicar conteudo.
- Escrita (`ServicoMobile`, criacao do registro): passa a gravar so
  `valor_criptografado = criptografia.criptografar(JSON.stringify(dados.valor))`;
  `valor` fica `null` em linhas novas.
- Leitura (`listarDiarioRapido` e `mapearEventoDiario`): se
  `valor_criptografado` existir, `JSON.parse(criptografia.descriptografar(...))`;
  senao, usa `valor` (linhas historicas). `mapearEventoDiario` hoje monta o
  titulo da timeline a partir de `diario.tipo`, nao do conteudo de `valor` --
  esse ponto nao muda.
- Sem impacto na UNION: a branch `checkin_rapido` nunca seleciona `valor`.

### 3.2 e 3.3 `evolucoes_clinicas.titulo` / `acompanhamento_tarefas.titulo`

- Colunas novas: `titulo_criptografado bytea null` em cada tabela (nome
  simetrico ao `conteudo_criptografado`/`descricao_criptografada` ja
  existentes nas mesmas tabelas).
- `titulo` perde o `not null` nas duas tabelas.
- Escrita (`ServicoPacientes.criarEvolucao`/`criarTarefaAcompanhamento`,
  hoje em `servico-pacientes.ts:468` e `:510`): grava so
  `tituloCriptografado`; `titulo` fica `null` em linhas novas. Mesma
  mudanca de padrao que `conteudo`/`descricao` ja usam nas mesmas linhas de
  codigo hoje.
- Leitura direta (fora da UNION): todo `SELECT` feito via TypeORM
  (`repository.find`, `findOne`) troca `titulo` por
  `criptografia.descriptografar(linha.tituloCriptografado)` com fallback
  para `linha.titulo` quando a nova coluna for `null` (linha historica).
  Sites a ajustar: `servico-pacientes.ts:687,705,726,741,1012,1218,1233,
  1284,1375,1391`, `servico-portal-paciente.ts:1300`,
  `servico-dashboard-clinico.ts:432`.
- **UNION ALL (o ponto complicado):** as duas branches (`evolucao_clinica` e
  `tarefa_acompanhamento`) hoje selecionam `evolucao.titulo`/`tarefa.titulo`
  direto na posicao de coluna `titulo`, que precisa continuar `text` em
  todas as 14 branches do UNION (varias outras branches ja colocam um
  literal ali, ex. `'Formulario'`, `'Registro de habitos'`). `bytea` nao
  pode entrar nessa posicao.

  Solucao: trocar `evolucao.titulo`/`tarefa.titulo` por um literal fixo
  nessas duas branches (ex. `'Evolucao clinica registrada'`/`'Tarefa de
  acompanhamento registrada'`, no mesmo estilo textual que `'Anexo clinico
  confirmado'` ou `'Coleta de exames laboratoriais'` ja usam para eventos
  sem titulo variavel). O SQL nunca mais le nem devolve o titulo real
  dessas duas branches -- exatamente como `conteudoCriptografado` ja nunca
  entra nesse SQL hoje.

  Depois que `listarLinhaDoTempoPaginada` corta a pagina (`linhas.slice(0,
  limite)`, `servico-pacientes.ts:1009`), um passo de pos-processamento
  busca os ids de tipo `evolucao_clinica`/`tarefa_acompanhamento` presentes
  naquela pagina (tipicamente poucas dezenas de ids, ja que `limite` e o
  tamanho da pagina), faz duas queries pontuais por id
  (`WHERE tenant_id = $1 AND id = ANY($2)`, ja sob RLS/tenant como o resto
  do metodo) trazendo `tituloCriptografado`/`titulo`, descriptografa e
  substitui o titulo literal pelo titulo real no array de itens antes de
  devolver ao chamador. Isso preserva ordenacao e cursor (`ORDER BY data
  DESC, id DESC`, que nunca dependeu de `titulo`) sem exigir `bytea` dentro
  do `UNION ALL`.

  Custo adicional: ate duas queries extra por pagina da timeline (uma por
  tabela, so quando a pagina contem itens desses tipos), cada uma um
  `WHERE ... id = ANY(...)` com poucas dezenas de ids -- nao um novo
  `N+1` por item.

### 3.4 `documentos_emitidos.motivo_cancelamento`

- Coluna nova: `motivo_cancelamento_criptografado bytea null`.
- Sem mudanca de nullability: a coluna ja e `nullable: true`.
- O CHECK `documentos_emitidos_cancelamento_check` (`cancelado_em is not
  null or motivo_cancelamento is null`) continua valido sem alteracao: ele
  so proibe `motivo_cancelamento` preenchido sem `cancelado_em`; deixar
  `motivo_cancelamento` `null` com `cancelado_em` preenchido (caso novo,
  motivo so na coluna cifrada) ja e permitido pela regra como esta escrita.
- Escrita (`ServicoDocumentosClinicos.cancelar`,
  `servico-documentos-clinicos.ts:184-201`): grava so
  `motivoCancelamentoCriptografado`; `motivoCancelamento` fica `null` em
  cancelamentos novos.
- Leitura (`mapear()`, `servico-documentos-clinicos.ts:505-506`): prefere
  `motivoCancelamentoCriptografado` descriptografado; fallback para
  `motivoCancelamento` em linhas historicas.
- Sem impacto na UNION: a branch `documento_emitido` seleciona
  `documento.titulo` (coluna diferente, fora de escopo aqui), nao
  `motivo_cancelamento`.

### 3.5 Motivo de cancelamento em `agenda_consultas.payload.historico[].motivo`

Caso mais diferente dos outros quatro: nao existe uma coluna dedicada hoje,
o valor mora dentro de um array append-only em um jsonb maior que tambem
carrega campos nao sensiveis usados pela propria infra (`pacienteNome`,
`emailContato`, `whatsappContato`, `googleCalendar`, `notificacoes` --
lidos por `servico-agenda.ts:1314` e
`automacoes/aplicacao/servico-lembretes-agenda.ts:164`). Cifrar o `payload`
inteiro quebraria esses consumidores; cifrar so `motivo` dentro do array
exigiria reescrever jsonb estruturado por indice de array a cada leitura, o
que e mais fragil do que criar uma coluna dedicada.

- Coluna nova: `motivo_cancelamento_criptografado bytea null` em
  `agenda_consultas` (mesmo nome usado em `documentos_emitidos`, por
  consistencia).
- Escrita (`ServicoAgenda.executarCancelamento`, `servico-agenda.ts:660-666`):
  alem de continuar chamando `adicionarHistorico(...)`, grava
  `motivoCancelamentoCriptografado = motivo ? criptografia.criptografar(motivo) : null`.
  O evento gravado em `payload.historico` passa a levar so
  `{ acao: 'cancelada', origem, canceladaEm, motivoRegistrado: Boolean(motivo) }`
  -- sem o texto do motivo em claro dentro do jsonb a partir desse ponto.
- Leitura: qualquer exibicao do motivo de cancelamento (hoje implicita, via
  `payload` cru no `ConsultaAgendaRespostaDto`) passa a vir de
  `criptografia.descriptografar(consulta.motivoCancelamentoCriptografado)`,
  nunca mais de `payload.historico[].motivo`.
- **Limite aceito, nao um bug a corrigir por esta migration:** entradas de
  `historico` gravadas antes da Fase A continuam com o motivo em claro
  dentro do jsonb existente. Reescrever arrays jsonb linha a linha para
  redigir historico e uma migration de dado propria, com seu proprio risco
  (reescrita de coluna grande, sem precedente no repositorio) -- fica fora
  deste desenho, registrada aqui como debito explicito e nao escondida.

## 4. Fases de execucao

Cada fase e um PR e uma decisao separados; nenhuma decorre automaticamente
da anterior.

### Fase A - aditiva (baixo risco, reversivel por `down()` puro)

DDL por tabela, todo `ADD COLUMN IF NOT EXISTS ... bytea` +
`ALTER COLUMN ... DROP NOT NULL` onde aplicavel (`logs_diario_rapido.valor`,
`evolucoes_clinicas.titulo`, `acompanhamento_tarefas.titulo`). Sem
backfill, sem mudanca de comportamento -- identico em espirito a
`1720000001018`. `down()` faz `DROP COLUMN IF EXISTS` e (onde relevante)
`ALTER COLUMN ... SET NOT NULL` de volta, seguro porque nenhuma linha nova
ainda depende da coluna cifrada.

Nenhuma mudanca de codigo de aplicacao nesta fase.

### Fase B - troca do caminho de escrita/leitura (risco medio, PR de codigo)

Os pontos de escrita listados na secao 3 passam a gravar so na coluna
cifrada; os pontos de leitura passam a preferir a coluna cifrada com
fallback para a antiga. A mudanca na query UNION (secao 3.2/3.3) entra
aqui, junto do pos-processamento de hidratacao de titulo.

TDD obrigatorio por ser mudanca de contrato sobre dado sensivel (regra
geral do `AGENTS.md`): teste positivo (linha nova cifrada le certo) e
teste negativo (linha historica sem coluna cifrada continua legivel via
fallback, e a UNION continua ordenando e paginando igual).

Rollback desta fase: reverter o deploy do codigo. O schema da Fase A
continua compativel com a versao anterior do codigo (ela simplesmente
ignora as colunas novas, que ficam `null` enquanto o codigo antigo grava
so nas colunas de texto).

### Fase C - backfill e remocao da coluna antiga (alto risco, autorizacao separada)

So depois da Fase B validada em producao por tempo suficiente para
confianca operacional (numero de dias e criterio de "suficiente" ficam
para quem autorizar esta fase, nao para este documento). Dois passos
distintos, cada um seu proprio commit:

1. **Backfill**, script standalone fora da migration (mesmo padrao de
   `backfill-indices-busca-pacientes.ts`): exige `DATABASE_URL` e
   `CONFIRMAR_BANCO_BACKFILL=<nome-do-banco>` batendo, itera tenant a
   tenant com `set_config('app.tenant_id', ...)` para RLS, pagina por
   `id` (`take: 100`, keyset), e so escreve a coluna cifrada quando ela
   ainda estiver `null` e a coluna antiga tiver valor (idempotente,
   seguro para reexecutar).
2. **Migration de remocao**, separada, so depois do backfill confirmado
   100% em auditoria (`SELECT count(*) WHERE <coluna_cifrada> IS NULL AND
   <coluna_antiga> IS NOT NULL` = 0 em cada tabela): `DROP COLUMN` da
   coluna antiga (e do `NOT NULL` remanescente, se algum). **Este passo
   nao tem rollback de dado** -- o `down()` so recria a coluna vazia; o
   texto plano removido não volta. Limite de nao-reversao explicito, como
   `AGENTS.md` exige para mudanca R4: a unica forma de reverter o
   conteudo e restaurar de um backup anterior ao `DROP`.

## 5. Risco e revisao

Auth/authz/RLS/tenancy nao mudam (nenhum destes campos cruza fronteira de
autorizacao diferente da que ja existe). Crypto e PHI/PII mudam -- R4 pelo
`AGENTS.md`. Antes de qualquer Fase B ou C real:

- confirmar `CRIPTOGRAFIA_CHAVE_AES_256` (e `_ANTERIOR`, se em rotacao) no
  ambiente alvo, sem copiar o valor para este repositorio nem para o chat;
- revisao cruzada da mudanca na query UNION especificamente (e o unico
  ponto com superficie nova de bug: paginacao/ordenacao poderiam quebrar
  silenciosamente se o pos-processamento de hidratacao alterar a ordem
  dos itens);
- rodar a migration da Fase A e o backfill da Fase C primeiro contra um
  banco descartavel/staging, nunca contra producao como primeira execucao.

## 6. Fora de escopo deste desenho

- Rotacao da chave AES: ja coberta por `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR`
  e pelo mecanismo existente; nada neste desenho adiciona rotacao nova.
- Reescrita de `payload.historico` historico de `agenda_consultas` (secao
  3.5) para redigir motivo em claro de cancelamentos antigos.
- Qualquer indice de busca sobre os campos cifrados (nenhum uso atual
  filtra por conteudo desses campos).
