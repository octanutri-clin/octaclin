# Fase 82 - Central do paciente com linha do tempo

## Entregue

- O portal do paciente ganhou a secao `Linha do tempo`.
- A linha do tempo consolida consultas, formularios pendentes, formularios respondidos, mensagens recentes e consentimentos LGPD.
- Os eventos sao derivados do payload atual de `/api/portal/paciente`, sem mudanca no contrato de backend.
- Os itens sao ordenados por data mais recente e limitados aos 8 eventos principais.
- A regressao visual do portal cobre os tipos `Agenda`, `Formulario pendente`, `Formulario respondido`, `Mensagem` e `Privacidade`.

## Decisoes

- A central foi implementada no frontend para entregar valor sem migration ou novo endpoint nesta fase.
- A lista completa de cada area continua abaixo da linha do tempo, preservando os fluxos ja existentes.
- Datas ausentes ou invalidas aparecem como `Sem data` e ficam no fim da ordenacao.
- O componente usa dimensoes estaveis e truncamento para evitar overflow em desktop e mobile.

## Validacao

- `playwright test --grep "primeiro acesso|portal do paciente"`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 83: UI/UX completo das telas do cliente, com foco em mobile-first, acessibilidade, estados vazios, estados de erro e refinamento visual do portal.
