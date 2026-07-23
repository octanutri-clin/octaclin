# Fase 130 - Piloto interno controlado

Data: 2026-07-23

## Objetivo

Criar a estrutura operacional para um piloto interno controlado antes do go-live real, permitindo testar o OctaClin com poucos usuarios ficticios/autorizados, registrar problemas e definir criterios claros de aceite antes de avancar para producao isolada.

## Entregas

- Criado `RUNBOOK_PILOTO_INTERNO.md` com participantes, perfis a testar (cliente, profissional, paciente, suporte/operador), jornadas obrigatorias, criterios de sucesso, criterios de bloqueio, forma de registrar bugs e processo de decisao de aceite.
- Criado `PILOTO_INTERNO_CONTROLE.md` como arquivo vivo de acompanhamento da rodada atual do piloto: participantes, checklist de jornadas, registro de bugs e decisao de aceite.
- Adicionado validador documental `scripts/test-piloto-interno.mjs`.
- Adicionado script raiz `pnpm test:piloto`.
- `RUNBOOK_PILOTO_INTERNO.md` e `PILOTO_INTERNO_CONTROLE.md` incluidos na lista de documentos obrigatorios do `validar-preflight.ps1`.
- `CHECKLIST_GO_LIVE.md` ganhou secao "Piloto interno" ligando o aceite do piloto a liberacao de clientes reais.
- `PREFLIGHT_PRODUCAO.md` ganhou linha de area "Piloto interno" e "Proximo passo recomendado" atualizado.
- `TESTES_E_VALIDACOES.md` ganhou secao de validacao do piloto interno.
- Ajustado `scripts/scan-secrets.mjs` para ignorar os diretorios `.agents` e `skills`, evitando falso-positivo do scanner de secrets em exemplos de documentacao de terceiros vendorizados pelo marketplace de skills (ex.: URLs de banco de exemplo em `docker.md`/`gitlab.md`).

## Escopo nao incluido

- Nenhum cliente real de consultoria foi convidado nesta fase.
- Nenhuma rodada real do piloto foi executada; `PILOTO_INTERNO_CONTROLE.md` permanece como template preenchivel para a proxima execucao.

## Validacoes

```powershell
git diff --check
pnpm security:secrets
pnpm test:piloto
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Observacoes

- A execucao real do piloto (convocar participantes internos, aplicar `pnpm seed:staging` e rodar as jornadas) fica para a proxima etapa de trabalho, ainda dentro da Fase 130.
- A Fase 131 - Producao isolada de staging so deve iniciar apos o aceite do piloto ser registrado em `PILOTO_INTERNO_CONTROLE.md`.
