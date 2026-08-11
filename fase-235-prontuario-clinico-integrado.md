# Fase 235 - Prontuario clinico integrado e navegacao orientada a conduta

Status: planejada. Fase importante de produto e UX, posterior ao piloto
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
  quando houver dados suficientes para isso. Eventos com mesma data precisam de
  desempate deterministico.
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

## Plano de execucao

1. Auditar contratos, permissoes, indices e componentes atuais; registrar uma
   matriz de origem para cada card/evento.
2. Desenhar desktop e mobile no Penpot, inclusive vazio, erro, carregamento,
   permissao negada e dados incompletos.
3. Implementar a projecao de resumo/timeline e contratos BFF de leitura.
4. Implementar cabecalho, navegacao, filtros, acoes rapidas e deep links para
   as telas existentes, sem mover regras de dominio para o frontend.
5. Categorizar anexos e conectar seus links aos eventos de consulta/avaliacao
   quando a fonte ja permitir esse relacionamento.
6. Executar testes de tenant/RLS, autorizacao por papel, regressao dos modulos
   existentes, acessibilidade, screenshots desktop/mobile e benchmark.
7. Liberar em staging com dados sinteticos; fazer aceite com profissional e
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
