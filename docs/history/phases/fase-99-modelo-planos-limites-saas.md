# Fase 99 - Modelo de planos e limites SaaS

Data: 2026-07-22.

## Objetivo

Criar a base de planos SaaS por tenant para permitir controle de uso antes da integracao definitiva de billing.

## Entregas

- Modelo de planos `gratuito`, `profissional`, `clinica` e `enterprise`.
- Limites por plano para usuarios administrativos, pacientes, mensagens mensais, formularios ativos e armazenamento.
- Configuracao de plano por tenant via `tenant_configuracoes` com chave `plano_saas`.
- Calculo de uso real por tenant no backend.
- Metodo `checarLimite` no servico do portal do cliente para bloquear novas acoes quando um recurso atingir o limite.
- Resumo do portal do cliente expondo `planoId`, limites, uso, alertas e renovacao.
- UI inicial no portal do cliente mostrando consumo por recurso e alerta de limite.
- Teste visual do portal do cliente cobrindo o resumo SaaS.

## Decisoes

- A Fase 99 nao criou tabela nova para assinatura; usou `tenant_configuracoes` para manter o MVP simples e reversivel.
- O plano `enterprise` usa limites `null` para representar uso ilimitado.
- Alertas sao gerados a partir de 80% de consumo e viram `excedido` quando uso e maior ou igual ao limite.
- Datas administrativas no portal do cliente sao formatadas em UTC para evitar deslocamento de vencimento quando o backend envia ISO em meia-noite UTC.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
pnpm --dir octaclin-web build
```

## Proxima fase recomendada

Fase 100 - Tela de assinatura e uso no portal do cliente, agora focada em gestao comercial: CTAs de upgrade, aviso de plano, estado de assinatura manual e base para upgrade/downgrade sem gateway definitivo.
