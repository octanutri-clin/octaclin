# Fase 77 - Detalhe do formulario respondido no portal

## Entregue

- Adicionado metodo `obterFormularioRespondido` no servico do portal do paciente.
- Adicionado endpoint protegido `GET /portal/paciente/formularios-respondidos/:respostaId`.
- O backend valida que a resposta pertence ao paciente autenticado antes de retornar qualquer dado.
- O detalhe retorna questionario, score, data de finalizacao e respostas por pergunta.
- Adicionada rota BFF `/api/portal/paciente/formularios-respondidos/:respostaId`.
- O portal permite abrir um formulario respondido pelo historico e ver pergunta por pergunta.

## Decisoes

- O identificador usado pela UI e o `respostaId`, nao o `envioId`, porque ele representa a submissao final.
- A rota continua escopada pelo `usuarioId` do token do paciente.
- Perguntas sem valor salvo aparecem como `Sem resposta`, preservando a ordem do questionario.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-paciente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-backend test --runInBand`
- `pnpm --dir octaclin-web test:questionarios-preview`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-backend build`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 78: perfil editavel do paciente com validacao, auditoria e preferencias de contato.
