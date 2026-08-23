# Fase 127 - Runbooks de suporte

Data: 2026-07-23

## Objetivo

Criar manual operacional de suporte para problemas comuns antes do go-live, cobrindo login, convites, recuperacao de senha, WhatsApp, email e agenda sem expor secrets ou dados sensiveis.

## Entregas

- Criado `RUNBOOK_SUPORTE.md` com triagem inicial, evidencias minimas e criterio de escalonamento.
- Conectado o runbook de suporte aos documentos vivos do projeto.
- Adicionado teste documental `scripts/test-runbook-suporte.mjs`.
- Adicionado script `pnpm test:suporte`.
- Incluido `RUNBOOK_SUPORTE.md` na validacao de documentos obrigatorios do preflight.

## Validacoes

```powershell
pnpm test:suporte
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Observacoes

- O runbook nao substitui atendimento humano nem revisao juridica/comercial.
- O material foi escrito para suporte de staging/producao inicial e deve ser revisado apos o piloto interno.
- O criterio principal e resolver incidentes comuns sem pedir senha, token ou dados clinicos completos ao usuario.
