# Fase 120 - Hardening de secrets e variaveis

Data: 2026-07-23

## Objetivo

Reduzir risco de vazamento de credenciais no OctaClin, criando varredura local automatizavel e runbook de rotacao para os provedores criticos antes de producao.

## Entregas

- Criado scanner local `scripts/scan-secrets.mjs` sem dependencias externas.
- Criado teste `scripts/test-scan-secrets.mjs` para validar deteccao de OpenAI, Meta e URL de banco com senha.
- Adicionados scripts raiz `security:secrets` e `test:security`.
- Preflight `validar-preflight.ps1` passa a executar o scanner local.
- `RUNBOOK_ROTACAO_SECRETS.md` documenta rotacao de Meta WhatsApp, Gmail, Google Calendar, OpenAI, Neon/Postgres, Upstash/Redis, JWT e chave AES.
- `VARIAVEIS_AMBIENTE.md` e `TESTES_E_VALIDACOES.md` passam a apontar para scanner e runbook.
- Fixture de teste de TypeORM foi ajustado para nao parecer senha real em varreduras futuras.
- Varredura real do repositório atual nao encontrou secrets pelos padroes locais.

## Decisoes

- O scanner e propositalmente local e sem dependencia externa para funcionar em Windows/PowerShell, Codex e maquinas de outros desenvolvedores.
- A deteccao cobre formatos de maior risco ja usados ou provaveis no projeto: `sk-*`, `sk-proj-*`, `EAAY*`, refresh token Google, URLs com senha e chaves privadas.
- O scanner nao substitui rotacao. Se um secret aparecer em historico Git ou chat, o runbook manda rotacionar primeiro.
- `CRIPTOGRAFIA_CHAVE_AES_256` recebeu tratamento especial no runbook porque rotacao exige plano de recriptografia dos dados existentes.

## Arquivos principais

- `scripts/scan-secrets.mjs`
- `scripts/test-scan-secrets.mjs`
- `RUNBOOK_ROTACAO_SECRETS.md`
- `validar-preflight.ps1`
- `package.json`
- `VARIAVEIS_AMBIENTE.md`
- `TESTES_E_VALIDACOES.md`
- `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
node scripts\test-scan-secrets.mjs
node scripts\scan-secrets.mjs
cd octaclin-backend; .\node_modules\.bin\jest.cmd --runInBand src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Avaliar secret scanning tambem no GitHub Actions se o fluxo remoto estiver habilitado.
- Avaliar ferramenta dedicada como Gitleaks/TruffleHog antes de producao real, caso o time aceite dependencia externa.
- Definir processo formal de emergencia se algum secret real ja tiver sido exposto fora do repositório.
