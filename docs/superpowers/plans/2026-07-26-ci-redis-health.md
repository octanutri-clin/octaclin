# Plano - regressao de CI e confiabilidade Redis

## Objetivo

Corrigir o smoke de UI, tornar o rate limit Redis atomico e validar Redis de
verdade no healthcheck sem tocar na Fase 136.

### Tarefa 1: manter limites de responsabilidade do smoke

Arquivos: `octaclin-web/scripts/smoke-ui-regression.mjs`.

- [x] Remover a verificacao de rotulos do menu do HTML bruto.
- [x] Executar o smoke com a demo local e confirmar que protecao, login e
  paginas continuam validados.
- [x] Manter o teste Playwright de console como cobertura da navegacao
  hidratada.

### Tarefa 2: tornar o contador Redis atomico

Arquivos: `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.ts`
e `servico-protecao-abuso.spec.ts`.

- [x] Escrever teste que dispara falhas em paralelo e exige bloqueio no limite.
- [x] Adicionar ao contrato Redis o comando atomico necessario.
- [x] Implementar uma unica chamada Lua que inicializa/incrementa contador,
  preserva TTL e registra bloqueio.
- [x] Executar a spec focada e o typecheck do backend.

### Tarefa 3: verificar conectividade real no healthcheck

Arquivos: `octaclin-backend/src/modulos/saude/servico-saude.ts`,
`servico-saude.spec.ts` e `modulo-saude.ts`.

- [x] Escrever testes para `PONG` e erro de `PING` com Redis configurado.
- [x] Injetar cliente Redis leve no servico de saude e aplicar timeout.
- [x] Configurar o provider no modulo sem expor segredo em resposta ou log.
- [x] Executar spec focada, typecheck, build e validacao de CI local aplicavel.
