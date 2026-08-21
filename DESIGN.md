---
version: alpha
name: "OctaClin"
description: "Sistema clinico operacional em portugues do Brasil, com densidade serena e foco em decisoes de cuidado."
colors:
  fundo: "#F7F8FA"
  superficie: "#F8FAFB"
  tinta: "#1F2937"
  texto-suave: "#596273"
  linha: "#D9DEE8"
  primaria: "#247BA0"
  primaria-forte: "#1D6684"
  sucesso: "#2F9E44"
  alerta: "#C77D1A"
  perigo: "#C0392B"
typography:
  sans:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
rounded:
  sm: "0.375rem"
  DEFAULT: "0.5rem"
  lg: "0.75rem"
spacing:
  campo: "0.75rem"
  cartao: "1.25rem"
  secao: "2rem"
components:
  botao:
    minHeight: "2.75rem"
    radius: "0.375rem"
  campo:
    minHeight: "2.75rem"
    radius: "0.375rem"
  cartao:
    radius: "0.5rem"
  modal:
    maxHeight: "90vh"
    radius: "0.75rem"
---

# OctaClin Design System

## Overview

### Creative North Star

Uma bancada clinica organizada: instrumentos legiveis, hierarquia precisa e
espaco para a decisao profissional. O produto deve parecer uma ferramenta de
trabalho confiavel, e nao um portal de marketing ou uma colecao de cartoes.

### Product context and register

- **Audience and primary job:** profissionais de saude, equipes de clinica,
  pacientes e gestores executam atendimento, acompanhamento e comunicacao.
- **Target market(s) and evidence:** Brasil, em portugues do Brasil; `html`
  declara `pt-BR` em `octaclin-web/app/layout.tsx`.
- **Locale(s) and language policy:** textos do produto usam portugues brasileiro
  com acentuacao correta, voz direta e verbos de acao. IDs, codigos e contratos
  internos nunca definem a linguagem da interface.
- **Usage scene:** uso frequente em computador durante atendimento; paciente
  utiliza celular. Informacao clinica pede densidade organizada e leitura rapida.
- **Register:** produto clinico operacional. Paginas publicas mantem a mesma
  identidade, com menos controles e linguagem nao tecnica.
- **Memorable signature:** a cor azul-petroleo marca a acao clinica principal;
  estados e dados permanecem discretos e comparaveis.
- **Restraint:** nao usar hero, gradientes decorativos, superficies flutuantes ou
  ilustracoes para compensar hierarquia de informacao.
- **Anti-references:** dashboards de marketing, paletas monocromaticas escuras
  e cartoes dentro de cartoes dificultam a rotina clinica.
- **Token ownership/runtime mapping:** `octaclin-web/tailwind.config.ts` e
  `octaclin-web/app/globals.css` sao a fonte executavel. Este documento registra
  intencao e valores ja implementados; nao gera uma segunda escala de tokens.

## Colors

`fundo` e `superficie` mantem a tela clara, com `linha` para separar dados sem
pesar. `primaria` representa acao principal e foco; `sucesso`, `alerta` e
`perigo` comunicam resultado e nunca sao o unico sinal de estado. Alto contraste
e modo de alto contraste respeitam o navegador; tema escuro nao faz parte do
produto enquanto nao houver especificacao completa.

## Typography

IBM Plex Sans serve a leitura clinica e controles. IBM Plex Mono e reservada a
datas, horas, valores e tabelas que se beneficiam de algarismos tabulares. Titulos
permanecem compactos; rotulos usam sentence case quando nao forem metadados de
coluna. A interface nao usa abreviacoes internas nem texto sem acentuacao.

## Layout

O console usa largura maxima de 1500px, secoes com espacamento `secao` e controles
com no minimo 44px. Desktop prioriza comparacao e acoes recorrentes; celular
prioriza uma acao principal por contexto, ordem vertical previsivel e navegacao
propria. Tabelas mantem scroll horizontal no proprio contenedor, sem prender a
altura de formularios vizinhos.

## Elevation & Depth

Superficies estaticas usam borda e sombra de cartao sutil. Modais usam sombra
maior e fundo opaco; somente overlays, folhas e cabecalhos sticky podem competir
por elevacao. Nenhuma secao de pagina recebe moldura de cartao apenas por ornamento.

## Shapes

Controles usam raio de 6px, cartoes 8px e modais 12px. Icones Lucide mantem traco
simples; icones sem texto precisam de nome acessivel ou dica. Botoes, campos e
abas preservam dimensoes estaveis entre estados.

## Components

### Foundational visual states

`Botao`, `Campo`, `AreaTexto`, `Selecao`, `Aviso`, `AlertaOperacional`,
`EstadoVazio` e `Modal` sao a base compartilhada. Todos os controles exibem
hover, foco visivel, desabilitado e ocupado sem mudar a geometria. Carregamento
usa `BarraCarregamento` ou esqueleto com a mesma estrutura do conteudo final.

### Buttons and actions

`primario` conclui a acao principal, `secundario` preserva alternativas,
`fantasma` abriga acoes de baixa enfase e `perigo` e exclusivo de consequencias
destrutivas. O verbo exibido no botao deve reaparecer no feedback de sucesso.

### Navigation and data display

`ConsoleShell` e `PortalShell` sao donos da navegacao. `Abas` usa selecao e
teclado previsiveis. `Tabela` e responsavel pelo contorno e overflow de listas;
linhas e colunas preservam dados acessiveis quando a tela fica estreita.

O console agrupa capacidades somente em Clinica, Relacionamento e
Administracao. Menu, paleta e autorizacao consomem o catalogo canonico em
`lib/navegacao-console.ts`. No celular, um disclosure nativo substitui a faixa
horizontal: informa a area atual, revela todos os grupos por teclado e mantem
links fechados fora da ordem de foco.

Agenda usa a mesma hierarquia em semana e lista: horario, paciente/bloqueio,
estado e acao contextual. Bloqueio manual sempre oferece `Liberar horario`;
falha de Google, email ou WhatsApp aparece como estado operacional com
`Tentar integracoes novamente`, sem transformar integracao opcional em bloqueio
da agenda interna.

### Forms and overlays

Campos compartilhados usam 44px, labels associados e erros em texto. Selects e
datas nativos sao aceitos nesta etapa para `pt-BR`; toda nova variante precisa
usar `Selecao` ou justificar componente autoral. `Modal` concentra foco, fecha
com Escape e restaura o foco do gatilho.

### Iconography

Lucide e a unica familia de icones. Icone complementa texto em acoes importantes;
botao somente com icone recebe `aria-label` e dica.

### Motion

Transicoes duram 150ms e explicam interacao, nunca decoram conteudo clinico.
`prefers-reduced-motion` reduz todas as transicoes para duracao segura.

### Content and data visualization

Voz objetiva: "Salvar alteracoes", "Arquivar receita" e "Nao foi possivel
carregar" descrevem o que ocorreu e o proximo passo. Datas, horas e numeros usam
formato brasileiro e fuso explicitado quando relevante.

`GUIA_VOZ_MICROCOPY.md` e a fonte canonica para voz, glossario, acoes, erros,
vazios, confirmacoes e permissoes. O gate
`pnpm --dir octaclin-web test:linguagem` protege o texto visivel; IDs, enums,
rotas e contratos internos nao podem ser adaptados para fins de apresentacao.

## Do's and Don'ts

- **Do:** apresentar a proxima acao clinica com contexto, responsavel e estado.
- **Do:** reutilizar primitivas compartilhadas para campo, feedback, modal e tabela.
- **Don't:** criar controles visuais locais quando o componente compartilhado ja existe.
- **Don't:** usar falta de acentuacao, cor isolada ou texto tecnico como atalho de interface.
