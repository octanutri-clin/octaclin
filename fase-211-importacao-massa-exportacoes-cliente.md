# Fase 211 - Importacao em massa e exportacoes do cliente

Status: concluida em 2026-08-06.

## Problema

Nao havia importacao de pacientes: migrar clinica com carteira formada era um a
um, na mao — e clinica com carteira formada e exatamente quem paga mais.

Exportacao existia so onde ninguem pede (convites, auditoria, outbox, protocolo
LGPD). Nao havia exportar lista de pacientes, respostas de formulario nem
agenda: fricao comercial e argumento fraco em conversa sobre portabilidade LGPD.

E os dois mecanismos de CSV que existiam divergiam entre si.

## Entregue

### CSV unificado, com defesa contra injecao de formula (commit `21c3dcd`)

`infraestrutura/exportacao/csv.ts` virou fonte unica: `campoCsv`/`montarCsv`
substituiram `campoCsv` do modulo cliente e `escaparCsv` do modulo operacoes,
que discordavam sobre quando citar e sobre newline dentro de celula.

Alem da citacao RFC 4180, o campo que comeca com `=`, `+`, `@` ou tab recebe
apostrofo a frente: nome de paciente e observacao vem de input do usuario e vao
parar numa planilha, entao `=HYPERLINK(...)` num nome exfiltra a linha inteira
quando a clinica abre o arquivo. Numero negativo escapa da regra do hifen de
proposito — `-50` e dado, e prefixa-lo quebraria qualquer coluna numerica.

### Leitor de CSV sujo

O mesmo modulo ganhou `analisarCsv`, porque planilha de cliente nao chega limpa:
BOM do Excel, CRLF, separador `,`/`;`/tab (pt-BR exporta com `;`), campo citado
com separador e quebra de linha dentro, aspas escapadas, linhas em branco no
meio, cabecalho acentuado e em caixa alta.

Duas decisoes deliberadas: **o numero da linha e o do arquivo original**, mesmo
com campo multilinha, senao o relatorio de erro aponta para a linha errada da
planilha do cliente; e **linha com contagem de colunas diferente nao e
descartada** no parser — quem valida e que acusa.

### Importacao de pacientes em duas etapas

`POST /pacientes/importar/previa` valida e devolve o relatorio **sem gravar**;
`POST /pacientes/importar` grava as linhas validas. A tela so envia para gravar
o arquivo que ja mostrou linha a linha.

O relatorio traz **uma entrada por linha do arquivo**, inclusive as recusadas,
com numero da linha e motivo — linha invalida que some sem aviso e o pior
resultado possivel de uma importacao. Situacoes: `valido`, `invalido`,
`duplicado`, `limite_plano`.

Cabecalhos aceitos por sinonimo (`nome`/`paciente`, `contato`/`email`/
`telefone`, `nascimento`/`data de nascimento`...), datas em `dd/mm/aaaa` e
`aaaa-mm-dd`, com data impossivel (`31/02`) e data no futuro recusadas.

### Duplicidade

Chave e nome normalizado (sem acento, sem caixa, espaco colapsado) mais data de
nascimento, comparada contra a carteira **do profissional responsavel** e contra
as proprias linhas ja aceitas do arquivo. Reimportar o mesmo arquivo nao cria
nada.

A comparacao nao varre o tenant inteiro de proposito: o mesmo paciente atendido
por dois profissionais e legitimo, e varrer tudo contaria "duplicado" sobre
paciente que quem importa nem pode ver.

### Escopo e abuso

Quando quem importa e Professional, o `profissionalResponsavelId` do corpo e
**ignorado** e vale o vinculo do proprio usuario — senao a importacao viraria um
jeito de plantar paciente na carteira alheia. SuperAdmin precisa informar o
responsavel explicitamente.

Tres freios: `pacientes.gerenciar` na rota (Collaborator nao importa), teto de
500 linhas por requisicao e corpo de 1 MB, e o limite do plano — a importacao
grava ate o `restante` da assinatura e marca o excedente como `limite_plano` em
vez de estourar o limite silenciosamente. Assinatura suspensa ou cancelada
bloqueia antes de ler o arquivo.

### Exportacoes

Tres rotas novas, todas reaproveitando a listagem que ja tem o escopo, em vez de
uma segunda consulta paralela — que seria a segunda chance de vazar paciente de
outro profissional:

- `GET /pacientes/exportar.csv` - pagina a propria `listar` com os mesmos
  filtros da tela, teto de 5000 linhas.
- `GET /questionarios/:id/respostas/exportar.csv` - formato largo, uma linha por
  resposta e uma coluna por pergunta.
- `GET /agenda/consultas/exportar.csv` - sai do feed e **descarta tudo que nao e
  consulta**: bloqueio do Google entra no feed como "Indisponivel" justamente
  para nao vazar o compromisso pessoal do profissional, e num CSV isso ficaria
  permanente.

As tres registram na auditoria o **volume levado** (`linhas`), nao so que
alguem clicou em exportar. A importacao registra total, criados, duplicados,
invalidos e bloqueados por plano.

### Web

BFF em `app/api/pacientes/exportar.csv`, `app/api/pacientes/importar`,
`app/api/agenda/consultas/exportar.csv` e
`app/api/questionarios/[id]/respostas/exportar.csv`.

Na tela de pacientes: "Exportar CSV" leva os filtros ativos (o CSV sai do que
esta na tela, nao da base inteira) e "Importar CSV" abre o modal de duas etapas
com o relatorio linha a linha. Exportacao usa `<a href>`, o padrao que o portal
do cliente ja usava, sem fetch nem blob.

### Extensao: anexos e convites de portal (2026-08-08)

A coluna opcional `anexo` (tambem aceita `arquivo`, `exame` ou `documento`) liga
cada linha ao arquivo local de mesmo nome. O paciente e criado primeiro e o
relatorio devolve seu `pacienteId`; so entao a web envia o binario pelo upload
assinado da Fase 200, preservando validacao de formato, tamanho, cota e acesso.
JPEG, PNG, WebP e PDF sao aceitos. Ate tres anexos sao processados em paralelo.

Falha ou ausencia de um arquivo nao desfaz o paciente nem interrompe o restante
do lote. O resultado mostra anexos confirmados, nao selecionados e com falha, e
registra o motivo na linha correspondente.

O operador tambem pode pedir a criacao de convite do portal. A previa avisa
quando o contato nao e um e-mail; na importacao, cada paciente elegivel recebe
um convite separado e o relatorio mostra o link de ativacao. Convite com falha
nao desfaz o cadastro. A criacao ocorre **depois do commit do paciente**: abrir
uma segunda transacao antes disso fazia o convite nao enxergar o registro ainda
nao confirmado. A quantidade criada entra na auditoria da importacao.

O convite e gerado para compartilhamento pelo operador; esta extensao nao faz
disparo automatico por e-mail.

## Testes

- `csv.spec.ts`: 28 casos - citacao RFC 4180, injecao de formula, negativo, e a
  leitura suja (BOM, CRLF, `;`, tab, multilinha, numeracao de linha, colunas
  faltando).
- `servico-importacao-pacientes.spec.ts`: 28 casos, incluindo anexos, convites,
  falha parcial e o criterio de
  aceite da fase — 200 pacientes com 5 linhas invalidas produzem 195 criados e
  as 5 linhas no relatorio com o numero certo (9, 49, 89, 129, 169).
- Exportacao coberta em `servico-pacientes.spec.ts` (escopo, teto, formula),
  `servico-questionarios.spec.ts` (coluna por pergunta) e
  `servico-agenda.spec.ts` (bloqueio do Google fora do CSV).
- `controlador-pacientes.spec.ts`: auditoria com volume e permissao por rota.

## Validacoes

688 testes de backend em 98 suites, `typecheck` do backend, e no web
`typecheck`, `lint`, `test:authz`, `test:next15` (67 arquivos),
`test:importacao-pacientes` (3) e `build` (114 paginas).

Nenhuma migration nesta fase: importacao e exportacao usam o schema existente.

`console-regression.spec.mjs` e `jornadas-criticas.spec.mjs` nao foram
executados — exigem backend e banco reais. Rodar antes do go-live.

## Limites conhecidos

- A deteccao de duplicidade carrega a carteira do profissional e descriptografa
  em memoria, porque nao ha coluna de deduplicacao no banco. Aguenta a escala de
  uma clinica; se virar gargalo, criar `chave_deduplicacao` com indice.
- Cada linha aceita um anexo por nome. O arquivo precisa ser selecionado no
  navegador e o formato fica limitado ao contrato seguro da Fase 200. Como o
  upload ocorre depois do cadastro, uma falha fica explicita para nova tentativa
  e nao apaga o paciente criado.
- O convite e criado e devolvido como link; envio automatico por e-mail continua
  fora deste fluxo.
- A exportacao da agenda usa janela fixa de 90 dias para tras e para frente,
  porque o painel nao carrega periodo escolhido pelo usuario.
