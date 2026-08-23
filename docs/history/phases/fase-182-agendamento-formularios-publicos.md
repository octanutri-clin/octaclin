# Fase 182 - Agendamento e formularios publicos

Status: codigo concluido e enviado para deploy no commit `c869591` em 2026-07-31.

## Entregue

- A solicitacao publica deixa claro que o horario somente e reservado apos a
  confirmacao da equipe, sem prometer consulta antes da aprovacao interna.
- Fuso horario, horario escolhido e estado da selecao passaram a ser visiveis
  e anunciados de forma acessivel; os botoes de horario comunicam selecao por
  `aria-pressed`.
- O formulario publico informa expiracao quando recebida pelo backend e, em
  caso de falha de envio, preserva as respostas na tela para nova tentativa.

## Limite deliberado

- Rascunho e retomada entre dispositivos nao foram simulados: o backend atual
  nao oferece persistencia segura desse estado. A tela preserva dados apenas
  durante a tentativa atual.
- A identidade exibida segue o profissional e a marca OctaClin porque a API
  publica ainda nao devolve dados visuais configuraveis da clinica.

## Validacoes

- Quatro cenarios Playwright de agendamento publico passaram em desktop e
  celular, incluindo fuso horario, selecao e confirmacao sem dados internos.
- Typecheck e build de producao da web aprovados.

## Proxima fase

Fase 183 - Editor de formularios completo.
