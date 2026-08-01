# Fase 193 - Pacientes e prontuario orientados a conduta

Status: concluida e validada localmente em 2026-07-31.

## Ja satisfeito por fases anteriores (sem trabalho novo)

- Colunas de risco/responsavel/proxima acao na lista: entregues na Fase 179.
- Cabecalho persistente e "Linha de cuidado" no prontuario: entregues na Fase 180.
- Separacao de resumo/evolucoes/plano/formularios/mensagens/materiais/historico
  em abas: entregue na Fase 180 (`Abas`).

## Entregue nesta fase

- **Filtros da lista de pacientes genuinamente persistidos**
  (`components/cadastros/lista-pacientes.tsx`): busca, risco, responsavel,
  situacao e "sem consulta futura" agora sincronizam com a URL
  (`?busca=&risco=&profissional=&status=&semRetorno=1`) via `router.replace`
  com `scroll: false`. Antes eram só `useState` em memoria e se perdiam a
  cada reload ou navegacao.
- **Cadastro/edicao de paciente em modal**: o card "Novo paciente"/"Editar
  paciente", antes sempre visivel na pagina, virou um `Modal` acionado por um
  botao "Novo paciente" no cabecalho da lista (mesmo padrao ja usado na
  agenda na Fase 192).
- **Protecao contra perda de evolucao clinica em edicao**
  (`components/pacientes/prontuario-paciente.tsx`): com titulo ou conteudo
  preenchido e nao salvo, (a) fechar/recarregar a aba dispara o aviso nativo
  `beforeunload` do navegador; (b) trocar de aba do prontuario ou clicar em
  "Voltar para pacientes" pede confirmacao (`window.confirm`) antes de
  descartar o rascunho.
- **Correcao de regressao da Fase 192**: o atalho "Novo paciente" do
  dashboard (`/pacientes#novo-paciente`, criado na Fase 190) parou de fazer
  sentido quando o formulario virou modal fechado por padrao. Adicionado
  `useEffect` que abre o modal quando a pagina carrega com esse hash. O mesmo
  problema existia silenciosamente desde a Fase 192 para o atalho
  `/agenda#novo-agendamento` — corrigido junto nesta fase.
- **Bug de build encontrado e corrigido**: `useSearchParams()` novo em
  `ListaPacientes` exigia um limite de `Suspense` na pagina (regra do Next.js
  App Router), como `agenda/page.tsx` ja tinha; adicionado em
  `app/pacientes/page.tsx`.

## Limites deliberados

- Nao foi criado um componente de "painel lateral" (drawer) novo — reaproveitado
  o `Modal` centralizado, mesma decisao da Fase 192.
- "Reduzir cartoes e informacao simultanea" no prontuario nao teve mudanca
  estrutural nova: a Fase 180 ja fez essa separacao por abas: nao havia
  card duplicado ou informacao redundante restante a remover neste ciclo.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web run build
pnpm --dir octaclin-web exec playwright test tests/visual/jornadas-criticas.spec.mjs tests/visual/console-regression.spec.mjs tests/visual/acessibilidade.spec.mjs --reporter=list
pnpm --dir octaclin-web run test:authz
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Resultados: typecheck/lint/build limpos (build so passou apos corrigir a
falta de `Suspense`); 68 cenarios Playwright aprovados (uma falha isolada em
"/dashboard renderiza sem regressao visual" foi flaky — confirmada passando
sozinha em nova execucao, sem relacao com o diff desta fase); 22 verificacoes
de autorizacao/BFF; scanner de secrets sem achados; preflight documental OK.

## Proxima fase

Fase 194 - Formularios, editor e leitura longitudinal.
