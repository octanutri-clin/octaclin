# Fase 18 - DTOs autorizados com nomes descriptografados

## Objetivo

Permitir que as telas de Pacientes e Profissionais exibam nomes humanos sem expor buffers criptografados ou mover descriptografia para o frontend.

## Entregas

- `CriptografiaDadosSensiveis.descriptografar`.
- DTOs de resposta:
  - `PacienteRespostaDto`
  - `ProfissionalRespostaDto`
- `GET /pacientes` e `GET /pacientes/:id` passam a retornar pacientes com `nome` e `contato` descriptografados.
- `GET /profissionais` e `GET /profissionais/:id` passam a retornar profissionais com `nome` descriptografado.
- Telas web de Pacientes e Profissionais agora exibem nomes retornados pelo backend.

## Decisoes

- A descriptografia acontece somente no backend, dentro dos servicos que ja executam em contexto de tenant e guardas de papel.
- Os DTOs retornam apenas campos necessarios para a UI operacional atual.
- Dados continuam criptografados em repouso; o frontend nao recebe `nomeCriptografado` nem `contatoCriptografado`.

## Proximo risco a fechar

Adicionar auditoria de leitura de dados sensiveis e separar DTOs de lista versus detalhe para minimizar ainda mais o payload.

## Validacao executada

- Backend `tsc --noEmit`: passou.
- Backend `jest`: 10 suites e 27 testes passando.
- Backend `nest build`: passou.
- Web `tsc --noEmit`: passou.
- Web `next build`: passou.
- `work/checar-imports-relativos.js`: 114 imports backend OK.
- `work/checar-imports-web.js`: 35 imports web OK.
- Varredura de nome legado em `outputs`: sem ocorrencias.
