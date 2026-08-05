# Fase 208 - Documentos clinicos gerados

Status: concluida em 2026-08-05.

Antes desta fase o produto tinha consentimento LGPD versionado e perfil fiscal da
empresa, mas nao emitia **nenhum** documento para o paciente. Declaracao de
comparecimento saia em Word, e o acompanhamento terminava sem entregavel.

## Entregue

### Dominio (`pacientes/dominio/documentos-clinicos.ts`)

Dois tipos, cada um com modelo padrao em codigo e catalogo proprio de variaveis.
O modelo do tenant e **override** por cima do padrao, campo a campo: clinica nova
emite documento no primeiro dia sem configurar nada, e tipo novo entra sem
migracao de dados.

Substituicao em passada unica: valor que contenha `{{algo}}` entra literal e nao
e reexpandido. Sem isso, um nome de paciente viraria superficie de injecao de
variavel. Teste cobre exatamente esse caso.

A saida e **texto puro**. Nada no dominio produz HTML; quem exibe escapa.

### Validacao de modelo que falha alto

Variavel desconhecida no modelo do tenant e **erro de salvamento**, nao aviso.
Se passasse, a declaracao sairia com um buraco no lugar do nome e ninguem
descobriria ate o paciente entregar o papel no trabalho dele. O catalogo e por
tipo: `{{metasConcluidas}}` na declaracao de comparecimento tambem e recusado.

### Persistencia append-only (`documentos_emitidos`)

RLS por tenant, corpo e cabecalho criptografados, titulo em claro.

Guarda o texto **renderizado**, nao o modelo mais as variaveis: modelo editado ou
cadastro corrigido depois nao pode reescrever documento que ja esta na mao de
terceiro. Nao ha edicao. Errou, cancela (`cancelado_em` + motivo) e emite outro.

Duas invariantes no banco, nao so no servico:

```sql
check (tipo <> 'declaracao_comparecimento' or consulta_id is not null)

create unique index ... on documentos_emitidos (tenant_id, consulta_id)
  where tipo = 'declaracao_comparecimento' and cancelado_em is null
```

A primeira porque declaracao sem consulta nao prova comparecimento nenhum. A
segunda porque duas declaracoes vivas para a mesma consulta e o caminho para o
paciente entregar duas versoes diferentes do mesmo fato. Colisao do indice vira
409 com texto que diz o que fazer.

### Regra de emissao

Declaracao de comparecimento **so sai de consulta com status `concluida`** —
criterio de aceite da fase. `agendada`, `reagendada`, `falta` e `cancelada` sao
recusadas com mensagem explicita, e o seletor da interface ja lista apenas
concluidas. Teste de dominio, teste de servico e teste de navegador cobrem os
tres niveis.

### Auditoria em toda rota, inclusive leitura

`emitir`, `abrir`, `listar`, `cancelar` e `enviar` registram. Abrir tambem: e o
que permite responder "quem abriu a declaracao deste paciente".

### Impressao sem dependencia nova

`@media print` em `globals.css` esconde tudo por visibilidade e devolve so a
folha. O shell da aplicacao nao precisa saber que existe folha, e tela nova nao
precisa lembrar de se esconder. PDF sai pelo "salvar como PDF" do navegador —
**nenhuma biblioteca de PDF entrou**.

### Modelos por tenant na conta do cliente

Aba nova em `/cliente`, com o catalogo de variaveis aceitas visivel ao lado do
campo e botao de voltar ao padrao. Campo em branco volta ao padrao do produto.

## Decisoes que valem registro

### Atestado ficou de fora de proposito

Atestado medico e ato privativo de medico (CFM). O produto atende tambem
nutricionista, psicologo e educador fisico: oferecer "atestado" para qualquer
profissional cadastrado colocaria o usuario a emitir documento que ele nao pode
emitir. Declaracao de comparecimento nao tem essa restricao — atesta presenca,
nao condicao de saude, e por isso o modelo padrao nao cita motivo, queixa nem
diagnostico.

### Relatorio de alta nao vai por e-mail

`mensagens_notificacao.payload` e `jsonb` **em claro** — a tabela existe para
telemetria de entrega. A declaracao de comparecimento vai por ali porque e um
documento feito para ser entregue a terceiro e nao carrega dado clinico. O corpo
do relatorio de alta e narrativa clinica; enfia-lo no mesmo payload seria gravar
texto clinico sem criptografia. A alta e impressa e entregue na consulta de
encerramento, que e como ela acontece na clinica. A rota recusa com texto que
explica o motivo, e a interface nem oferece o botao.

Consequencia registrada: se um dia a alta precisar sair por e-mail, o caminho
nao e afrouxar isto — e criptografar o payload de notificacao ou mandar aviso
mais link autenticado.

### Modelos como override, nao como tabela

Nao entrou tabela `modelos_documento`. O padrao vive no dominio e o tenant grava
so o que mudou, em `tenant_configuracoes`. Menos uma migracao, menos um CRUD, e
tenant que nunca abriu a tela ja emite documento correto.

## Correcoes de revisao

`ecc:healthcare-reviewer` confirmou a exclusao do atestado, o modelo append-only
e que a declaracao padrao nao revela diagnostico nem motivo — mas devolveu
**tres achados altos**, todos corrigidos:

1. **Documento saia sem identificacao do profissional** (alto). So `pacienteNome`
   era bloqueio. `profissionalNome` e `profissionalRegistro` podiam renderizar
   vazios — profissional sem registro cadastrado, ou paciente sem responsavel. O
   unico alerta era o banner da interface, que tem a classe `nao-imprimir`:
   **nao sai na folha**. O terceiro receberia a linha de assinatura em branco sem
   nenhum sinal de que faltou algo. Passou a ser bloqueio na emissao.
2. **Relatorio de alta somava a clinica inteira** (alto). As consultas e as metas
   nao eram filtradas por profissional. Numa clinica multiprofissional, a alta da
   nutricionista contava as consultas do psicologo — inflando o acompanhamento de
   quem assina e, pior, **contando a quem recebe o papel que o paciente tambem e
   atendido por outra especialidade**. Agora os numeros ficam restritos ao
   profissional creditado.
3. **Relatorio de alta podia sair sob o registro de outro profissional** (alto).
   O creditado vem da consulta ou do responsavel pelo paciente, nunca de quem
   esta logado; o `conteudo` e texto livre de quem submete. Um profissional (ou
   SuperAdmin) escrevia a narrativa e ela saia assinada por outro, sob o conselho
   dele, sem que ele visse. Agora a alta exige que quem emite **seja** o
   profissional creditado. A declaracao nao entra nessa regra: nao tem conteudo
   autoral, so relata o que a agenda ja registrou. De quebra, profissional
   arquivado deixou de ser creditado — ex-funcionario nao assina documento novo.

`ecc:security-reviewer` confirmou isolamento por tenant e por profissional, RLS
forcada, ausencia de IDOR e de XSS na web. Dois achados corrigidos:

4. **Segunda expansao de variavel na infra de e-mail** (baixo, root cause
   compartilhado). O dominio garante passada unica, e o adaptador SMTP rodava
   `substituirVariaveis` **de novo** sobre o corpo ja renderizado. Paciente
   chamado `{{destino}}` receberia o proprio e-mail no lugar do nome. A garantia
   do dominio nao vale nada se a infra reexpande. Corrigido na origem: conteudo
   vindo do payload e final e nao passa por substituicao. **Isto tambem corrigia
   a agenda**, que ja mandava `texto` com nome de paciente pelo mesmo caminho — um
   nome contendo `{{linkTeleconsulta}}` vazaria o link da sala.
5. **Valor de variavel entrava sem escape no corpo HTML** (baixo). Template de
   e-mail do tenant pode conter marcacao de proposito; o valor, nunca. Passou a
   escapar no ramo HTML.
6. **`emitidoPor` escapava do proprio DTO** (baixo). `lerCabecalho` devolvia o
   objeto inteiro, e o id interno de usuario ia junto na resposta mesmo sem estar
   no tipo. Passou a devolver campo a campo.

### Achado aceito, com motivo

O corpo da declaracao enviada por e-mail fica em claro em
`mensagens_notificacao.payload` (medio na revisao). Verificado antes de decidir:
a agenda **ja** grava `nomePaciente`, `profissionalNome`, `consultaInicioEm`,
`consultaFimEm`, `modalidade`, o texto completo da mensagem e ate
`linkTeleconsulta` nessa mesma coluna, em toda confirmacao e todo lembrete. A
declaracao nao acrescenta classe nova de dado — sao os mesmos campos que a
tabela ja recebe desde a fase da agenda.

O problema e real e e **sistemico**, nao desta fase: payload de notificacao
deveria ser criptografado. Fica registrado como pendencia propria. E foi
exatamente por antecipar isso que o relatorio de alta nao vai por e-mail: ali o
dado **seria** novo.

## Nao feito

- **Assinatura digital ICP-Brasil.** Fora do escopo declarado da fase.
- **Documentos no portal do paciente.** O paciente recebe a declaracao por e-mail
  ou impressa. Listar documentos no portal exigiria decidir se alta aparece la, e
  a decisao de mostrar narrativa clinica ao paciente sem leitura junto e de
  produto, nao de implementacao.
- **Encaminhamento e contrato de atendimento**, citados no diagnostico como
  ausentes. A "Solucao" da fase pediu declaracao e relatorio de alta; os outros
  dois entram como tipo novo (uma entrada em `MODELOS_PADRAO` mais o check da
  migracao), nao como reescrita.
- **Numeracao sequencial por tenant.** O documento e identificado pelo proprio id,
  impresso no rodape. Sequencial exige contador transacional por tenant e nao ha
  exigencia legal para estes dois tipos.
- **CPF na declaracao.** Pratica comum no Brasil para evitar disputa de homonimo
  quando o papel vai para o empregador. O cadastro de paciente nao tem CPF hoje;
  entra junto com o campo, nao antes dele.
- **Codigo de verificacao / QR de autenticidade.** Quem recebe o papel nao tem
  como conferir contra o sistema. Precisa de rota publica de verificacao, que e
  fronteira de confianca nova.
- **Criptografia do payload de notificacao.** Pendencia sistemica levantada pela
  revisao de seguranca, descrita acima. Nao e desta fase e nao pode ser resolvida
  so aqui.
- **Retencao explicita de `documentos_emitidos`.** Nada apaga registro hoje, mas
  o prazo minimo varia por conselho e e decisao de produto.

## Validacao local

- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-backend test --runInBand`: 555/555 aprovados
  (40 novos: 16 de dominio, 21 de servico, 1 de migration, 2 do adaptador de
  e-mail).
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado, 5 rotas novas registradas.
- `playwright test`: 140/140 aprovados, incluindo o teste novo
  "emite declaracao apenas a partir de consulta concluida".
