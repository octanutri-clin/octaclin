# Fase 23 - Questionarios via BFF real

## Objetivo

Remover o principal trecho estatico do console web e conectar o editor de Questionarios aos contratos reais do backend, preservando o modelo seguro do BFF com cookies `HttpOnly`.

## Entregas

- Backend com atualizacao de pergunta existente:
  - `PATCH /questionarios/:id/perguntas/:perguntaId`
- BFF web para:
  - categorias de pergunta;
  - questionarios;
  - perguntas;
  - reordenacao;
  - agendamentos.
- `lib/questionarios-api.ts` com chamadas tipadas e bootstrap de categorias padrao quando o tenant ainda nao possui categorias.
- Editor `/questionarios` conectado aos endpoints reais:
  - carrega questionarios existentes;
  - cria novo questionario;
  - salva titulo, descricao e status;
  - cria nova pergunta;
  - salva enunciado, tipo, categoria, peso e obrigatoriedade;
  - reordena perguntas com drag-and-drop persistido;
  - cria agendamento por regra cron.
- Remocao dos botoes estaticos de cabecalho que nao executavam comandos reais.

## Arquivos principais

- `outputs/octaclin-backend/src/modulos/questionarios/aplicacao/dtos.ts`
- `outputs/octaclin-backend/src/modulos/questionarios/aplicacao/servico-questionarios.ts`
- `outputs/octaclin-backend/src/modulos/questionarios/apresentacao/controlador-questionarios.ts`
- `outputs/octaclin-web/lib/questionarios-api.ts`
- `outputs/octaclin-web/components/questionarios/editor-questionario.tsx`
- `outputs/octaclin-web/app/api/questionarios/*`
- `outputs/octaclin-web/app/api/categorias-pergunta/route.ts`
- `outputs/octaclin-web/app/api/agendamentos-questionario/route.ts`

## Validacao

- backend `tsc --noEmit`: aprovado.
- backend `jest --runInBand`: aprovado, 11 suites e 30 testes.
- backend `nest build`: aprovado.
- web `tsc --noEmit`: aprovado.
- web `next build`: aprovado.
- `node work/checar-imports-relativos.js`: aprovado, `relative-imports-ok 117`.
- busca por mencoes ao sistema usado como referencia: sem ocorrencias.
