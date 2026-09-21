# Plano da Fase 272 - biblioteca de condutas/orientacoes reutilizaveis (PB-23)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-21, depois do push da Fase 271 (PB-15) nesta mesma
branch (`claude/jolly-turing-1eup7k`). Quarto item da **Onda 3 - devolver
tempo ao profissional**, na ordem definida pelo proprietario: PB-13, PB-14,
PB-15, **PB-23**, PB-16, PB-25.

## 2. O gap, confirmado no codigo

`condutas_terapeuticas`/`condutas_terapeuticas_versoes` (modulo `pacientes`)
ja tem um desenho solido -- tipo fechado (`meta`/`orientacao`/`suplemento`/
`produto`/`formula_manipulada`), versionamento com estados
rascunho/publicada/descartada, validade e titulo/conteudo cifrados em
repouso. Mas **nao existe nenhum conceito de conduta reutilizavel**: titulo e
conteudo sao digitados do zero a cada conduta nova, sem categoria, busca ou
biblioteca. E exatamente o padrao ja resolvido em `questionarios` (biblioteca
de perguntas) que o documento de auditoria pede para replicar: "Biblioteca de
condutas/orientacoes reutilizaveis, no molde da biblioteca de perguntas que
ja existe" (`OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, linha 354), justificado pela
conclusao geral da secao 1: "Nao e preciso inventar padrao novo: e preciso
replicar o que ja foi resolvido" (linha 69).

## 3. O que a biblioteca de perguntas faz, e o que desta fase replica -- e o que nao

Leitura do codigo antes de implementar (`ServicoQuestionarios`,
`pergunta.orm.ts`, `categoria-pergunta.orm.ts`) mostrou o padrao de
referencia com mais detalhe do que a frase do audit sugere, e tres pontos
dele nao se aplicam a condutas sem custo real:

1. **Perguntas reaproveitam a mesma tabela** (`perguntas`, com a flag
   `visivelBiblioteca`) porque toda pergunta -- de biblioteca ou nao -- ja
   precisa pertencer a um `questionarioId`. Condutas nao tem equivalente: uma
   conduta sempre pertence a um `pacienteId` (`NOT NULL`), e um item de
   biblioteca nao pertence a nenhum paciente. Reproduzir o mesmo mecanismo
   exigiria tornar `paciente_id` opcional em `condutas_terapeuticas` e
   reescrever toda consulta que assume esse escopo -- mudanca bem maior que o
   necessario. **Decisao**: tabela nova e dedicada, `biblioteca_condutas`,
   igual ao padrao ja usado (e menor) do PB-13/PB-15 (`modelos_plano_alimentar`/
   `modelos_evolucao_clinica`), que ja resolveu exatamente esse problema de
   desacoplar um "conteudo reutilizavel" da entidade presa a um paciente.
2. **Perguntas sao copiadas por uma rota dedicada** (`incluirPerguntaBiblioteca`)
   porque a copia envolve tambem as `opcoes_pergunta` associadas e um
   `questionarioId` de destino que ja existe antes da inclusao. Uma conduta
   nao tem sub-entidades para copiar, e o "destino" e simplesmente o
   formulario de nova conduta que o profissional ainda esta preenchendo.
   **Decisao**: sem rota de "aplicar" -- mesmo principio ja usado no PB-13 e
   no PB-15 (nao duplicar a validacao clinica que `POST
   /pacientes/:id/condutas-terapeuticas` ja faz). O cliente le o item da
   biblioteca (`GET`) e pre-preenche tipo/titulo/conteudo localmente antes de
   criar a conduta pelo fluxo normal.
3. **Categoria de pergunta e uma entidade de primeira classe**
   (`categorias_pergunta`: nome, icone, cor, gerenciada pelo profissional),
   porque o tema de uma pergunta e livre (clinica define). Conduta terapeutica
   ja tem uma taxonomia fechada e usada em todo o sistema --
   `TipoCondutaTerapeutica`. Criar uma segunda categorizacao livre ao lado do
   `tipo` existente duplicaria classificacao (qual e a fonte de verdade ao
   aplicar um item da biblioteca -- o `tipo` dele ou a `categoria`
   escolhida?) e abriria uma tela de gestao de categorias que o audit nao
   pede. **Decisao**: reusar o enum `TipoCondutaTerapeutica` ja existente
   como o proprio filtro/organizacao da biblioteca, sem tabela de categorias
   nova.

O que **e** replicado do padrao de perguntas, porque se aplica sem atrito:
biblioteca sempre **compartilhada no tenant inteiro** (sem separacao
pessoal/clinica -- diferente do PB-13/PB-15, que tem origem `pessoal`/
`clinica`; perguntas nao tem essa separacao e condutas tambem nao precisam
dela, um item de biblioteca de conduta e conhecimento da clinica, nao de um
profissional individual), filtro por tipo/categoria, e a decisao de produto
ja registrada na Fase 171 (biblioteca de perguntas) de a copia nao poluir a
biblioteca por padrao -- aqui equivalente por construcao, ja que criar uma
conduta real a partir de um item de biblioteca nunca grava de volta na
biblioteca.

## 4. Busca: por que nao ha busca textual server-side

A biblioteca de perguntas busca por texto porque `enunciado` e armazenado em
claro. `titulo`/`conteudo` de conduta terapeutica sao cifrados em repouso na
tabela real (`titulo_criptografado`/`conteudo_criptografado`) -- e este
fluxo carrega orientacao clinica real, digna da mesma protecao. Replicar a
busca textual exigiria guardar titulo em claro na biblioteca, uma
inconsistencia deliberada com o resto do modulo (inclusive com
`modelos_plano_alimentar`/`modelos_evolucao_clinica`, que ja cifram `nome`)
so por conveniencia de UX. **Decisao**: `biblioteca_condutas` cifra
titulo/conteudo como a tabela real; a lista carrega ate 100 itens (mesmo
teto do PB-13/PB-15) com nome decifrado so na listagem, num seletor simples
-- mesma UX ja usada em `ModelosPlanoAlimentar`/`ModelosEvolucaoClinica`,
sem campo de busca textual. O unico filtro server-side e por `tipo`
(coluna em claro), sem decifrar nada no banco.

## 5. Desenho

- Tabela nova `biblioteca_condutas`: `tipo` (mesmo enum), `nome_criptografado`
  (nome do item na biblioteca, ex.: "Orientacao pos-consulta padrao"),
  `conteudo_criptografado` (o corpo do texto que vira `conteudo` da conduta
  real), `tamanho_conteudo` (contagem em claro, mesmo padrao do PB-15),
  `criado_por_usuario_id`, `arquivado_em`, timestamps. RLS + FORCE RLS +
  policy de isolamento por tenant. Sem `profissional_id`/`origem`: visibilidade
  e sempre tenant inteiro, entao nao ha filtro de visibilidade a fazer (mais
  simples que o dominio de PB-13/PB-15, que existia so para essa regra).
- `ServicoBibliotecaCondutas`: `criar`/`listar`/`obter`/`arquivar`, permissoes
  `pacientes.ler`/`pacientes.gerenciar` (mesmas ja exigidas para condutas
  terapeuticas), papel `SuperAdmin`/`Professional` (mesma restricao do
  `ServicoCondutasTerapeuticas`).
- `ControladorBibliotecaCondutas` em `biblioteca-condutas` (fora de
  `/pacientes/:id`, mesmo padrao de `evolucoes/modelos` e
  `planos-alimentares/modelos` -- nome da rota espelha literalmente
  `biblioteca-perguntas`, a referencia do audit).
- Frontend: componente `BibliotecaCondutas` (mesmo contrato de
  `ModelosEvolucaoClinica`, sem seletor de filtro na UI -- lista tudo, ate
  100 itens, mesma UX de `ModelosPlanoAlimentar`/`ModelosEvolucaoClinica`):
  lista + "Aplicar" (preenche tipo/titulo/conteudo do formulario de **nova**
  conduta -- so aparece quando `!editando`, ja que biblioteca serve para
  comecar uma conduta nova, nao para editar rascunho existente; `nome` do
  item vira `titulo` inicial da conduta) e "Salvar na biblioteca" (le tipo/
  titulo/conteudo atuais do formulario). O filtro por `tipo` fica disponivel
  na API (`ListarBibliotecaCondutasDto.tipo`) para uso futuro, sem controle
  de UI dedicado nesta fase -- mesmo criterio de escopo minimo do PB-13/
  PB-15. Plugado em `AbaCondutasTerapeuticas`.

## 6. Seguranca e auditoria

Nenhuma mudanca de fronteira de autorizacao existente; novo recurso segue o
mesmo par de permissoes ja usado por condutas terapeuticas. `criar`/`arquivar`
registram auditoria via `registrarAuditoriaNaTransacao` (recursoTipo
`biblioteca_conduta`), metadados so com `tipo` (nunca titulo/conteudo
clinico). Tabela nova entra automaticamente no gate exaustivo de RLS.

## 7. Implementacao e evidencia

Implementado nesta branch (`claude/jolly-turing-1eup7k`) em 2026-09-21,
logo apos o push da Fase 271 (PB-15).

**Backend** (`octaclin-backend`):
- Migration aditiva `1720000001050-CriarBibliotecaCondutas` (tabela
  `biblioteca_condutas`, RLS/FORCE RLS, policy de isolamento por tenant,
  `tipo` restrito ao mesmo enum de `condutas_terapeuticas`, sem coluna de
  profissional/origem). Registrada em `opcoes-typeorm.ts`.
- `ServicoBibliotecaCondutas` (`criar`/`listar`/`obter`/`arquivar`) --
  mais simples que `ServicoModelosEvolucaoClinica`: sem dominio dedicado,
  porque nao ha regra de visibilidade pessoal/clinica a decidir (biblioteca
  e sempre do tenant inteiro).
- `ControladorBibliotecaCondutas` em `biblioteca-condutas` (fora de
  `/pacientes/:id`), anexado ao mesmo arquivo de
  `ControladorCondutasTerapeuticas`.
- DTOs novos em `dtos.ts` (`CriarBibliotecaCondutaDto`,
  `ListarBibliotecaCondutasDto`).
- Auditoria com literal direto em `registrarAuditoriaNaTransacao` (sem
  envoltorio privado indireto como em PB-13/PB-15): o gate
  `validar-redacao-auditoria.mjs` passou sem precisar de entrada nova em
  `ENVOLTORIOS_DECLARADOS`.

**Frontend** (`octaclin-web`):
- `lib/condutas-terapeuticas-api.ts`: tipos e funcoes
  `listarBibliotecaCondutas`, `obterBibliotecaConduta`,
  `criarBibliotecaConduta`, `arquivarBibliotecaConduta`.
- BFF novo em `app/api/biblioteca-condutas/` (`route.ts`,
  `[itemId]/route.ts`, `_proxy.ts`), mesmo padrao de permissao-antes-do-proxy
  do PB-15.
- Componente `BibliotecaCondutas`, plugado em `AbaCondutasTerapeuticas`
  (visivel so quando `podeGerenciar && !editando`).
- Testes BFF novos: `scripts/biblioteca-condutas-bff.spec.ts` +
  `scripts/test-biblioteca-condutas-bff.mjs`, adicionado a cadeia
  `pnpm test:authz`.
- Playwright novo em `tests/visual/console-regression.spec.mjs`: "permite
  aplicar e salvar item na biblioteca de condutas (PB-23)", desktop e
  mobile. O fixture compartilhado `prepararProntuarioMockado` ganhou mock
  de `biblioteca-condutas`.

**Validacoes executadas nesta branch**:
- `pnpm --dir octaclin-backend typecheck` -- limpo.
- Suite completa do backend: 208 suites, 2002 testes, 0 falhas (3 suites/31
  testes SKIPPED por falta de Docker nesta sandbox -- RLS via testcontainers,
  mesma limitacao ja documentada).
- `node scripts/validar-redacao-auditoria.mjs`,
  `node --test scripts/validar-guardas-controladores.spec.mjs`,
  `node scripts/validar-migracoes-fora-de-banda.mjs`,
  `node scripts/validar-inventario-security-quality.mjs` -- limpos.
- `pnpm --dir octaclin-backend build` -- limpo.
- `pnpm --dir octaclin-web typecheck` -- limpo.
- `pnpm --dir octaclin-web lint` -- 0 erros (2 warnings novos, mesma classe
  ja tolerada `react-hooks/set-state-in-effect`, uma delas pre-existente no
  proprio `aba-condutas-terapeuticas.tsx`).
- `pnpm --dir octaclin-web test:authz` -- verde, incluindo o par novo
  `biblioteca-condutas-bff`.
- `pnpm --dir octaclin-web build` -- limpo; rotas `/api/biblioteca-condutas`
  e `/api/biblioteca-condutas/[itemId]` presentes no manifesto.
- Playwright: `console-regression.spec.mjs` completo (120 cenarios,
  desktop+mobile) -- 100% verde, incluindo o cenario novo do PB-23 e o
  cenario pre-existente da Fase 239 (jornada de conduta terapeutica), que
  nao regrediu com o componente novo plugado na mesma tela.
- `git diff --check` e `pnpm security:secrets` -- limpos.
- Gates de raiz da "Governanca de repositorio" (a11y:matriz, confiabilidade,
  resposta-auditoria, actions-imutaveis, seguranca-dinamica,
  triagem-seguranca, tooling-agentes, versao-pnpm, excecoes-supply-chain,
  grupos-dependabot, versao-node, dockerfiles-runtime, licencas, lock-python,
  sbom) -- todos verdes. `test:workflows-seguros` reprova so o subteste que
  exige PowerShell, indisponivel nesta sandbox Linux -- mesma limitacao de
  ambiente ja documentada na Fase 271, nao uma regressao desta fase.

**Pendencias**: checks remotos de CI e merge humano.
