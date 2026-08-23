# Fase 143 - Onboarding de profissionais por convite

Status: concluida em 2026-07-26.

## Objetivo

Garantir que o convite de um usuario com papel `Professional` tambem crie o
perfil clinico que vincula o login a agenda, ao escopo de dados e a futura
conexao individual com a Google Agenda.

## Entregue

- O convite administrativo para `Professional` passou a exigir o nome do
  profissional e aceita registro profissional e especialidade opcionais.
- A mesma transacao cria `usuarios`, `profissionais` e o token de primeiro
  acesso. Assim, apos definir a senha, o usuario ja possui o vinculo exigido
  por agenda, pacientes e Google Calendar.
- O portal do cliente mostra os campos clinicos apenas ao selecionar o papel
  `Professional`; convites de `Collaborator` continuam inalterados.
- DTOs e BFF foram estendidos sem expor senha, token ou dados criptografados.

## Compatibilidade e limite conhecido

Convites de profissional criados antes desta fase nao ganham perfil de forma
retroativa, pois o nome clinico nao pode ser inferido com seguranca. Caso
existam, o SuperAdmin deve cadastrar o profissional correspondente antes de
habilitar agenda ou Google Calendar para aquele login.

## Validacoes

```powershell
pnpm --dir octaclin-backend test servico-usuarios-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web build
pnpm validate:docs
pnpm security:secrets
```
