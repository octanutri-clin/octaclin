# Relatorio de seguranca - PR 42

Data: 2026-08-30

## 1. Objetivo e risco

O PR 42 prova e endurece a autorizacao de objeto e de funcao contra BOLA,
BFLA, IDOR e mass assignment. O escopo e R5 porque envolve dados clinicos,
carteira profissional, papeis e sessoes autenticadas.

Nao ha migration, alteracao de RLS, operacao em provider ou deploy neste PR.
O inventario integral de policies PostgreSQL permanece reservado ao PR 43.

## 2. Metodo

A revisao seguiu caminho exploravel `entrada -> controle -> recurso`, com:

- inventario dos guards JWT, papeis e capabilities;
- confronto entre a matriz de permissoes e o escopo de dados por papel;
- busca por identificadores de paciente/profissional recebidos em rotas;
- testes cruzados de tenant e carteira profissional existentes;
- RED antes da correcao para cada bypass confirmado;
- testes positivos e negativos depois da correcao;
- validacao do `ValidationPipe` global contra campos nao declarados.

Somente dados sinteticos foram usados.

## 3. Matriz role x capability x recurso

| Papel | Capabilities representativas | Escopo de recurso | Controle server-side |
| --- | --- | --- | --- |
| SuperAdmin | `profissionais.gerenciar`, `operacoes.auditoria.ler` | tenant inteiro | tenant do JWT; selecao explicita de profissional no dashboard |
| Professional | `pacientes.gerenciar`, `comunicacoes.mensagens.enviar` | pacientes sob sua responsabilidade | vinculo `usuarios.id -> profissionais.usuario_id` e `profissional_responsavel_id` |
| Collaborator | `pacientes.ler`, `comunicacoes.mensagens.enviar` | operacional delegado no tenant | tenant do JWT e capabilities sem gestao clinica |
| Patient | `portal.acessar`, `portal.questionarios.responder` | proprio paciente | vinculo do usuario autenticado ao paciente |
| Client | `cliente.acessar`, `cliente.usuarios.gerenciar` | conta cliente | tenant do JWT e regras administrativas do cliente |

A matriz e executavel em `modulos/auth/dominio/permissoes.spec.ts`. A troca de
painel continua exclusiva de SuperAdmin: Professional ignora qualquer
`profissionalId` recebido e e forcado ao proprio perfil; SuperAdmin precisa
selecionar um profissional existente no tenant.

## 4. Achados confirmados e correcoes

### 4.1 BOLA na central de comunicacoes

**Antes:** as mutacoes `POST /comunicacoes/mensagens`,
`POST /comunicacoes/whatsapp/associar-contato` e
`POST /comunicacoes/whatsapp/notas` verificavam somente `tenantId` e
`pacienteId`. Um Professional com capability valida podia informar o ID de um
paciente de outro profissional do mesmo tenant.

**RED:** tres testes demonstraram que disparo, associacao e nota resolviam em
vez de rejeitar o paciente alheio.

**Correcao:** o controller encaminha a identidade autenticada e o servico
resolve o profissional server-side. Para Professional, a consulta do paciente
inclui `profissionalResponsavelId`. A associacao tambem deixa de reatribuir ao
Professional mensagem ja vinculada a outro paciente.

Fluxos internos de agenda e automacoes usam uma entrada separada e explicita,
`dispararMensagemSistema`, depois de validarem o recurso de origem. Nenhum
endpoint HTTP chama essa entrada.

**GREEN:** Professional consegue operar paciente proprio e recebe resposta de
recurso inexistente para paciente de outro profissional; nenhum registro de
mensagem ou outbox e criado na negativa.

### 4.2 BFLA apos alteracao ou remocao de acesso

**Antes:** desativar usuario marcava `usuarios.ativo=false`, mas nao revogava
refresh tokens nem `sessoes_usuario`. A troca de papel revogava apenas refresh
tokens. Um access token ja emitido permanecia aceito enquanto a sessao estivesse
ativa.

**RED:** os testes provaram ausencia de atualizacao de `sessoes_usuario` na
troca de papel e ausencia de revogacao de refresh/sessao na desativacao.

**Correcao:** revogar convite, desativar usuario e alterar papel revogam, na
mesma transacao, refresh tokens e todas as sessoes ainda ativas. O motivo
persistido e `acesso_alterado`, sem migration porque a coluna existente e
`varchar`.

**GREEN:** os testes verificam as duas revogacoes e o filtro
`revogadoEm IS NULL`.

### 4.3 Mass assignment

O `ValidationPipe` global ja possuia `whitelist`, `forbidNonWhitelisted` e
`transform`, mas nao havia prova executavel especifica. A configuracao foi
extraida sem mudanca de comportamento para `criarPipeValidacaoHttp`.

O gate rejeita, entre outros:

- `tenantId` injetado em atualizacao de paciente;
- `usuarioId` injetado em atualizacao de profissional;
- `permissoes` injetadas em disparo de mensagem.

Um payload composto apenas por campos declarados continua aceito e
transformado.

## 5. Controles preservados e contraevidencias

- tenant continua derivado do JWT, nao do corpo da requisicao;
- guards de papel e capability permanecem nos controllers;
- pacientes, agenda, questionarios, materiais, planos e prontuario ja possuem
  testes negativos de tenant/carteira e nao apresentaram bypass novo neste
  ciclo;
- a troca de contexto do dashboard continua restrita a SuperAdmin e auditada;
- a entrada de sistema para comunicacoes nao e exposta por controller;
- nao foi identificada atribuicao de `role`, `tenantId`, `usuarioId` ou
  `permissoes` a partir de campo nao declarado aceito pelo HTTP.

## 6. Validacoes

O conjunto direcionado cobre comunicacoes, agenda, automacoes, documentos
clinicos, usuarios do cliente, matriz de permissoes e pipe HTTP.

- PASS - 8 suites direcionadas, 119 testes;
- PASS - matriz de permissoes e usuarios do cliente, 24 testes;
- PASS - suite backend completa: 165 suites e 1.266 testes;
- SKIPPED - 4 suites e 28 testes de integracao que exigem infraestrutura
  externa, conforme configuracao da propria suite;
- PASS - typecheck e build do backend, incluindo verificacao de `dist/main.js`;
- PASS - `octaclin-web test:authz`; todos os nove grupos terminaram sem falha;
- PASS - `security:secrets`, `test:confiabilidade`, `validate:docs` e
  `git diff --check`;
- PENDENTE - checks do GitHub, review humano e merge;
- NA - migration, Postgres real, staging, producao e integracoes externas.

O gate web foi executado neste host com Node 24.18.0 e emitiu aviso de engine,
pois o projeto fixa Node 22. A execucao terminou com exit code 0; o CI continua
sendo a evidencia no runtime suportado.

## 7. Riscos residuais

- o isolamento por policy PostgreSQL de todas as tabelas tenant-scoped sera
  provado no PR 43;
- `Collaborator` conserva o escopo operacional delegado no tenant definido na
  matriz atual; uma mudanca desse produto exige decisao separada;
- a associacao manual de contato WhatsApp continua um ato clinico auditado; o
  Professional somente pode escolher paciente da propria carteira e nao pode
  reatribuir mensagem ja vinculada a outro paciente;
- chamadas internas com escopo integral dependem de servicos de origem
  autenticados ou jobs controlados e devem permanecer fora de controllers.

## 8. Rollback

Reverter o commit restaura as assinaturas anteriores e o comportamento das
mutacoes. Nao ha schema ou dado para desfazer. O rollback reabre os dois
bypasses confirmados e, portanto, so deve ocorrer acompanhado de bloqueio das
rotas afetadas.
