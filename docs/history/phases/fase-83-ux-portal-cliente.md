# Fase 83 - UX do portal do cliente

## Entregue

- Adicionada navegacao interna do portal com atalhos para `Resumo`, `Acoes`, `Historico`, `Perfil` e `Privacidade`.
- Os atalhos usam `aria-label`, foco visivel e area de toque adequada para mobile.
- O portal ganhou estado de carregamento estruturado com skeletons e `aria-busy`.
- O estado de erro agora exibe `Portal indisponivel`, a mensagem limpa retornada pela API e botao `Tentar novamente`.
- O cliente da API do portal passou a extrair mensagens de erro JSON (`mensagem`/`message`) antes de exibir o erro.
- A regressao visual cobre fluxo normal, primeiro acesso e falha de carregamento em desktop e mobile.

## Decisoes

- A navegacao foi adicionada somente quando o payload do portal esta disponivel, evitando atalhos para secoes inexistentes durante loading/erro.
- O estado de erro fica dentro da area principal do portal, sem exigir que o paciente entenda detalhes tecnicos da API.
- A melhoria foi concentrada no portal autenticado do cliente para preservar os fluxos operacionais ja estabilizados.

## Validacao

- `playwright test --grep "primeiro acesso|portal do paciente"`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 84: LGPD avancado do paciente com exportacao de dados, solicitacao de retificacao/exclusao e trilha operacional para atendimento.
