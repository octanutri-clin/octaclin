# Fase 259 - Acesso, convite e ativação sem suporte manual

Status: em andamento, iniciada em 2026-09-11.

## Objetivo (roadmap)

`CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: revisar login, primeiro acesso,
recuperação, convite, troca de senha, expiração, aceites legais e mensagens
de conta bloqueada ou sem permissão. Manter API e tenant fora do fluxo
comercial cotidiano e validar os quatro papéis (SuperAdmin, Professional,
Collaborator, Patient/Client) com isolamento e redirecionamento corretos.

## Auditoria do estado atual (antes de qualquer mudança)

O módulo `auth` é maduro e bem coberto por testes:

- **Login + credencial**: `ServicoAuth.login()` resolve tenant por slug
  (nunca aceita `tenantId` do cliente), verifica senha, aplica rate-limit
  por `(tenantSlug,email)` e grava trilha de auditoria deduplicada.
- **MFA**: obrigatório por capability (intersecção com
  `PERMISSOES_PRIVILEGIADAS`), não por nome de papel. Configuração,
  confirmação, remoção e códigos de recuperação, todos atrás de
  reautenticação obrigatória.
- **Recuperação de senha**: `ServicoRecuperacaoSenha` — mensagem genérica
  anti-enumeração, token `tenantId.segredo` expira em 1h, revoga todas as
  sessões do usuário ao trocar a senha.
- **Primeiro acesso/convite administrativo (staff)**: vive em
  `ServicoUsuariosCliente` (módulo `clientes`), reaproveitando a mesma
  tabela `TokenRedefinicaoSenhaOrm` do reset de senha (diferenciado só por
  `payload.origem = 'convite_usuario_cliente'`) em vez de uma entidade de
  convite própria.
- **Convite/ativação de paciente**: entidade dedicada
  `ConvitePacienteOrm` + `ServicoConvitesPaciente`. `ativarConvite` exige
  aceite de termos/política/LGPD e grava em `ConsentimentoLgpdOrm`.
- **Sessão/expiração**: `ServicoSessoes` com rotação de refresh token e
  detecção de reuso.
- **Bloqueio/permissão negada**: usuário inativo recebe a mesma mensagem
  genérica de credencial inválida (decisão deliberada anti-enumeração).
  Autorização negada por papel/permissão usa `ForbiddenException`
  genérica, sempre auditada.
- **Redirecionamento por papel**: `destinosIniciais` fixo por papel no
  backend (`contextoAcessoPorPapel()`); middleware do frontend
  (`decidirAcessoRota()`) reforça isolamento por papel, mas a autorização
  real continua no backend (guards).

### Gaps identificados frente ao objetivo da fase

1. **Primeiro acesso de staff indistinguível de recuperação de senha**: o
   link de convite administrativo aponta para `/recuperar-senha`, que
   mostra "Redefinir senha" para alguém que nunca teve senha.
2. **Aceite legal assimétrico entre papéis**: só o convite de paciente
   exige aceite de termos/privacidade/LGPD. O convite de staff ativa a
   conta sem qualquer aceite.
3. **Duplicidade de mecanismo de convite**: paciente tem entidade própria
   com enum de status incluindo `expirado`; staff reaproveita a tabela de
   reset de senha e nunca usa esse valor (expiração é sempre calculada em
   runtime). Não é bug, é uma duplicação de conceito — candidata a
   unificação futura, fora do escopo desta rodada.
4. **Sem mensagem distinta de "conta bloqueada"**: por design deliberado
   anti-enumeração. Decisão de produto necessária antes de mexer.
5. **Sem página dedicada de "sem permissão" (403)**: hoje é redirect
   silencioso do middleware ou mensagem inline por página.

### Decisões de produto confirmadas com o dono do produto

- **Aceite legal no convite de staff**: sim, passa a exigir Termos de uso
  e Política de privacidade (sem o consentimento LGPD específico de dado
  clínico, que é só do paciente).
- **Mensagem de conta bloqueada**: mantém a mensagem genérica atual
  (recomendado) — preserva a proteção anti-enumeração já deliberada no
  código. Nenhuma mudança nesta fase.

## Plano de incrementos verticais

1. **Primeiro acesso de staff distinto de recuperação de senha.**
   Backend expõe a origem do token; frontend muda copy/título/CTA quando
   é primeiro acesso. Sem decisão de produto pendente — puramente técnico.
2. **Aceite legal obrigatório na ativação de convite de staff.** Termos
   de uso + Política de privacidade, gravados em `ConsentimentoLgpdOrm`
   (mesma tabela do paciente, mesmo `tipo`/`versao`). Decisão de produto
   confirmada acima.
3. **Aviso ao ser redirecionado por falta de permissão.** Em vez de uma
   página dedicada de "sem permissão" (403) — que trocaria o redirect
   silencioso atual, já seguro, por uma tela sem saída extra —, um aviso
   contextual explica o redirecionamento no próprio destino. Decisão de
   produto confirmada: preferir o aviso ao invés da página dedicada.
4. Candidato ainda não iniciado: unificação do mecanismo de convite
   (paciente vs. staff).

Este documento é atualizado a cada incremento com o que foi entregue,
arquivos tocados e validações.

Este documento é atualizado a cada incremento com o que foi entregue,
arquivos tocados e validações.

## Incremento 1 - primeiro acesso de staff distinto de recuperação de senha

Concluído em 2026-09-11.

### Implementação

- **Backend**: `ServicoRecuperacaoSenha.validarToken()` passa a devolver
  `origem?: string`, lida de `registro.payload.origem` (o mesmo campo já
  gravado por `ServicoUsuariosCliente` ao criar o convite administrativo).
  Nenhuma mudança de schema — `payload` já é `jsonb` na tabela
  `tokens_redefinicao_senha`.
- **Frontend**: `TokenRecuperacaoSenhaApi.origem` novo campo opcional.
  `RecuperarSenhaForm` deriva `ehPrimeiroAcessoStaff = origem ===
  'convite_usuario_cliente'` e troca título ("Ative sua conta" vs. "Nova
  senha"), rótulo do campo de senha, texto de sucesso e rótulo do botão
  ("Ativar conta" vs. "Redefinir senha") condicionalmente. Recuperação de
  senha comum (sem `origem`) mantém o comportamento e os textos
  exatamente como antes.

### Validações

- TDD: 2 testes novos em `servico-recuperacao-senha.spec.ts` (expõe
  origem quando presente; não expõe quando o token é de recuperação
  comum). RED confirmado por ausência do campo no tipo de retorno antes
  da implementação.
- `pnpm --dir octaclin-backend typecheck` e `build` — PASS
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros) e `build` — PASS
- 239 testes de `modulos/auth` — PASS (19 skipped, mesma limitação de
  ambiente das fases anteriores — integração com banco/Redis reais)
- `pnpm security:secrets`, `git diff --check` — PASS

## Incremento 2 - aceite legal obrigatório na ativação de convite de staff

Concluído em 2026-09-11.

### Decisão de produto (confirmada com o dono do produto)

Convite de Client/Professional/Collaborator passa a exigir aceite de
**Termos de uso** e **Política de privacidade** na ativação — mesma
obrigatoriedade que já existia só para o convite de paciente. Sem o
consentimento LGPD específico (esse é sobre tratamento de dado clínico
do titular, não se aplica a quem acessa a clínica como equipe).

### Implementação

- **Refatoração de escopo**: `documentos-legais-paciente.ts` (módulo
  `pacientes`) foi movido para `infraestrutura/lgpd/documentos-legais.ts`
  — a versão dos documentos legais nunca foi um conceito exclusivo de
  paciente, e agora dois módulos (`pacientes` e `auth`) precisam dele.
  `listarDocumentosLegaisPaciente` mantém o comportamento idêntico (3
  documentos, `perfil: 'paciente'`); `listarDocumentosLegaisStaff` novo
  devolve os 2 documentos aplicáveis (`perfil: 'staff'`), reaproveitando
  as mesmas variáveis de ambiente de versão
  (`OCTACLIN_TERMOS_USO_VERSAO`, `OCTACLIN_POLITICA_PRIVACIDADE_VERSAO`,
  `OCTACLIN_LEGAL_VERSAO`).
- **Backend**: `RedefinirSenhaDto` ganha `aceiteTermosUso`/
  `aceitePoliticaPrivacidade` opcionais. `ServicoRecuperacaoSenha.
  redefinirSenha()` passa a checar, quando o token é de primeiro acesso
  de staff (`origem === 'convite_usuario_cliente'`), que os dois aceites
  vieram `true` — senão `BadRequestException`. Ao concluir, grava 2
  linhas em `ConsentimentoLgpdOrm` (mesma tabela usada pelo paciente,
  `tipo`/`versao` idênticos — `tenant_id`/`usuario_id` sem CHECK
  restringindo o `tipo`, então não precisou de migration). Recuperação de
  senha comum não exige nem grava nada disso — `ehPrimeiroAcessoStaff`
  distingue os dois casos usando a mesma origem do Incremento 1.
- **Frontend**: quando `ehPrimeiroAcessoStaff`, `RecuperarSenhaForm`
  mostra 2 checkboxes (mesmo padrão visual do `PrimeiroAcessoForm` do
  paciente) antes do botão de ativar; ambos obrigatórios no cliente
  (mensagem de erro espelhando a validação do backend) e no servidor.
- Sem rota nova; sem migration.

### Validações

- TDD: 3 testes novos em `servico-recuperacao-senha.spec.ts` (recusa sem
  nenhum aceite; recusa com só um dos dois; grava os dois consentimentos
  e conclui quando ambos vêm `true`) + 1 teste de regressão (recuperação
  comum não exige nem grava aceite). RED confirmado pela ausência dos
  campos no DTO antes da implementação.
  Frontend: 1 teste Playwright novo
  (`acesso-ativacao.spec.mjs`, "primeiro acesso de staff exige aceite de
  termos e politica antes de ativar") cobrindo os 2 aceites parciais e o
  fluxo completo até o corpo exato enviado ao backend. RED confirmado
  neutralizando a validação client-side (`if (false && ...)`) antes de
  restaurar.
- `pnpm --dir octaclin-backend typecheck` e `build` — PASS
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros) e `build` — PASS
- 262 testes de `auth` + `servico-convites-paciente` +
  `controlador-convites-paciente` + `servico-usuarios-cliente` — PASS
  (19 skipped, mesma limitação de ambiente), confirmando que a
  refatoração do arquivo de documentos legais não regrediu o fluxo de
  paciente.
- 12/12 Playwright de `acesso-ativacao.spec.mjs` (desktop+mobile) +
  18/18 de `primeiro-acesso-paciente.spec.mjs` — PASS
- 10/10 Playwright do gate de acessibilidade de acesso público
  (`acessibilidade.spec.mjs`), incluindo 1 teste novo do estado de
  primeiro acesso de staff — PASS
- 17/17 Playwright de regressão (`jornadas-criticas.spec.mjs`,
  `sessoes-conta.spec.mjs`, `mfa-login.spec.mjs`) sem quebra
- `pnpm test:redacao-auditoria` (irrelevante aqui — `ConsentimentoLgpdOrm`
  não passa por `user_action_logs`, mas rodado por precaução),
  `pnpm --dir octaclin-web test:linguagem`, `pnpm security:secrets`,
  `git diff --check` — PASS

## Incremento 3 - aviso ao ser redirecionado por falta de permissão

Concluído em 2026-09-11.

### Decisão de produto (confirmada com o dono do produto)

Hoje, tentar acessar uma rota fora do próprio papel já redireciona em
silêncio para um destino válido do usuário (nunca uma tela sem saída) —
mas sem explicar por quê. Uma página dedicada de "sem permissão" (403)
trocaria esse redirect direto por um clique extra, sem ganho real. A
decisão foi manter o redirect direto e só adicionar um aviso contextual
no destino, explicando o que aconteceu.

### Implementação

- **Middleware**: quando `decidirAcessoRota()` recusa o acesso e devolve
  um `redirecionarPara`, o `middleware.ts` acrescenta
  `?aviso=sem-permissao` à URL de destino antes do redirect.
  `decidirAcessoRota()` em si não mudou — continua devolvendo só o
  caminho, sem conhecimento de UI.
- **`PortalShell`** (chrome compartilhado por `ConsoleShell`, o portal do
  paciente e o portal do cliente — os três destinos possíveis de um
  redirect por papel): lê a query string uma única vez, no mount, do
  mesmo jeito que `login-form.tsx` já lê o parâmetro `redirect` (evita
  exigir um Suspense boundary para `useSearchParams()` em toda página que
  usa o shell). Ao achar `aviso=sem-permissao`, mostra um `Aviso`
  dispensável (`variante="alerta"`) em `AvisoRegiao` e limpa o parâmetro
  da URL via `router.replace`, para que um refresh ou voltar no
  histórico não repita o aviso.
- Nenhuma rota nova, nenhum novo endpoint, nenhuma migration — o aviso é
  inteiramente client-side, alimentado por um parâmetro que o próprio
  middleware já controla.

### Validações

- TDD: novo `tests/visual/aviso-acesso-negado.spec.mjs` (3 testes: aviso
  aparece após redirecionamento por falta de permissão e some ao
  recarregar a página; rota permitida não mostra aviso; fechar o aviso
  remove da tela). RED confirmado — os 2 testes que dependiam do aviso
  falharam pela ausência do elemento antes da implementação; o teste
  negativo (rota permitida) já passava, como esperado.
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros) e `build` — PASS
- 6/6 Playwright do spec novo (desktop+mobile) — PASS
- Regressão: `primeiro-acesso-paciente.spec.mjs` (8/8),
  `portal-cliente.spec.mjs` (4/4), `sessoes-conta.spec.mjs` (9/9) — PASS,
  confirmando que a mudança em `PortalShell` (usado pelos três) não quebrou
  nenhum consumidor existente.
- 134/134 Playwright do gate completo de acessibilidade
  (`acessibilidade.spec.mjs`, desktop) — PASS, incluindo todas as
  páginas que renderizam `PortalShell`.
- Gate de linguagem, `pnpm security:secrets`, `git diff --check` — PASS
