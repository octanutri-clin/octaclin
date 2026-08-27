# Relatorio de validacao com NVDA - PR 32

Data da validacao: 2026-08-27

## Objetivo

Validar com leitor de tela fluxos representativos do OctaClin que ja possuem gate automatizado de acessibilidade, registrar problemas que o axe-core nao detecta e corrigir somente defeitos comprovados dentro do escopo do frontend web.

Esta validacao nao substitui o gate Playwright + axe-core. Ela complementa a automacao com evidencia produzida pelo NVDA durante uso real do teclado.

## Ambiente e seguranca

- NVDA 2026.1.1, com Visualizador da Fala habilitado.
- Google Chrome 151.0.7922.72.
- Microsoft Edge 151.0.4129.107.
- Aplicacao local, APIs interceptadas ou servidor demo local.
- Contas, nomes, dados clinicos e tokens exclusivamente sinteticos.
- Nenhuma producao, credencial real ou dado identificavel de paciente foi utilizado.

O texto do Visualizador da Fala foi lido diretamente da janela do NVDA para preservar a evidencia anunciada. A arvore de acessibilidade do navegador foi usada apenas como apoio, nao como substituta do leitor de tela.

## Matriz executada

| Navegador | Rota ou estado | Verificacao manual | Resultado |
| --- | --- | --- | --- |
| Chrome | `/login`, estado inicial | Titulo da pagina, marco principal, titulo nivel 1, campos obrigatorios, botao de alternancia de senha e ordem por teclado | PASS apos correcao |
| Chrome | `/login`, credenciais sinteticas invalidas | Permanencia no formulario e anuncio do alerta de erro | PASS |
| Edge | `/login`, estado inicial | Paridade dos nomes acessiveis, papeis e ordem de foco observados no Chrome | PASS apos correcao |
| Edge | `/pacientes`, lista carregada | Link de salto, titulos, regioes, navegacao de paginacao, busca e filtros | PASS |
| Edge | `/pacientes/novo` | Regioes do formulario, campos obrigatorios, seletor de data, profissional responsavel e botao indisponivel antes do preenchimento | PASS |
| Chrome for Testing | `/portal/checkins`, fixture Playwright sintetica | Figura com nome acessivel, abertura por teclado de "Ver valores em tabela" e leitura de cabecalhos/celulas | PASS |

## Evidencias do NVDA

### Login invalido no Chrome

O NVDA anunciou, na sequencia relevante:

```text
principal marco
formulario marco
EMAIL edicao exigido invalid@octaclin.local
SENHA edicao protegido exigido
Entrar botao
alerta Credenciais demo invalidas.
```

### Login no Edge

O NVDA anunciou os campos e a acao de senha com estado:

```text
formulario
EMAIL edicao exigido voce@exemplo.com
SENHA edicao protegido exigido
Mostrar senha botao de alternancia nao pressionado
Entrar botao
```

### Lista e cadastro de pacientes no Edge

Na lista, foram anunciados `Pacientes titulo nivel 1`, `Lista de pacientes titulo nivel 2`, a regiao `Visoes de trabalho` e a navegacao `Paginacao de pacientes`. No cadastro, o NVDA identificou as regioes `Identificacao`, `Contato` e `Responsavel e acompanhamento`, incluindo os campos obrigatorios e o estado indisponivel do botao `Cadastrar paciente`.

### Tabela de check-ins

Ao abrir os valores por teclado, o NVDA anunciou:

```text
figura Peso em kg, por data de avaliacao
tabela com 4 linhas e 2 colunas
linha 1 coluna 1 Data
coluna 2 Peso (kg)
linha 2 Data coluna 1 19/07/26
```

## Defeito comprovado e correcao

### Titulo generico em todas as paginas

Antes da correcao, Chrome e Edge anunciavam apenas `OctaClin`, independentemente da rota. Isso impedia que uma pessoa usando leitor de tela identificasse a pagina atual pelo titulo do documento e violava o objetivo do WCAG 2.4.2 (Page Titled).

A correcao foi dividida conforme o tipo de rota:

- metadados estaticos nas rotas de acesso, recuperacao, primeiro acesso e portal do cliente;
- metadado no layout do portal do paciente, cobrindo tambem suas subrotas;
- componente compartilhado no `PortalShell` para os consoles cujo titulo depende da configuracao da tela em tempo de execucao.

Depois da correcao, o NVDA anunciou `Acesso OctaClin | OctaClin` no Chrome e no Edge. Testes Playwright verificam tambem os titulos de dashboard, agenda, portal do paciente, portal do cliente e rotas de recuperacao de acesso.

Nenhum outro defeito foi comprovado na matriz manual executada.

## Validacoes automatizadas

- Baseline anterior a mudancas de produto: `test:a11y` PASS, 264/264.
- Regressao RED: as cinco rotas criticas falharam porque retornavam apenas `OctaClin`.
- Regressao GREEN: login, dashboard, agenda, portal do paciente e portal do cliente PASS, 5/5.
- Rotas publicas de acesso apos a correcao: PASS, 11/11.
- Check-ins, abertura da tabela por teclado e titulo da subrota: PASS, 1/1.
- Gate completo Playwright + axe-core: `test:a11y` PASS, 264/264 em desktop e mobile.
- Gate de reflow e acessibilidade visual: `test:reflow` PASS, 60/60 em desktop e mobile.
- `typecheck`: PASS.
- `lint`: PASS, 0 erros e 52 warnings conhecidos, igual ao baseline.
- Build de producao Next.js: PASS, 126 paginas estaticas geradas.
- `git diff --check`: PASS.
- `security:secrets`: PASS, nenhum secret real identificado pelos padroes locais.

## SKIPPED e limites

- SKIPPED: validacao manual de todas as rotas e de todos os estados do sistema. A matriz foi deliberadamente representativa e baseada no gap analysis existente.
- SKIPPED: aplicativo Expo, TalkBack e VoiceOver. Esse escopo pertence ao PR 33.
- SKIPPED: validacao em producao. O PR nao exige nem autoriza acesso a producao.
- SKIPPED: repeticao da leitura da tabela de check-ins no Edge. A evidencia foi obtida no Chrome for Testing com fixture sintetica deterministica.
- NA: migrations, backend, RLS, tenancy, integracoes externas e dados clinicos persistidos.

## Riscos residuais

- Titulos dos consoles renderizados pelo `PortalShell` dependem de hidratacao no cliente. As rotas criticas dashboard e agenda possuem regressao automatizada, mas novas telas que usem outro shell devem definir titulo explicitamente.
- Testes automatizados confirmam o valor de `document.title`, mas somente uma nova rodada manual confirma a pronunciacao exata em combinacoes futuras de navegador e NVDA.
- O Visualizador da Fala registra o que foi anunciado na sessao, mas nao constitui gravacao de audio nem teste exaustivo de compreensao por usuario.

## Conclusao

O PR 32 comprova uma falha transversal que o axe-core nao sinalizava, corrige o titulo de documento sem alterar contratos ou regras de negocio e adiciona regressao automatizada para as rotas validadas. O restante da acessibilidade web continua protegido pelos gates existentes; aplicativo movel e consolidacao do CI permanecem nos PRs posteriores autorizados.
