# Fase 252 - Arquitetura de navegacao e descoberta de funcionalidades

Status: concluida em 2026-08-21.

## Objetivo

Reconciliar as rotas profissionais implementadas com papel, permissao, menu e
paleta de comandos. A navegacao deve revelar somente capacidades autorizadas,
sem deixar funcionalidades prontas inacessiveis apos o login.

## Entrega

- `lib/navegacao-console.ts` passou a ser o catalogo canonico dos dez modulos do
  console, com rota, grupo, permissao, papel, atalho, termos de busca e icone.
- `ConsoleShell`, a paleta de comandos e a autorizacao de rotas consomem o mesmo
  catalogo, removendo tres listas paralelas que podiam divergir.
- A arquitetura usa somente `Clinica`, `Relacionamento` e `Administracao`.
- O menu mobile deixou de depender de uma faixa horizontal truncada. Um
  disclosure nativo, acessivel por teclado, mostra todos os grupos e informa a
  area atual sem cobrir o conteudo.
- A busca de comandos respeita papel e permissao antes de exibir navegacao ou
  acao. `Patient` e `Client` nao recebem modulos do console.
- O detalhe do paciente exige `pacientes.ler`; a lista exige
  `pacientes.listar`.

## Matriz de acesso validada

| Papel | Resultado no console |
| --- | --- |
| SuperAdmin | Dez modulos, incluindo Operacoes; pode selecionar contexto profissional quando a API autoriza. |
| Professional | Modulos clinicos e de relacionamento concedidos; Operacoes nunca aparece. |
| Collaborator | Somente modulos explicitamente delegados; permissao isolada nao supera restricao de papel. |
| Patient | Redirecionado ao portal do paciente. |
| Client | Redirecionado ao portal do cliente. |

## Auditoria de caminhos de clique

1. Menu desktop: `Link` direto, estado atual por `aria-current` e grupo vindo do
   catalogo canonico.
2. Menu mobile: `summary` abre e fecha o disclosure sem estado React paralelo;
   os links fechados permanecem fora da ordem de Tab.
3. Paleta: abre, filtra apenas comandos autorizados, fecha e navega pelo router;
   atalhos sao unicos e testados.
4. Acoes rapidas: continuam separadas da navegacao e exigem sua permissao
   especifica.
5. Conta e saida: preservam o fluxo existente e o foco visivel.

Nao foi encontrado conflito entre estado local, navegacao e destino final nos
caminhos alterados.

## Validacao de seguranca

Rubrica aplicada (5/5):

- papel e permissao precisam concordar para exibir um modulo;
- `Patient` e `Client` ficam isolados do console;
- `Operacoes` e troca de contexto profissional permanecem exclusivas ao
  `SuperAdmin`;
- a rota de prontuario usa permissao de leitura distinta da listagem;
- ocultar um item nao e tratado como fronteira de seguranca: BFF e backend
  continuam exigindo sessao, papel e permissao antes de acessar dados ou agir.

Nenhum achado de seguranca sobreviveu a validacao do escopo alterado. Cookies
sinteticos foram usados somente nos testes; nenhuma credencial ou dado real foi
registrado.

## Penpot

Arquivo: `OctaClin`, pagina `10 - Fase 252: Navegacao e descoberta`.

Boards:

- `Fase 252 / Arquitetura canonica`;
- `Console / Desktop 1440`;
- `Matriz de acesso / Papeis`;
- `Console / Mobile 390`.

Os boards usam dados sinteticos e documentam os mesmos grupos, estados e
restricoes implementados.

## Validacoes executadas

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:base-visual
pnpm --dir octaclin-web test:linguagem
pnpm --dir octaclin-web test:fase252
pnpm --dir octaclin-web test:a11y
```

Resultados:

- typecheck e build aprovados;
- lint com zero erros e 52 avisos preexistentes fora do escopo;
- 4/4 cenarios Playwright da fase aprovados;
- 10/10 cenarios de acessibilidade aprovados em desktop e mobile;
- Lighthouse via Chrome DevTools: acessibilidade, boas praticas, SEO e Agentic
  Browsing em 100; console sem erros na jornada auditada;
- Browser MCP foi acionado, mas seu cliente local falhou ao inicializar com
  `Cannot redefine property: process`; Chrome DevTools e Playwright cobriram a
  validacao real de navegador sem reduzir o aceite.

## Impacto operacional

Nao ha backend, migration, banco, variavel de ambiente ou mudanca de deploy.

## Proxima fase

Fase 253 - Agenda clinica confiavel e operacional.

- Modelo: GPT-5.6 Sol, raciocinio `xhigh`.
- Skills: `ecc:nestjs-patterns`, `ecc:backend-patterns`, `ecc:api-design`,
  `ecc:error-handling`, `ecc:e2e-testing` e
  `codex-security:attack-path-analysis`.
- Ferramentas: Context7, Browser, Chrome DevTools e Playwright.
