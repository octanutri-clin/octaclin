# Fase 80 - Regressao visual do portal do paciente

## Entregue

- Adicionado smoke visual dedicado ao portal do paciente em Playwright.
- O teste cobre carregamento autenticado via cookies, mock do BFF do portal, perfil, privacidade, formulario respondido e ausencia de overflow horizontal.
- O portal ganhou a secao `Proximas acoes` para destacar formularios pendentes e a proxima consulta.
- As acoes usam os dados ja retornados por `/api/portal/paciente`, sem alterar contrato de backend.
- O teste roda em desktop e mobile pelos projetos existentes do Playwright.

## Decisoes

- A regressao visual do portal usa mock de BFF para nao depender de staging, backend local ou dados manuais.
- A secao de proximas acoes exibe ate dois formularios pendentes e uma consulta futura para manter a tela objetiva.
- A lista completa de formularios, historico, consultas, mensagens e privacidade continua disponivel abaixo do resumo.

## Validacao

- `playwright test --project=desktop-chromium --grep "portal do paciente"`
- `playwright test --grep "portal do paciente"`
- `pnpm typecheck`
- `pnpm build`

## Proxima fase

Fase 81: onboarding real do cliente/paciente, com convite, primeiro acesso, aceite de termos, recuperacao de acesso e estados iniciais do portal.
