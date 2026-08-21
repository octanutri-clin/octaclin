# Fase 248 - Estados e recuperacao das superficies clinicas

## Objetivo

Impedir que falhas transitorias interrompam o trabalho clinico ou exponham
mensagens tecnicas. Agenda, lista de pacientes e prontuario agora distinguem
carregamento, indisponibilidade e falta de permissao, preservando dados
digitados quando uma gravacao precisa ser repetida.

## Escopo concluido

1. Criado um classificador compartilhado de falhas de interface para mapear
   sessao, permissao, validacao, conflito, indisponibilidade e conteudo ausente.
2. Mensagens com JSON, HTML, status HTTP, stack, rotas internas e erros
   genericos do servidor deixam de ser exibidas ao usuario.
3. Agenda, lista de pacientes e prontuario receberam esqueletos iniciais,
   estado de permissao negada e estado de falha com acao de repeticao.
4. Falhas de criacao de consulta, paciente ou evolucao aparecem sem desmontar
   modal ou formulario; os valores digitados permanecem disponiveis.
5. Agenda semanal, pacotes, documentos, condutas, antropometria, exames,
   evolucao fotografica, cadastro e plano alimentar reutilizam o sanitizador.
6. O estado de permissao continua derivado dos contratos existentes. Nenhuma
   permissao, regra clinica, isolamento por tenant ou contrato backend mudou.
7. Adicionado gate Playwright sintetico para falha, recuperacao, preservacao de
   rascunho e acesso negado nas tres superficies.

## Fora de escopo

- redesign, reducao de densidade ou migracao ampla de controles;
- mudanca de regras clinicas, papeis, permissoes, tenancy ou banco de dados;
- retry automatico de mutacoes, que poderia duplicar operacoes sem contrato de
  idempotencia;
- tratamento dos avisos pre-existentes de efeitos React, reservado por fluxo.

## Validacao

- `pnpm --dir octaclin-web lint`: aprovado, sem erros e com 53 avisos
  pre-existentes;
- `pnpm --dir octaclin-web typecheck`: aprovado;
- `pnpm --dir octaclin-web test:authz`: 70/70 testes aprovados;
- `pnpm --dir octaclin-web test:base-visual`: contrato aprovado;
- `pnpm --dir octaclin-web build`: 123 paginas geradas e build aprovado;
- `pnpm --dir octaclin-web test:fase248`: 4/4 cenarios desktop aprovados;
- Playwright mobile da Fase 248: 4/4 cenarios aprovados;
- `pnpm --dir octaclin-web test:a11y`: 10/10 cenarios aprovados em desktop e
  mobile;
- `pnpm test:confiabilidade`: 16 referencias criticas aprovadas;
- `pnpm validate:docs`: aprovado;
- `pnpm test:security`: aprovado;
- scanner dos arquivos versionaveis: nenhum secret real identificado. O
  comando amplo `pnpm security:secrets` detectou corretamente a URL presente
  no `.env.integracao` local e ignorado pelo Git; esse arquivo nao foi lido,
  alterado ou incluido no diff;
- Chrome DevTools: arvore acessivel confirmou `alert`, titulo e acao de
  recuperacao sem JSON tecnico;
- Lighthouse em snapshot: 100 em acessibilidade, boas praticas, SEO e agentic
  browsing, com 29 auditorias aprovadas e nenhuma falha.

## Gate de regressao

O `OctaClin CI` passa a executar `pnpm test:fase248` no job `Demo local smoke`,
depois que Chromium e o servidor de demonstracao estiverem disponiveis.

## Proxima fase

- **Fase 249 - Densidade e responsividade do console clinico.**
- Modelo: **GPT-5.6 Sol, raciocinio `high`**.
- Skills: `ecc:frontend-design-direction`,
  `ecc:make-interfaces-feel-better`, `ecc:design-system`,
  `ecc:frontend-a11y` e `ecc:browser-qa`.
- Plugins/MCPs: Penpot, Chrome DevTools e Playwright.
