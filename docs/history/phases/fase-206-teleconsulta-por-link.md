# Fase 206 - Teleconsulta por link na consulta

Status: concluida em 2026-08-04. O repositorio tinha zero ocorrencia de
teleconsulta, video ou meet: a consulta simplesmente nao tinha modalidade.
Agora tem, com link de sala externa, entrega do link nas mensagens e exibicao
controlada por janela no portal do paciente.

Escopo deliberadamente pequeno: **nao foi construida plataforma de video**.
Registrado como ADR-020 em `DECISOES_ARQUITETURA.md` para nao ser reaberto.

## Entregue

### Dominio (`agenda/dominio/teleconsulta.ts`)

Modulo puro com a regra toda:

- `normalizarModalidadeConsulta`: qualquer valor desconhecido vira
  `presencial`. Dado antigo e dado corrompido caem no lado seguro.
- `linkTeleconsultaValido`: aceita **apenas `https`**, ate 500 caracteres.
  `http` abre espaco para downgrade e `javascript:`/`data:` virariam execucao
  de script no portal — o link e clicado por paciente leigo.
- `linkTeleconsultaDisponivel` / `linkTeleconsultaParaPaciente`: janela de 1h
  antes do inicio ate 30min depois do fim, so para consulta `agendada` ou
  `reagendada`.

A janela e generosa nas duas pontas de proposito: paciente que chega cedo nao
fica sem link, e consulta que estende dez minutos nao derruba ninguem.

### Migration (`1720000001015-AdicionarTeleconsultaAgenda`)

`agenda_consultas` ganha `modalidade varchar(20) NOT NULL DEFAULT 'presencial'`
e `link_teleconsulta text`. Duas CHECK constraints:

- `modalidade IN ('presencial', 'online')`
- `modalidade = 'online' OR link_teleconsulta IS NULL`

A segunda trava no banco a mesma invariante que o servico aplica: consulta
presencial nunca carrega sala de video. Sem ela, um toggle de modalidade
deixaria link pendurado e o painel do paciente ofereceria "entrar na consulta"
para um atendimento de consultorio.

### Servico de agenda

`resolverTeleconsulta` concentra a decisao em criacao e remarcacao: se a
modalidade final e presencial, o link e descartado; se e online e o campo nao
veio na requisicao, o link atual e preservado. Isso permite remarcar horario
sem reenviar o link e trocar para presencial sem deixar residuo.

O link acompanha:

- o texto da mensagem de confirmacao (`montarTextoMensagem`);
- o payload da notificacao (`linkTeleconsulta` + `modalidade`), inclusive como
  parametro nomeado de template WhatsApp;
- a descricao do evento no Google Agenda do profissional (`Sala online: ...`).

`linkParaEnvio` bloqueia o link em cancelamento: mensagem de consulta cancelada
nao leva sala.

### Lembrete de 24h

`ServicoLembretesAgenda` aplica a mesma regra, reusando o dominio. Consulta
online entra no lembrete com o link no corpo e no payload; presencial nao.

### Portal do paciente

`consultasProximas` passa a expor `modalidade` e `linkTeleconsulta`. O link so
sai do backend dentro da janela — fora dela o campo nem e serializado, nao e
escondido no frontend. Consulta online sem link visivel mostra "O link para
entrar aparece aqui 1 hora antes do horario"; com link, botao **Entrar na
consulta**.

### Painel da agenda

Seletor de modalidade. Presencial mostra **Local**; online troca o campo por
**Link da sala** (`type="url"`) com texto de ajuda via `aria-describedby`.
Consulta online listada mostra o link com botao de copia rapida, no card e no
modal de detalhes. Remarcacao permite trocar modalidade e link.

## Decisoes tomadas no caminho

- **Link no Google Agenda: sim.** E o calendario do proprio profissional, que
  ja carrega nome do paciente e observacoes clinicas — mesma fronteira de
  confianca. E e de onde o profissional realmente clica para entrar.
- **Link em log e auditoria: nao.** Nenhum caminho novo grava o link em
  `user_action_log` nem em logger.
- **Modalidade e dado da consulta, nao do paciente.** O mesmo paciente alterna
  entre presencial e online sem nenhum flag de cadastro.
- **Sem campo obrigatorio.** Consulta online pode ser criada sem link e receber
  o link depois pela remarcacao; e o fluxo real de quem gera a sala na vespera.
  O portal explica a ausencia em vez de mostrar botao quebrado.

## Revisao de seguranca

`ecc:security-reviewer` executada sobre todos os caminhos novos. Sem achado
critico. Confirmou que a validacao `https` esta em tres camadas (DTO, dominio
antes de gravar, dominio antes de renderizar `href`), que o `href` no portal e
no painel nao aceita `javascript:`/`data:`, que os dois caminhos de bypass
suspeitos (aprovacao de agendamento publico e sincronizacao do Google) nunca
populam `linkTeleconsulta` e caem no valor ja validado, e que nenhum logger ou
`ServicoAuditoria.registrar` recebe o link.

### Achado alto corrigido: rota de desmarcar devolvia a resposta do console

`POST /portal/paciente/consultas/:id/desmarcar` chamava
`desmarcarConsultaPeloPaciente`, que devolvia o `ConsultaAgendaRespostaDto`
inteiro — o mesmo objeto do console do profissional. Isso entregava ao paciente
o `linkTeleconsulta` cru (sem passar pela janela, e mesmo com a consulta ja
cancelada), alem do `payload` com `emailContato`, `whatsappContato`,
`profissionalNome`, `textoMensagem` e os ids do Google Calendar.

O escopo estava correto (o paciente so alcanca a propria consulta), mas a
resposta era larga demais para o unico metodo de agenda exposto ao paciente.
Corrigido na origem: o metodo passa a devolver `{ id, status }`. O cliente web
ja ignorava o corpo (`desmarcarConsultaPaciente` retorna `void`), entao nao
houve mudanca de comportamento visivel. Teste de regressao serializa a resposta
e afirma que nem o link nem o email aparecem nela.

Vale registrar que a exposicao de `payload` era anterior a esta fase; a
teleconsulta so tornou o problema mais caro por adicionar um campo sensivel ao
mesmo DTO.

### Achado medio aceito: link no historico de mensagens do portal

O texto da confirmacao e do lembrete contem o link, e esse texto e persistido em
`MensagemNotificacaoOrm` e devolvido em `mensagensRecentes` sem janela. Aceito
deliberadamente:

- o historico do portal e a **copia do que foi enviado** ao paciente por email e
  WhatsApp. Censurar a copia faria o portal divergir da caixa de entrada, e e
  justamente onde paciente e recepcao vao procurar "me manda o link de novo";
- o link ja saiu do sistema no momento do agendamento. Tratar o campo
  estruturado como segredo enquanto a mesma string esta no email do paciente
  seria seguranca de fachada.

A consequencia foi escrita no ADR-020: a janela e reducao de superficie e
clareza de interface, nao segredo. Quem precisa de sala privada usa o controle
do proprio provedor (codigo de sala, sala de espera) — nao ha como o OctaClin
proteger um endereco que ele mesmo envia por WhatsApp.

## Nao feito

- **Sala persistente por profissional.** Um link fixo por profissional evitaria
  colar link a cada consulta, mas cria colisao quando duas consultas se
  sobrepoem e exige politica de sala de espera. Fica para quando houver
  reclamacao real de digitacao repetida.
- **Validacao de dominio da sala** (aceitar so meet/zoom/whereby). Clinica que
  usa Jitsi proprio ou Teams seria bloqueada por uma lista que ninguem pediu.
  `https` e o unico filtro.
- **Gravacao, sala de espera, presenca.** Sao recursos de plataforma de video;
  ver ADR-020.
- **Link no fluxo de agendamento publico** (`servico-agendamento-publico.ts`).
  A solicitacao publica gera consulta pelo caminho interno e herda o padrao
  presencial; o profissional troca a modalidade na aprovacao. Nao foi exposta
  escolha de modalidade para quem ainda nao e paciente.

## Validacao local

- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-backend test --runInBand`: 475/475 aprovados
  (18 novos: 10 de dominio de teleconsulta, 1 de migration, 5 de servico de
  agenda — incluindo a regressao do achado alto —, 2 de lembretes).
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- `playwright test` (suite completa): 136/136 aprovados, incluindo o teste novo
  "agenda troca local por link de sala ao marcar a consulta como online" e as
  assercoes de janela no portal dentro de `jornadas-criticas`.
