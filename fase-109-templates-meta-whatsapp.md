# Fase 109 - Templates aprovados e mapeamento Meta WhatsApp

Data: 2026-07-22

## Objetivo

Permitir que templates aprovados manualmente na Meta sejam cadastrados no OctaClin e vinculados a eventos do sistema, com uso automatico no fluxo de agendamento.

## Entregas

- Selecao backend de template por evento para notificacoes de agenda.
- Mapeamento do evento `agenda.consulta.agendada` dentro do `conteudo` do template.
- Montagem de `components` WhatsApp a partir da ordem de parametros configurada no template.
- Tela `/comunicacoes` ampliada para cadastrar evento, idioma Meta e parametros do corpo em templates WhatsApp.
- Inventario de comunicacoes mostrando o evento vinculado ao template.

## Decisoes

- O mapeamento usa a propria entidade `templates_mensagem`, evitando migracao nesta fase.
- Para WhatsApp, `codigoExterno` representa o nome real do template aprovado na Meta.
- `conteudo.idioma` define o `language.code` usado no disparo.
- `conteudo.parametros` define a ordem dos parametros do corpo Meta, por exemplo `nomePaciente`, `dataConsulta`, `horaConsulta`.
- Se nao houver template mapeado para o evento, o sistema ainda usa o primeiro template compativel sem evento como fallback operacional.

## Arquivos principais

- `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts`
- `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts`
- `octaclin-web/components/comunicacoes/painel-comunicacoes.tsx`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts servico-google-calendar.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Mapear templates de remarcacao, cancelamento, confirmacao e lembrete assim que forem aprovados na Meta.
- Expor edicao de templates existentes, nao apenas criacao.
- Adicionar automacoes temporais de lembrete e confirmacao na Fase 110.
