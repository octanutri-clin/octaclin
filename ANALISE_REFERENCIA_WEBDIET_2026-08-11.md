# Analise de referencia WebDiet - 2026-08-11

## Metodo e limite

Revisao manual, autenticada e somente leitura do painel WebDiet autorizado pelo
proprietario da conta. Foram observados painel, navegacao de paciente, lista e
criacao de planejamentos alimentares, agenda e formularios de pre-consulta.
Nenhum dado clinico, identificador de paciente, anexo, credencial, exportacao
ou captura de tela foi incorporado a este repositorio.

O objetivo e aprender padroes de descoberta, fluxo e densidade operacional. O
OctaClin nao deve copiar textos, identidade visual, estrutura proprietaria ou
conteudo clinico de terceiros.

## Padroes observados

### Painel de entrada

- Pacientes recentes, busca ampla e criacao de paciente ficam no primeiro
  bloco visual.
- Um planner paralelo concentra tarefas do profissional na mesma tela.
- A navegacao agrupa funcoes de consultorio, estudos, marketing, ferramentas e
  suporte, com atalhos para criacoes frequentes.

**Leitura para o OctaClin:** manter o dashboard como rotina clinica, nao como
pagina promocional. A primeira dobra deve trazer agenda do dia, pacientes que
exigem acao, tarefas e um comando de criacao; busca global e paleta da Fase 213
permanecem a forma de acessar o restante.

### Contexto do paciente

- Abrir um paciente preserva o contexto em um painel lateral de prontuario.
- A navegação contextual agrupa acompanhamento, avaliacoes, historico,
  questionarios, exames, antropometria, plano, metas, orientacoes, anexos,
  documentos e financeiro.
- O planejamento alimentar abre no mesmo contexto, em vez de levar o usuario a
  uma area global sem paciente selecionado.

**Leitura para o OctaClin:** evoluir o cabecalho persistente do prontuario para
um workspace clinico: paciente, profissional responsavel, proxima acao,
situacao e atalhos permanecem visiveis; as abas devem ser agrupadas por tarefa
e reduzir exposicao simultanea de informacao. O contexto nao pode expor dados
de outro profissional ou tenant.

### Planejamento alimentar

- A lista de prescricoes e escaneavel e oferece acoes por item: visualizar,
  editar, duplicar, favoritar, gerar PDF, organizar/periodizar e excluir.
- A criacao pede primeiro o nome e o modo de prescricao: alimentos,
  equivalentes ou qualitativa. Essa escolha inicial reduz ambiguidade antes de
  expor o editor completo.

**Leitura para o OctaClin:** o modelo versionado da Fase 216 deve ganhar uma
entrada em etapas: objetivo/nome, modo de montagem, refeicoes, itens,
substituicoes, revisao clinica e publicacao. Rascunho, revisao e versao
publicada precisam ser estados visiveis; duplicacao e PDF so devem aparecer
quando a politica de permissao e o estado permitirem. O calculo do OctaClin
continua server-side e exige revisao humana, independentemente da interface.

### Agenda

- O calendario tem visoes mes, semana e lista, navegacao temporal e destaque de
  hoje.
- A barra lateral separa calendarios, configuracoes do calendario, Google,
  bloqueios, faixa de horario e exportacao.
- Eventos externos sao mostrados como indisponibilidade no grid, enquanto a
  legenda comunica modalidade de atendimento.

**Leitura para o OctaClin:** preservar a agenda interna como fonte de rotina
mesmo sem Google. A conexao Google deve ficar como integracao por profissional,
nao como requisito para exibir a agenda. Cada consulta precisa exibir origem,
estado, paciente, local/modalidade e acoes clinicas sem vazar detalhes de
eventos externos.

### Formularios e pre-consulta

- A area separa pre-anamnese, questionarios de saude e formularios
  personalizados.
- A criacao comeca por uma decisao simples entre texto livre e questionario
  padronizado; a lista oferece compartilhamento, edicao e duplicacao.

**Leitura para o OctaClin:** a arquitetura existente de biblioteca, editor,
versao e leitura longitudinal deve ganhar uma entrada clara por intencao:
`usar modelo`, `criar do zero` ou `duplicar`. Distribuicao e respostas ficam
em superficies separadas do editor, com rascunho, versao publicada, pendencia e
erros de envio visiveis.

## Melhorias priorizadas para o OctaClin

1. **Workspace do paciente e plano alimentar:** tornar o prontuario a base de
   trabalho, com contexto persistente e fluxo de plano em etapas. Alto impacto
   para demonstracao comercial e uso diario.
2. **Agenda de rotina:** consolidar visoes, legenda, bloqueio manual, eventos
   externos e painel de detalhes sem depender de Google conectado.
3. **Editor e distribuicao de formularios:** separar escolha de modelo,
   estrutura, preview, publicacao, compartilhamento e leitura clinica.
4. **Dashboard profissional:** reduzir blocos decorativos e tornar os dados de
   hoje acionaveis por meio de uma hierarquia fixa: agenda, prioridades,
   pendencias e criacao rapida.
5. **Portal do paciente:** usar linguagem orientada a proxima acao e evitar
   reproduzir o console do profissional em miniatura.

## Direcao visual

- Manter o design system do OctaClin: superfícies claras, tipografia legivel,
  densidade clinica, foco visivel, estados consistentes e navegacao por papel.
- Evitar reproduzir a barra de marketing, banners de venda, excesso de menus e
  modais tutoriais concorrentes observados na referencia.
- Cada melhoria deve ter desktop, mobile, vazio, carregamento, erro, sucesso e
  permissao negada antes de ser considerada concluida.

## Proposta de execucao posterior

Criar um bloco de melhoria visual depois da Fase 225, sem atrasar dominio e
juridico:

1. Workspace de prontuario e plano alimentar.
2. Agenda clinica visual e bloqueios internos.
3. Formularios, biblioteca e distribuicao.
4. Dashboard e portal do paciente.
5. Validacao visual, acessibilidade e jornadas desktop/mobile.

Cada fase desse bloco deve reutilizar componentes atuais, validar permissoes e
ser comparada com o Penpot antes de deploy.
