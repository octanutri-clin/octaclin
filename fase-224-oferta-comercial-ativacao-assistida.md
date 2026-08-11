# Fase 224 - Oferta comercial, planos e ativacao assistida

Status: concluida em 2026-08-11, com aceite comercial do responsavel pelo
produto.

## Objetivo

Transformar a capacidade tecnica ja entregue de planos, limites, assinatura
manual e bloqueios suaves em um processo de venda e ativacao que seja seguro,
executavel e auditavel sem criar gateway de pagamento prematuramente.

## Entrega

- `CAPACIDADE_OFERTA_COMERCIAL_ATIVACAO_ASSISTIDA.md` concentra o contrato da
  capacidade: ICP, pacotes, limites, inclusoes/exclusoes, atores, estados,
  sequencia de ativacao, fronteiras de dados e nao objetivos.
- `CHECKLIST_ONBOARDING_COMERCIAL.md` agora exige proposta completa, revisao
  de tenant pelo SuperAdmin, declaracao de WhatsApp e periodo de
  acompanhamento de 48 horas.
- A operacao manual existente foi mantida como caminho oficial: `SuperAdmin`
  aplica plano em `/operacoes`; o cliente solicita ajuste no portal; Fase 102
  preserva acesso aos dados quando houver bloqueio suave.

## Decisao de arquitetura e produto

Gateway de pagamento nao entra nesta fase. O caminho manual ja e suficiente
para um piloto assistido porque o estado tecnico de plano e limites e aplicado
por uma superficie autorizada. Cobranca, contrato e comprovante ficam fora do
repositorio e da auditoria tecnica.

## Aceite comercial registrado

- Profissional: R$ 99 por mes no trimestral antecipado ou R$ 119 por mes no
  mensal manual antecipado.
- Clinica: R$ 199 por mes no trimestral antecipado ou R$ 249 por mes no mensal
  manual antecipado.
- Pagamento por PIX/manual antecipado; gateway fica posterior.
- Demonstracao somente sintetica; cancelamento com aviso de 30 dias e bloqueio
  suave; migracao assistida cobrada por escopo; WhatsApp fora da oferta inicial;
  ativacao e suporte reforcado por 48 horas.

Permanecem gates de go-live, nao pendencias desta fase: sistema comercial
privado, reajuste anual juridicamente revisado, dominio e identidade oficiais.

## Validacao

Fase documental, sem codigo, banco, variaveis ou deploy:

```powershell
git diff --check
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Proximo passo

Seguir para a Fase 225 - dominio, identidade e comunicacoes transacionais.
