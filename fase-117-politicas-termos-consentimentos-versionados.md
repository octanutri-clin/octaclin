# Fase 117 - Politicas, termos e consentimentos versionados

Data: 2026-07-23

## Objetivo

Registrar aceites legais obrigatorios de forma separada, versionada e rastreavel por perfil, cobrindo termos de uso, politica de privacidade e consentimento LGPD do paciente.

## Entregas

- Criado contrato compartilhado de documentos legais do paciente.
- Primeiro acesso do paciente exige aceite de termos de uso, politica de privacidade e consentimento LGPD.
- Ativacao do convite envia versoes de cada documento legal.
- Backend salva tres registros em `consentimentos_lgpd`: `termos_uso`, `politica_privacidade` e `consentimento_lgpd`.
- Metadados de aceite incluem paciente, origem, perfil e tipo de documento legal.
- Portal do paciente passa a expor `lgpd.documentosLegais`.
- Portal do paciente mostra status `Aceito` ou `Pendente` para cada documento legal.
- Botao de aceite no portal registra novamente os tres documentos nas versoes atuais.
- Testes cobrem backend de primeiro acesso, backend do portal, primeiro acesso visual e portal visual.

## Decisoes

- Nao foi criada nova tabela; `consentimentos_lgpd` permanece como trilha rastreavel de eventos legais.
- O aceite legado `primeiro_acesso_paciente` continua legivel no historico, mas novos fluxos passam a salvar documentos separados.
- As versoes atuais podem ser controladas por variaveis de ambiente: `OCTACLIN_LEGAL_VERSAO`, `OCTACLIN_TERMOS_USO_VERSAO`, `OCTACLIN_POLITICA_PRIVACIDADE_VERSAO`, `OCTACLIN_CONSENTIMENTO_LGPD_VERSAO` e `OCTACLIN_LGPD_VERSAO`.
- O escopo da fase cobre perfil paciente. Demais perfis podem reutilizar o modelo em fases futuras.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/documentos-legais-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/dtos.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-convites-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-convites-paciente.spec.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts`
- `octaclin-web/components/auth/primeiro-acesso-form.tsx`
- `octaclin-web/components/portal/portal-paciente.tsx`
- `octaclin-web/lib/convites-paciente-api.ts`
- `octaclin-web/lib/portal-api.ts`
- `octaclin-web/tests/visual/primeiro-acesso-paciente.spec.mjs`
- `octaclin-web/tests/visual/portal-paciente.spec.mjs`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-convites-paciente.spec.ts servico-portal-paciente.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
cd octaclin-web; .\node_modules\.bin\playwright.cmd test tests/visual/primeiro-acesso-paciente.spec.mjs --project=desktop-chromium --reporter=list
cd octaclin-web; $env:E2E_WEB_URL='http://localhost:3105'; .\node_modules\.bin\playwright.cmd test tests/visual/portal-paciente.spec.mjs --reporter=list
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
git diff --check
```

## Pendencias para fases futuras

- Estender documentos legais versionados para perfis cliente, profissional e colaborador.
- Definir conteudo juridico final dos termos e politica antes da liberacao comercial.
- Adicionar endpoint operacional para consultar historico legal por usuario/tenant quando necessario.
