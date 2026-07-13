# Fase 22 - Cadastros com criacao e edicao

## Objetivo

Transformar as telas de Pacientes e Profissionais de listagens passivas em cadastros operacionais, mantendo o padrao de seguranca do BFF com cookies `HttpOnly` e DTOs backend autorizados.

## Entregas

- BFF web com escrita autenticada:
  - `POST /api/pacientes`
  - `PATCH /api/pacientes/:id`
  - `POST /api/profissionais`
  - `PATCH /api/profissionais/:id`
- `cadastros-api.ts` com funcoes tipadas de criacao e atualizacao.
- Tela `/profissionais` com formulario de novo profissional e edicao em linha.
- Tela `/pacientes` com formulario de novo paciente, edicao em linha, selecao de profissional responsavel, status e score de risco.
- Tabelas com largura minima e rolagem horizontal em telas estreitas para evitar sobreposicao de texto.
- Backend ajustado para `criar` e `atualizar` retornarem DTOs descriptografados autorizados, em vez de entidades ORM com campos criptografados.
- Status `em_acompanhamento` preservado no contrato de edicao de paciente.

## Arquivos principais

- `outputs/octaclin-web/app/api/pacientes/route.ts`
- `outputs/octaclin-web/app/api/pacientes/[id]/route.ts`
- `outputs/octaclin-web/app/api/profissionais/route.ts`
- `outputs/octaclin-web/app/api/profissionais/[id]/route.ts`
- `outputs/octaclin-web/lib/cadastros-api.ts`
- `outputs/octaclin-web/components/cadastros/lista-pacientes.tsx`
- `outputs/octaclin-web/components/cadastros/lista-profissionais.tsx`
- `outputs/octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`
- `outputs/octaclin-backend/src/modulos/profissionais/aplicacao/servico-profissionais.ts`

## Validacao

- backend `tsc --noEmit`: aprovado.
- backend `jest --runInBand`: aprovado, 11 suites e 30 testes.
- backend `nest build`: aprovado.
- web `tsc --noEmit`: aprovado.
- web `next build`: aprovado.
- `node work/checar-imports-relativos.js`: aprovado, `relative-imports-ok 117`.
- busca por mencoes ao sistema usado como referencia: sem ocorrencias.
