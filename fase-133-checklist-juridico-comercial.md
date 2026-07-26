# Fase 133 - Checklist juridico e comercial para clientes

Data: 2026-07-26

## Objetivo

Criar o pacote operacional que organiza contratacao, privacidade, suporte e
onboarding antes da entrada de clientes reais de consultoria.

## Entregas

- Pacote juridico/comercial com gates de go-live.
- Minuta de contrato e rascunho de politica de privacidade.
- Matriz inicial de controlador, operador e responsabilidades por operacao.
- SLA operacional proposto com severidades P1 a P4.
- Checklist de onboarding comercial por cliente.
- Teste documental `pnpm test:juridico-comercial`.

## Decisoes

- A fase entrega estrutura e controles, nao aconselhamento juridico nem textos
  finais publicaveis.
- A classificacao de controlador e operador deve ser validada no contrato/anexo
  de cada cliente.
- Aprovacao juridica, identidade empresarial e dominio oficial continuam gates
  obrigatorios de go-live.

## Validacoes

- `pnpm test:juridico-comercial`
- `pnpm validate:docs`
- `git diff --check`

## Pendencias para go-live

- Revisao juridica externa e adequacao ao modelo comercial real.
- Preenchimento de razao social, CNPJ, contato de privacidade, precos e foro.
- Publicacao de politica e termos finais em dominio oficial.
- Assinatura e registro do onboarding para cada cliente real.
