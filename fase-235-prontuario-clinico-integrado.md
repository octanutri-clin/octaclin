# Fase 235 - Prontuario clinico integrado e navegacao orientada a conduta

Status: em execucao. Fase importante de produto e UX, posterior ao piloto
assistido. Ela consolida capacidades clinicas ja entregues; nao substitui os
bloqueadores de go-live comercial das Fases 225, 226, 228, 229, 231, 232 e 233.

## Objetivo

Transformar o prontuario do OctaClin em uma superficie unica de trabalho para o
profissional: entender o contexto do paciente, identificar a proxima conduta e
acessar os detalhes clinicos sem navegar por uma colecao de modulos isolados.

O desenho toma como referencia funcional, sem copiar dados ou interface, a
organizacao de acompanhamento, avaliacoes, plano e documentos observada no
WebDiet. O resultado deve ser mais claro, responsivo, auditavel e coerente com
as permissoes e garantias ja existentes no OctaClin.

## Decisao de arquitetura de produto

Nao criar uma barra lateral com vinte funcoes paralelas. O prontuario tera seis
areas principais, com cabecalho persistente do paciente e acoes contextuais:

1. **Resumo**: situacao atual, proxima acao, consulta, adesao, alertas e
   evolucao relevante.
2. **Atendimentos**: linha do tempo de consultas, evolucoes e documentos
   associados.
3. **Avaliacoes**: antropometria, anamnese, formularios/check-ins e, em fases
   posteriores, exames e fotos.
4. **Plano**: plano alimentar, metas, tarefas, materiais e, em fases
   posteriores, suplementos, manipulados e orientacoes prescritivas.
5. **Documentos**: anexos, declaracoes, recibos e documentos autorizados.
6. **Financeiro**: consultas, pacotes, pagamentos e recibos, conforme
   permissao.

O paciente nao recebe esta navegacao clinica. O portal mostra apenas a projecao
segura das informacoes publicadas para ele.

## Escopo da Fase 235

### Cabecalho e contexto persistente

- Cabecalho compacto com nome, responsavel, situacao de acompanhamento,
  proxima consulta e acoes rapidas autorizadas.
- Acoes rapidas: registrar evolucao, agendar, iniciar atendimento, abrir plano,
  enviar formulario, anexar documento e registrar pagamento. Cada acao deve
  respeitar permissao, estado do paciente e responsavel atual.
- Indicadores clinicos internos, inclusive risco, permanecem visiveis somente
  para papeis autorizados. Nenhum score ou inferencia clinica vai ao portal do
  paciente ou a payloads desnecessarios.
- Identificacao explicita do painel quando o SuperAdmin estiver acompanhando
  outro profissional; nenhum outro papel troca de painel ou enxerga pacientes
  de outro responsavel fora das regras existentes.

### Cadastro, ativacao e qualidade dos dados do paciente

- Substituir o formulario unico e extenso por quatro secoes progressivas:
  **identificacao e contato**, **responsavel/operacao**, **acesso ao portal** e
  **dados fiscais opcionais**. Dados clinicos detalhados continuam em anamnese,
  avaliacoes e formularios, nunca escondidos no cadastro administrativo.
- **Identificacao e contato**: nome completo, nome de uso/preferido opcional,
  data de nascimento, telefone em formato internacional E.164, e-mail, canal
  preferido e endereco apenas quando houver finalidade definida. CEP, cidade e
  estado sao estruturados, mas nao obrigatorios por padrao.
- **Dados sensiveis e de contexto**: campos de sexo, identidade, condicao
  gestacional/lactacao, restricoes e alergias nao ficam como pre-selecao
  administrativa. Quando necessarios ao cuidado, devem ser opcionais, possuir
  origem e data de atualizacao, ter visibilidade clinica apropriada e apontar
  para anamnese ou avaliacao que os fundamenta.
- **Responsavel e operacao**: profissional responsavel, status do
  acompanhamento, origem/indicacao, tags do tenant, proxima revisao e contato
  responsavel/representante quando aplicavel. Tags nao substituem dado clinico
  ou permissao.
- **Portal do paciente**: ativacao por convite, estado de acesso, reenvio,
  revogacao, ultimo acesso, preferencias de comunicacao e aceites existentes.
  Nunca exibir token, URL secreta permanente ou credencial na tela cadastral.
- **Dados fiscais**: CPF ou identificacao do pagador ficam opcionais e em
  bloco separado, com finalidade explicita para recibo/documento quando
  aplicavel. Pagador pode ser diferente do paciente; profissionais sem
  permissao financeira nao leem esse bloco.
- Validar formato no cliente e no servidor, normalizar telefone/e-mail sem
  perder o valor exibido, indicar campos faltantes e manter salvamento
  explicito por secao. Falha de validacao nao pode apagar edicoes locais.
- Oferecer deteccao de possivel duplicidade apenas dentro do mesmo tenant,
  baseada em identificadores normalizados e sem revelar cadastro de outra
  clinica. A fusao, se criada, exige revisao, auditoria e preservacao de
  documentos/versoes, nunca exclusao silenciosa.
- Arquivar/desativar o paciente em vez de exclusao imediata; os fluxos de
  retencao, exportacao e exclusao da Fase 118/119 permanecem a unica via para
  solicitacoes definitivas de dados.

### Resumo orientado a conduta

- Blocos priorizados: proxima consulta, pacientes sem retorno, plano publicado,
  formularios/check-ins pendentes, tarefa vencida, comunicacao falha e ultimo
  atendimento.
- Serie temporal de peso e medidas existentes, com seletor de metrica e tabela
  alternativa acessivel. Reutilizar a Fase 207; nao recalcular avaliacoes
  historicas no cliente.
- Resumo de adesao e sintomas apenas quando a fonte for um check-in, formulario
  ou registro identificado. Dado ausente deve aparecer como ausente, nunca como
  valor zero ou diagnostico.
- Filtro de periodo somente para leitura; a selecao nao altera dados clinicos.

### Linha do tempo de atendimentos

- Unificar, em ordem temporal e com filtros, consultas, evolucoes, planos
  publicados, questionarios respondidos, check-ins, antropometrias, documentos,
  anexos e eventos financeiros permitidos.
- Cada evento mostra tipo, data, autor, origem e atalho para o detalhe, sem
  duplicar o conteudo clinico criptografado na projecao da timeline.
- Consultas devem expor seus estados (`concluida`, `reagendada`, `falta`,
  `cancelada` ou `desmarcada`) e os documentos emitidos a partir delas.
- Busca e filtros por evento, periodo e responsavel; paginação server-side.

### Navegacao dos modulos ja entregues

- **Antropometria**: acessar a Fase 207 com historico, comparacao e grafico;
  preservar append-only, exclusao logica e snapshots de formula.
- **Formularios, anamnese e check-ins**: integrar Fases 170 a 176 no grupo de
  avaliacoes, com status, prazo, versao e acesso ao detalhe longitudinal.
- **Plano alimentar**: integrar Fase 216 e a futura Fase 234 no grupo Plano,
  deixando evidente qual versao esta publicada e o que esta em rascunho.
- **Materiais, tarefas e comunicacoes**: reutilizar modulos existentes como
  contexto de acompanhamento, sem criar segunda fonte de verdade.
- **Anexos**: reutilizar upload seguro da Fase 200, agora com categoria, origem
  e vinculo opcional a consulta, avaliacao ou documento.
- **Documentos e financeiro**: reutilizar Fases 208 e 209; nao oferecer
  documento ou acao financeira sem a permissao e o estado exigidos no dominio.

### Estados e responsividade

- Desktop em duas colunas: conteudo principal e contexto lateral estavel.
- Mobile em navegacao por abas/folhas, com cabecalho reduzido e acoes em menu
  contextual; nenhum painel clinico extenso deve ser comprimido numa tabela.
- Estados de carregamento, vazio, erro, sem permissao e sucesso para cada area.
- Foco visivel, teclado completo, ordem de leitura semantica, contraste e
  alvos de toque de 44 px.

## Fora do escopo deliberadamente

Os seguintes modulos exigem modelo clinico proprio, regras de retencao e
validacao mais profunda. Eles nao entram escondidos como campos genericos nesta
fase:

- exame laboratorial estruturado e evolucao por marcador;
- evolucao fotografica com consentimento, comparacao e retencao;
- suplementos, produtos, formulas manipuladas e orientacoes prescritivas;
- acompanhamento gestacional;
- pediatria, lactacao, terapia nutricional e recomendacao clinica por IA;
- atestado ou documento reservado a profissao/regulacao especifica.

## Incremento 1 - navegacao orientada a conduta

Entregue localmente em 2026-08-11. O prontuario deixou de expor onze abas no
primeiro nivel e passou a seis areas principais:

1. **Resumo**;
2. **Atendimentos**: evolucoes, historico e mensagens;
3. **Avaliacoes**: antropometria, formularios e check-ins;
4. **Plano**: acompanhamento, plano alimentar e materiais;
5. **Documentos**: documentos e anexos;
6. **Financeiro**, exibido somente a quem possui `agenda.financeiro.ler` e com
   atalho para a agenda, que continua sendo a fonte de verdade de consultas,
   pacotes, pagamentos e recibos.

As acoes rapidas do cabecalho continuam abrindo a subarea correta. Nenhum
contrato clinico, regra de dominio, integracao ou permissao foi relaxado. A
nova navegacao foi coberta na regressao mockada, inclusive o caso em que o
financeiro nao deve ser exibido sem permissao.

Validacoes do incremento:

```powershell
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
git diff --check
```

Resultado: 14 cenarios de prontuario aprovados em desktop e mobile, lint e
typecheck aprovados. A Fase 235 permanece em execucao: projecao BFF/timeline
paginada, cadastro progressivo, categorizacao de anexos e validacao clinica
ainda nao foram entregues.

## Incremento 2 - timeline paginada de metadados

Auditoria concluida em 2026-08-11. O endpoint atual nao carrega o historico
inteiro: ele limita cada fonte e devolve no maximo 80 eventos combinados. Isso
evita uma leitura ilimitada, mas nao oferece cursor, filtros server-side ou
uma ordenacao global reutilizavel entre as sete origens.

Tambem foi identificado que a projecao anterior ainda descriptografava conteudo
de evolucoes e mensagens para preencher a descricao de cartoes. Esse ponto foi
substituido em 2026-08-11 por `GET /pacientes/:id/prontuario/timeline`, uma
leitura dentro de `ExecutorTenant` que agrega apenas metadados de consultas,
formularios, check-ins, mensagens, evolucoes e tarefas. A leitura preserva o
escopo de responsavel do profissional, registra auditoria e nao seleciona
campos criptografados de conteudo.

O contrato usa cursor opaco com ordenacao deterministica por `data DESC, id
DESC`, limite padrao de 20 e teto de 50 eventos. O BFF autenticado entrega essa
pagina exclusivamente para a subarea Historico, que permite carregar eventos
anteriores sem usar offset nem recorrer a descricao descriptografada do
prontuario legado. Falha, vazio e carregamento possuem estado proprio e a
primeira pagina nunca volta a expor o texto de mensagens ou evolucoes.

Validacoes do incremento:

```powershell
pnpm --dir octaclin-backend test -- servico-pacientes.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --project=mobile-chromium --reporter=list
```

Resultado: 35 testes unitarios do servico de pacientes e 14 cenarios visuais do
prontuario foram aprovados. Cadastro progressivo, filtros de timeline, atalhos
para detalhe, categorizacao de anexos e validacao clinica permanecem pendentes.

## Incremento 3 - cadastro inicial orientado por secoes

Entregue em 2026-08-11 sem alterar o modelo persistido. O modal de paciente
passou a organizar o contrato existente em tres secoes: **Identificacao**
(nome completo e data de nascimento), **Contato** (e-mail ou telefone) e
**Responsavel e acompanhamento** (profissional, situacao e indicador de risco
somente na edicao). Depois da criacao, a interface informa o proximo passo real:
usar o convite existente na lista para ativar o portal com link seguro.

Esta etapa nao introduz campos decorativos sem origem de dados. Nome de uso,
telefone e e-mail estruturados, canal preferido, endereco, representante,
origem, tags, dados fiscais e preferencias de comunicacao requerem um contrato
de dados, permissao, criptografia, auditoria e migration dedicados antes de
entrarem no cadastro. Dados clinicos continuam nos modulos clinicos apropriados.

Validacoes: `pnpm --dir octaclin-web lint`, `pnpm --dir octaclin-web typecheck`
e `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "lista de pacientes operacional" --project=desktop-chromium --project=mobile-chromium --reporter=list`.
Resultado: dois cenarios aprovados, cobrindo a abertura do cadastro e as secoes
em desktop e celular.

## Incremento 4 - filtros server-side da timeline

Entregue em 2026-08-11. A subarea Historico agora filtra por um tipo de evento
e por periodo. O filtro chega ao endpoint paginado como DTO validado, e a
consulta aplica as condicoes antes do limite e do cursor. O cursor continua
ordenado por `data DESC, id DESC`, portanto carregar eventos anteriores preserva
o mesmo recorte sem usar offset.

O BFF autenticado encaminha somente `cursor`, `limite`, `tipo`, `inicio` e
`fim`; datas invertidas sao recusadas. A consulta continua dentro de
`ExecutorTenant`, preservando RLS, o escopo do profissional e a auditoria de
leitura. Nenhum conteudo criptografado foi acrescentado ao contrato.

Validacoes: `pnpm --dir octaclin-backend test -- servico-pacientes.spec.ts
--runInBand`, typechecks backend/web, lint e a regressao de 14 cenarios do
prontuario em desktop e mobile. A cobertura inclui a troca de tipo no filtro e
confirma que a lista exibida muda conforme a resposta do servidor.

## Incremento 5 - atalhos contextuais da timeline

Entregue em 2026-08-11. Cada evento da timeline possui uma acao de detalhe.
Consultas levam para a agenda, que mantem a fonte de verdade operacional;
evolucoes, tarefas, mensagens, formularios e check-ins abrem a subarea correta
do prontuario. A troca interna reutiliza a protecao contra perda de edicao ja
existente, em vez de navegar silenciosamente para longe de um rascunho.

Validacoes: lint, typecheck e 14 cenarios do prontuario em desktop/mobile. A
regressao filtra uma evolucao e confirma a abertura de sua subarea de detalhe.

## Incremento 6 - leitura categorizada de anexos

Entregue em 2026-08-11. A subarea Anexos passa a filtrar os arquivos privados
ja confirmados por exame, documento, foto ou diario, exibindo contagens e um
estado vazio que diferencia categoria sem arquivos de paciente sem anexos. O
campo de envio foi renomeado para `Categoria do novo anexo`, evitando ambiguidade
para leitores de tela e automacao.

O arquivo continua privado, confirmado antes de aparecer e acessado somente por
URL assinada apos autorizacao. Vinculo opcional a consulta, avaliacao ou
documento ainda exige contrato de dados e nao foi simulado nesta entrega.

## Incremento 7 - resumo orientado a proxima conduta

Entregue em 2026-08-11. O resumo do prontuario passa a destacar uma unica
proxima conduta acionavel, priorizando tarefa pendente, formulario pendente,
proxima consulta e, por ultimo, o registro de evolucao. Um segundo cartao exibe
a proxima consulta ou orienta o uso da agenda quando nao houver encontro
agendado.

A prioridade deriva apenas de contadores e eventos ja existentes; nao calcula
score novo, adesao implicita ou diagnostico. O atalho abre a subarea adequada e
continua submetido a protecao contra perda de rascunho.

## Sequencia posterior obrigatoria

### Fase 236 - Exames laboratoriais e evolucao fotografica

Registros estruturados por coleta, marcador, unidade, referencia, anexo e
serie temporal; fotos por protocolo, consentimento separado, armazenamento
privado, politica de retencao e comparacao segura. Nenhuma interpretacao ou
diagnostico automatico.

### Fase 237 - Prescricoes, metas e orientacoes terapeuticas

Biblioteca da clinica e prescricao versionada de metas, suplementos, produtos,
formulas manipuladas e orientacoes. Requer revisao do escopo permitido por
profissao, autoria, validade, confirmacao de leitura e historico imutavel.

### Fase 238 - Acompanhamento gestacional especializado

Modulo opt-in, com protocolo de dados, limites de uso, consentimentos, curvas e
conteudo validados por responsavel clinico. Nao reutilizar formulas ou alertas
de adulto generico.

### Fase 239 - Validacao clinica e de usabilidade do prontuario

Jornadas sinteticas de primeira consulta, retorno, ajuste de plano, documento,
pagamento, formulario e acesso do paciente. Teste com profissionais antes de
expandir a superficie de mudancas clinicas.

## Arquitetura tecnica proposta

### Projecao de resumo e timeline

- Criar um caso de uso de leitura que agrega somente metadados autorizados dos
  modulos existentes. Ele nao descriptografa conteudo completo para montar
  cartoes e nao faz consultas N+1.
- Definir contrato BFF explicito para cabecalho, resumo, timeline, filtros e
  links de detalhe. Nenhum identificador interno de outro tenant ou dado do
  portal deve entrar no contrato.
- Paginar no servidor, ordenar por instante do evento e usar cursores estaveis
  com desempate deterministico por identificador quando houver mesma data.
- Adicionar indices somente depois do plano de consulta confirmar necessidade;
  benchmark deve medir leitura de resumo e timeline em massa sintetica.

### Autorizacao e auditoria

- Reutilizar `ExecutorTenant`, RLS forcada e as permissoes existentes de cada
  dominio. A timeline nao se torna um atalho para ler modulo que o papel nao
  pode abrir.
- Acesso por Professional limitado ao proprio contexto; Client permanece no
  portal da clinica e Patient apenas no portal do paciente. Excecao de leitura
  transversal continua exclusiva de SuperAdmin e deve ficar identificada na UI.
- Leitura de dados clinicos sensiveis, download de anexo e emissao/cancelamento
  de documento seguem a auditoria ja existente ou ganham evento equivalente.

### Dados e imutabilidade

- Nenhum evento da timeline duplica ou reescreve a fonte original.
- Planos publicados, avaliacoes antropometricas e documentos emitidos mantem as
  invariantes append-only/imutaveis ja entregues.
- Anexos continuam em armazenamento privado; a interface usa URL assinada de
  curta duracao e nunca URL publica persistente.

### Cadastro e limites de dados

- Separar DTOs e rotas de contato, acesso, clinica e financeiro; uma tela
  comum nao autoriza leitura/escrita de todos os grupos.
- Aplicar RLS forcada, auditoria de leitura/escrita de dado fiscal sensivel e
  permissoes de campo no BFF. `Professional` so administra pacientes do proprio
  contexto; excecao transversal continua exclusiva de `SuperAdmin`.
- Preservar compatibilidade com pacientes existentes: campos novos sao nulos ou
  opcionais, migram sem inventar valores e nao bloqueiam leitura do prontuario.
- O portal recebe somente nome de uso apropriado, contato necessario e estado
  de acesso; nunca CPF, anotacoes internas, tags administrativas ou dados de
  outro responsavel.

## Plano de execucao

1. Auditar contratos, permissoes, indices e componentes atuais; registrar uma
   matriz de origem para cada card/evento.
2. Desenhar desktop e mobile no Penpot, inclusive vazio, erro, carregamento,
   permissao negada e dados incompletos.
3. Implementar a projecao de resumo/timeline e contratos BFF de leitura.
4. Implementar cabecalho, navegacao, filtros, acoes rapidas e deep links para
   as telas existentes, sem mover regras de dominio para o frontend.
5. Implementar o cadastro progressivo, os contratos separados, qualidade de
   dados, ativacao do portal e bloco fiscal opcional, preservando os pacientes
   existentes.
6. Categorizar anexos e conectar seus links aos eventos de consulta/avaliacao
   quando a fonte ja permitir esse relacionamento.
7. Executar testes de tenant/RLS, autorizacao por papel, regressao dos modulos
   existentes, acessibilidade, screenshots desktop/mobile e benchmark.
8. Liberar em staging com dados sinteticos; fazer aceite com profissional e
   somente entao habilitar em producao de forma progressiva.

## Criterios de aceite

- O profissional abre um paciente e encontra proxima conduta, plano atual,
  consulta, pendencias e ultima evolucao sem buscar em modulos diferentes.
- A timeline apresenta eventos dos modulos autorizados em ordem estavel, com
  filtros e paginacao, sem duplicar conteudo ou causar N+1 mensuravel.
- Antropometria, formularios/check-ins, plano, anexos, documentos e financeiro
  abrem seus detalhes existentes e preservam suas regras de dominio.
- Um Professional nao ve pacientes ou dados financeiros de outro profissional;
  Patient nunca recebe score, anotacao interna, financeiro ou metadados de
  outros modulos clinicos.
- SuperAdmin ve de forma explicitamente identificada somente o painel que esta
  autorizado a acompanhar.
- Cadastro divide dados de contato, operacao, portal e fiscal; profissional sem
  permissao financeira nao le identificacao do pagador; portal nao recebe dado
  interno ou fiscal.
- Cadastro de paciente existente abre sem perda de dados; duplicidade potencial
  nao cruza tenant e arquivamento nao apaga documento, avaliacao ou historico.
- Desktop e mobile passam testes de foco, teclado, leitor de tela, contraste e
  estados vazios/erro/carregamento.
- Jornadas mutaveis permanecem em staging; producao recebe apenas rollout
  aprovado e com backup/preflight conforme os runbooks.

## Validacao prevista

```powershell
pnpm --dir octaclin-backend test
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:a11y
pnpm --dir octaclin-web build
git diff --check
pnpm security:secrets
```

## Referencias de produto

- A organizacao de acompanhamento, avaliacoes, historico, planejamento,
  documentos e financeiro observada no WebDiet foi usada somente como referencia
  funcional e visual. Nenhum dado, texto clinico ou interface sera copiado.
- Capacidades existentes do OctaClin: Fases 170 a 176, 200, 207 a 209, 216 e
  234.
