# Fase 209 - Financeiro da consulta e pacote de sessoes

Status: concluida em 2026-08-05.

Antes desta fase a consulta nao tinha valor, forma de pagamento nem status de
pagamento. Nao havia relatorio de faturamento — e faturamento e o numero que o
dono de clinica olha para decidir se renova a assinatura. Pacote de sessoes, que
e o formato dominante de venda de acompanhamento no Brasil, vivia em planilha
paralela.

## Entregue

### Dinheiro e inteiro em centavos, em todo lugar

`agenda/dominio/financeiro-consulta.ts` e a unica fonte das regras. Nao existe
`number` com casa decimal atravessando servico, banco ou HTTP: `0.1 + 0.2` e
`0.30000000000000004`, e o total do mes de uma clinica fecharia errado por
centavos que ninguem consegue explicar. A virgula so aparece na borda de
exibicao (`formatarValorBRL`) e na leitura do campo digitado
(`centavosDeTexto`).

`centavosDeTexto` trata o ponto pela presenca da virgula: com virgula, ponto e
separador de milhar (`1.800,00` = 180000); sem virgula, ponto e decimal
(`180.00` = 18000). E a unica leitura que nao transforma um preco em cem vezes
ele mesmo.

Valor fracionado, negativo ou acima do teto e **recusado**, nao arredondado:
dinheiro arredondado sem o usuario ver e origem de divergencia de fechamento.

### Invariantes no banco, nao so no servico

Migration `1720000001019-AdicionarFinanceiroConsulta`:

```sql
check ((status_pagamento = 'pago') = (pago_em is not null))
check (pacote_id is null or (forma_pagamento = 'pacote' and valor_centavos = 0))
```

A primeira porque "pago" sem data nao fecha conciliacao nenhuma, e data de
pagamento em consulta nao paga e o mesmo erro pelo avesso. A segunda porque
consulta de pacote com valor proprio faria o **mesmo atendimento entrar duas
vezes** no total do mes: o dinheiro do pacote ja esta no pacote.

`pacotes_sessao` nasce com RLS forcada, como toda tabela do produto.

### Consulta cancelada nunca entra no faturamento

Criterio de aceite da fase, aplicado em dois lugares: `somarRecebimentos` ignora
a linha, e `registrarPagamento` recusa marcar como paga uma consulta que a
clinica cancelou — cobrar isso e o tipo de erro que vira reclamacao no Procon.

Consulta **isenta** conta como atendimento realizado mas nao entra em recebido
nem em pendente, senao o dono da clinica ve "a receber" que ninguem vai cobrar.

### Recibo reusa o gerador da Fase 208

Nenhum codigo de geracao novo: `recibo_consulta` entrou como terceiro tipo em
`MODELOS_PADRAO`, com catalogo proprio de variaveis (`valor`, `formaPagamento`,
`dataPagamento`) e o mesmo caminho append-only, criptografado e auditado.

A migration abriu o `check` de tipo e criou **indice unico parcial por consulta**
tambem para o recibo: dois recibos vivos do mesmo atendimento e o caminho para o
paciente declarar a mesma despesa duas vezes.

Recibo so sai de consulta com pagamento registrado. Emitir antes seria declarar
recebimento que nao aconteceu — e o paciente fica com a prova disso. Consulta
paga por pacote nao gera recibo proprio.

### Pacote de sessoes como agrupador opcional

`falta` **consome** sessao (o horario foi reservado e perdido) e `cancelada`
devolve a vaga. Sessao ja agendada conta como reservada, entao um pacote de 10
nao aceita a 11a consulta — sem isso o profissional agendaria alem do contratado
e descobriria no fechamento.

O status de pagamento da consulta de pacote **vem do pacote**: quem deve, deve o
pacote inteiro, nao a sessao.

Pacote vencido nao recebe consulta nova. A comparacao e por **data**, nao por
instante: pacote com validade "31/12" vale o dia 31 inteiro.

### Recebimentos no portal do cliente

Aba nova em `/cliente` com recebido, a receber, isentos e quebra por
profissional no periodo (mes corrente por padrao). Consultas e pacotes aparecem
em linhas **separadas** — somar os dois no mesmo numero contaria o atendimento
duas vezes.

O fim do periodo vai ate o ultimo instante do dia escolhido: senao a consulta
das 15h do dia 31 ficaria de fora do fechamento do mes.

### Escopo de acesso

Permissao nova `agenda.financeiro.ler`, dada a SuperAdmin, Professional e
Client. **Collaborator registra pagamento e nao ve o faturamento da casa**: a
recepcao precisa lancar o que recebeu, nao precisa do total da clinica.

Professional so ve o proprio: `resolverProfissionalIdDoUsuario` sobrescreve o
filtro pedido pelo cliente, entao passar `profissionalId` de outro nao abre nada.
Teste cobre exatamente esse caso.

Toda rota do caminho de dinheiro audita, **inclusive a leitura** — e o que
permite responder "quem marcou esta consulta como paga" e "quem consultou o
faturamento do mes".

## Decisoes que valem registro

### Sem gateway de pagamento, de proposito

O gateway definitivo ja e pendencia separada no
`CHECKLIST_FASES_FUTURAS_PRODUCAO.md` e diz respeito a **assinatura do tenant no
OctaClin**, nao ao pagamento da consulta do paciente. Sao dois fluxos
diferentes; misturar os dois criaria um acoplamento que nenhum dos dois pede.

### NFS-e fora, recibo dentro

NFS-e envolve prefeitura por municipio e nao cabe num MVP. Recibo resolve a
necessidade imediata.

### Recibo sem CPF do pagador

O cadastro de paciente nao guarda CPF (`pacientes` tem nome, contato e
nascimento). O recibo sai com os dados fiscais da clinica e a identificacao do
paciente pelo nome. Para deducao de IRPF o CPF do pagador costuma ser exigido —
se isso virar demanda real, o caminho e uma fase de cadastro fiscal do paciente,
nao um campo digitado no momento da emissao.

### Recibo pode ir por e-mail; relatorio de alta continua nao indo

A Fase 208 recusou o envio do relatorio de alta porque
`mensagens_notificacao.payload` era jsonb em claro. O seguimento da 208 ja
cifrou o conteudo (`conteudo_criptografado`), e o recibo nao carrega dado
clinico — e um documento feito para ser entregue ao paciente. O relatorio de alta
segue fora: reavaliar aquela decisao e assunto proprio, nao efeito colateral
desta fase.

### Politica de falta fixa em codigo

`falta` consome sessao do pacote. E a politica dominante em clinica, esta
marcada com comentario `ponytail:` no dominio e vira campo do pacote se algum
tenant pedir o contrario. Nao entrou configuracao para um caso que ainda nao
apareceu.

## Validacoes

- `npx jest` no backend: **596 testes aprovados** (92 suites), incluindo 7 de dominio
  financeiro, 13 do servico financeiro, 4 do recibo e 4 da migration.
- `tsc --noEmit` no backend e no `octaclin-web`: limpos.
- `eslint` no `octaclin-web`: sem avisos.
- `next build`: aprovado.
- `pnpm security:secrets`: sem achados.
- `pnpm validate:docs`: preflight documental OK.

Regressao visual/a11y (`test:e2e:criticas`, `test:a11y`) nao foi executada nesta
fase: depende de aplicacao rodando com banco. As telas novas seguem os
componentes ja cobertos (`Cartao`, `Campo`, `Selecao`, `Abas`) e a tabela de
recebimentos leva `caption` e cabecalhos com escopo.

## Pendencias registradas

- Consultas anteriores a esta fase ficam com `valor_centavos = 0` e
  `status_pagamento = 'pendente'` (default da migration). Elas nao inflam o
  faturamento (valor zero), mas aparecem como atendimento no periodo. Nao ha
  backfill possivel: o dado nunca existiu.
- O seletor de recibo lista consultas pagas dos ultimos 30 dias, que e a janela
  de `listarConsultasAgenda`. Recibo de consulta mais antiga exige ampliar essa
  janela ou uma busca propria.
