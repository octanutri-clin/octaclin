# Fase 254 - Incremento 3: visoes salvas e duplicidade

## Objetivo

Transformar a lista e o cadastro de pacientes em fluxos de trabalho repetiveis,
sem ampliar acesso a prontuarios nem persistir PII fora das protecoes atuais.

## Tarefas

- [x] Criar BFF autenticado para listar, criar e arquivar filtros salvos.
- [x] Criar BFF autenticado para verificacao consultiva de duplicidade.
- [x] Expor contratos tipados no cliente sem incluir busca livre nos criterios
  persistidos.
- [x] Permitir aplicar, salvar e arquivar visoes pessoais e da clinica.
- [x] Identificar filtro com profissional removido como desatualizado e oferecer
  aplicacao segura sem esse criterio.
- [x] Verificar possiveis duplicidades no cadastro novo com debounce e protecao
  contra resposta obsoleta.
- [x] Exigir decisao humana entre abrir o cadastro existente e confirmar pessoa
  diferente, sem bloquear quando a verificacao estiver indisponivel.
- [x] Ligar a decisao de prosseguir ao registro de auditoria com UUIDs apenas.
- [x] Cobrir contratos, autorizacao, estados, desktop e mobile.
- [x] Executar linguagem, acessibilidade, Playwright, build e revisao de
  seguranca antes do PR.

## Fronteiras

- A busca livre nunca entra em filtro salvo.
- Filtro da clinica exige `pacientes.gerenciar`; filtro pessoal exige apenas
  `pacientes.listar` e permanece vinculado ao profissional atual.
- A verificacao de duplicidade envia PII em `POST`, nunca em query string.
- A falha da verificacao e aberta e explicitamente informada; o cadastro
  clinico continua disponivel.
- Nomes de candidatos podem aparecer na interface autorizada, mas auditoria e
  logs recebem somente UUIDs.
- Nenhuma migration faz parte deste incremento.

## Portoes

- Backend: teste do controlador para auditoria da dispensa, typecheck e build.
- Web: testes de BFF, `test:fase254`, `test:linguagem`, `test:a11y`, lint,
  typecheck e build.
- Browser: desktop 1440 px e mobile 390 px, teclado, foco, overflow e console.
- Seguranca: permissao, tenant, escopo profissional, PII em URL/storage/log e
  ordem salvar -> auditar -> navegar.

## Resultado e evidencias

- Backend: typecheck e build aprovados; suite completa com 147 suites e 1.018
  testes; os 18 testes focados de controlador/duplicidade tambem passaram.
- Web: typecheck, build, ESLint dos componentes alterados, `test:authz`,
  `test:linguagem`, `test:base-visual`, `test:fase254` (10/10) e `test:a11y`
  (10/10) aprovados.
- Smoke: API demo e `next start` reais aprovados por `smoke:demo`; o token
  sintetico recebeu `pacientes.gerenciar` para cobrir as rotas novas.
- Browser: Chrome DevTools confirmou ausencia de erros, labels associados,
  ausencia de overflow e PII somente no corpo do `POST` de duplicidade.
- Lighthouse: 100 em acessibilidade, boas praticas, SEO e navegacao por agente
  na lista desktop e no cadastro mobile.
- Correcao transversal: o teste canonico TACO agora normaliza apenas quebra de
  linha na assercao, mantendo o JSON e o catalogo nutricional inalterados.
- Revisoes independentes: a trilha de dispensa agora recalcula e confere os
  UUIDs no escopo autorizado antes de criar; o debounce bloqueia envio
  antecipado, o alerta e anunciado, profissionais fora da primeira pagina sao
  consultados individualmente e o arquivamento exige confirmacao.
