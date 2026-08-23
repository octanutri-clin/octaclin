# Fase 190 - Arquitetura de navegacao e sistema visual definitivo

Status: concluida e validada localmente em 2026-07-31.

## Entregue

- Navegacao diaria reorganizada em Clinica, Relacionamento, Gestao e
  SuperAdmin, sempre filtrada pelas permissoes da sessao.
- Dashboard passou a ser apresentado como Hoje e Questionarios como
  Formularios; IA, Mobile e Gamificacao continuam acessiveis por URL
  autorizada, mas sairam do menu principal.
- Cabecalho compartilhado ganhou workspace humanizado, email, papel e menu de
  conta nativo, sem expor API, token ou slug bruto.
- Atalhos por permissao levam a novo agendamento, novo paciente e
  comunicacoes; as duas criacoes usam ancoras reais nas telas de destino.
- Navegacao e dashboard usam skeleton compartilhado durante carregamento, e o
  shell oferece atalho de teclado para pular ao conteudo.
- Estado ativo foi consolidado nas navegacoes lateral, por abas e mobile.

## Mapa de componentes

- `ConsoleShell`: fonte unica dos modulos, grupos, permissoes, contexto e
  atalhos do console clinico.
- `PortalShell`: estrutura responsiva, navegacao, menu da conta e conteudo
  principal para console e portais.
- `Esqueleto` e `EsqueletoPagina`: carregamento visual compartilhado sem
  inventar dados ou substituir feedback de erro.
- `Botao`, `Campo`, `Cartao`, `Abas`, `Modal`, `Tabela`, `Etiqueta` e os
  feedbacks existentes permanecem a biblioteca visual oficial.

## Limites deliberados

- Nenhuma rota, permissao, contrato de backend ou integracao foi removida.
- O atalho de notificacoes leva a Comunicacoes; contagem em tempo real nao foi
  simulada sem uma fonte de dados propria.
- Paineis laterais de criacao entram nas fases das telas que efetivamente os
  utilizarao, evitando componente especulativo sem consumidor.
- A gravacao final no Penpot continua pendente na Fase 189 por depender do MCP
  de escrita disponivel.

## Validacoes

```powershell
pnpm --dir octaclin-web run test:base-visual
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web run test:a11y
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web run build
```

Resultados: contrato visual, 48 cenarios de console, 10 cenarios de
acessibilidade, 22 verificacoes de autorizacao/BFF, typecheck e build de
producao aprovados. O commit de implementacao e `e371ae0`.

## Proxima fase

Fase 191 - Acesso e ativacao do usuario.
