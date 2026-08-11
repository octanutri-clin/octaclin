# Fase 224 - Oferta comercial, planos e ativacao assistida

Status: preparada em 2026-08-10; aguarda aceite comercial do responsavel pelo
produto antes de ser marcada como concluida.

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

## Aceite ainda necessario

O responsavel pelo produto precisa definir, fora do Git:

1. preco, moeda, periodicidade, pagamento e reajuste;
2. prazo de teste e cancelamento;
3. processo comercial que guarda proposta, contrato e comprovantes;
4. migracao/importacao e eventual valor adicional;
5. inclusao ou exclusao explicita de WhatsApp na oferta inicial;
6. identidade empresarial e dominio oficiais.

Sem essas decisoes, a fase nao deve ser marcada como concluida e a oferta nao
deve ser divulgada como pacote comercial final.

## Validacao

Fase documental, sem codigo, banco, variaveis ou deploy:

```powershell
git diff --check
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Proximo passo

Registrar as seis decisoes no processo comercial privado e marcar o aceite da
Fase 224. Em seguida, seguir para a Fase 225 - dominio, identidade e
comunicacoes transacionais.
