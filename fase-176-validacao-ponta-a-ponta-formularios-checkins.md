# Fase 176 - Validacao ponta a ponta de formularios e check-ins

Status: concluida localmente em 2026-07-30; aguardando publicacao e smoke de
producao.

## Escopo validado

- Contratos de questionarios: estrutura historica, biblioteca, recorrencia por
  paciente, matriz longitudinal e leitura clinica.
- Consolidacao de check-ins rapidos e respostas de formulario no prontuario.
- Preview de perguntas e autorizacao BFF para respostas e revisao.
- Jornadas criticas de interface em desktop e celular, incluindo portal,
  agendamento e desmarcamento.

## Correcao encontrada

`cookies()` era lido de forma sincrona em `lib/server/sessao-bff.ts`. No
Next.js 15, isso fazia rotas autenticadas falharem em runtime. A fronteira de
sessao e seus chamadores diretos agora aguardam a API antes de ler, gravar ou
limpar cookies.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/questionarios/aplicacao/servico-questionarios.spec.ts src/modulos/questionarios/apresentacao/controlador-questionarios.spec.ts src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts src/modulos/pacientes/apresentacao/controlador-pacientes.spec.ts --runInBand
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web run test:questionarios-preview
pnpm --dir octaclin-web run test:next15
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web run test:e2e:criticas
pnpm --dir octaclin-web build
```

Resultados: 43 testes backend, 22 testes BFF/autorizacao, 3 testes de preview
e 10 jornadas criticas Playwright passaram.

## Proxima fase

Fase 177 - Qualidade transversal e componentes compartilhados.
