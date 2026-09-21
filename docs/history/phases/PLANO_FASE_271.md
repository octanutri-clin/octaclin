# Plano da Fase 271 - template de evolucao clinica com pre-preenchimento (PB-15)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-21, depois do merge das Fases 269 (PB-13, PR `#277`)
e 270 (PB-14, PR `#278`).

Terceiro item da **Onda 3 - devolver tempo ao profissional**, na ordem
definida pelo proprietario: PB-13, PB-14, **PB-15**, PB-23, PB-16, PB-25.

## 2. O gap, confirmado no codigo

`evolucoes_clinicas` (modulo `pacientes`) e texto livre puro: titulo, tipo
(`consulta`/`retorno`/`observacao`/`ajuste_plano`) e conteudo criptografado,
sem nenhum modelo, clonagem ou pre-preenchimento. O profissional redigita a
mesma estrutura a cada evolucao e reescreve peso/IMC que o sistema ja tem em
`avaliacoes_antropometricas`.

O documento de auditoria (`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`,
linha 355) descreve o alvo como "template de evolucao clinica por
profissional, com pre-preenchimento do peso/IMC registrados na mesma
consulta".

## 3. Gap adicional encontrado (nao adivinhado): nao existe vinculo de consulta

Leitura do codigo antes de implementar mostrou que a formulacao literal --
"peso/IMC **da mesma consulta**" -- nao e implementavel hoje sem mudanca de
escopo maior: nem `evolucoes_clinicas` nem `avaliacoes_antropometricas` tem
`consulta_id`. A unica entidade do produto com esse vinculo e
`documento_emitido` (Fase de documentos clinicos). Vincular avaliacao
antropometrica a consulta exigiria mudar o fluxo de registro da avaliacao
(hoje uma tela independente do prontuario, sem nocao de "consulta em
andamento"), o que e escopo de produto proprio, nao uma consequencia natural
do PB-15.

**Decisao de escopo desta fase**: pre-preenchimento usa a avaliacao
antropometrica mais recente do paciente cuja data (`avaliadaEm`, data civil)
seja a data de hoje -- uma correlacao por dia, nao um vinculo formal de
`consulta_id`. Na pratica isso cobre o caso real que o audit descreve (o
profissional pesa o paciente e registra a evolucao na mesma visita), sem
tocar o fluxo de registro de avaliacao antropometrica nem abrir uma segunda
fonte de verdade sobre "qual consulta". "Vincular evolucao/avaliacao/conduta
a consulta de origem" continua como gap de produto separado, ja registrado no
documento de auditoria (secao 6.B), fora do escopo do PB-15.

Consequencia pratica: **o pre-preenchimento de peso/IMC nao precisa de rota
nova nem de migration.** `GET /pacientes/:id/avaliacoes-antropometricas' ja
devolve a serie completa, decifrada, com `avaliadaEm` e `medidas.pesoKg`/
`resultado.imc`; a Fase 264.5 ja usa essa mesma rota para comparar avaliacoes
quaisquer. O frontend busca a serie ao abrir a aba de evolucoes e, se houver
avaliacao datada de hoje, pre-preenche o corpo da evolucao com peso/IMC —
sem novo dado no backend, sem novo endpoint.

## 4. Templates de evolucao clinica: mesmo padrao arquitetural do PB-13

Reaproveita ponto a ponto o desenho de `ServicoModelosPlanoAlimentar` (Fase
269), inclusive a decisao de nao ter rota de "aplicar":

- Tabela nova `modelos_evolucao_clinica`: `origem` (`pessoal`/`clinica`),
  `profissional_id` (so em `pessoal`, mesma constraint check
  origem/profissional), `nome_criptografado`, `tipo` (mesmo enum de
  `evolucoes_clinicas.tipo`, em claro -- e metadado de classificacao, nao
  conteudo clinico), `conteudo_criptografado` (o corpo do texto), contagem em
  claro `tamanho_conteudo` para a listagem nao precisar decifrar, exclusao
  logica por `arquivado_em`. RLS + FORCE RLS + policy de isolamento por
  tenant, identico ao padrao de `modelos_plano_alimentar`.
- **Sem rota de "aplicar modelo"**, pelo mesmo motivo ja documentado no PB-13:
  o cliente le o modelo (`GET /evolucoes/modelos/:modeloId`) e o formulario de
  nova evolucao pre-preenche `tipo`/`conteudo` localmente; o salvamento
  continua passando pela validacao normal de `POST /pacientes/:id/evolucoes`.
  Duplicar essa validacao numa rota de aplicacao e como duas passam a
  divergir.
- Visibilidade resolvida no filtro SQL (nao pos-filtro), `obter()` devolve 404
  (nao 403) para modelo pessoal de outro profissional -- identico ao PB-13.
- Escopo de papel: so `SuperAdmin`/`Professional` podem criar/gerenciar
  modelo, mesma restricao do PB-13. Evolucao em si permite `Collaborator`
  criar evolucao (`pacientes.gerenciar`), mas um modelo "pessoal" exige
  profissional vinculado -- `Collaborator` nao tem; continua podendo usar
  modelos de origem `clinica`.
- Permissoes reaproveitadas do proprio modulo pacientes: `pacientes.ler` para
  listar/obter, `pacientes.gerenciar` para criar/arquivar (mesmas exigidas
  hoje para listar/criar evolucao).
- Rota fora de `/pacientes/:id`, igual ao padrao de
  `planos-alimentares/modelos`: um modelo nao pertence a um paciente.
  `GET/POST /evolucoes/modelos`, `GET/DELETE /evolucoes/modelos/:modeloId`.

## 5. Migration

`1720000001049-CriarModelosEvolucaoClinica.ts`: aditiva, cria so a tabela
nova (RLS completo, FKs para `tenants`/`profissionais`/`usuarios`, mesma
constraint de origem/profissional do PB-13). Nao toca `evolucoes_clinicas`
nem `avaliacoes_antropometricas`. `down` remove a tabela.

## 6. Frontend

- `ModelosEvolucaoClinica` (componente novo, mesmo contrato de
  `ModelosPlanoAlimentar`): seletor de modelo existente + "Aplicar" (chama
  callback do pai, que substitui `tipo`/`conteudo` do formulario) e "Salvar
  como modelo" (le `tipo`/`conteudo` atuais do formulario). Montado dentro do
  formulario de "Nova evolucao clinica" em `prontuario-paciente.tsx`.
- Pre-preenchimento: ao abrir a aba "Evolucoes", busca
  `listarAvaliacoesAntropometricas(pacienteId)` (rota ja existente, ja
  autorizada, ja usada por `AbaAntropometria`/Fase 264.5) e procura a
  avaliacao mais recente com `avaliadaEm` igual a hoje (data local do
  navegador). Se existir e o campo `conteudo` do formulario ainda estiver
  vazio, pre-preenche a primeira linha com peso/IMC, com legenda indicando a
  data de origem; o texto e comum, editavel/removivel como qualquer parte do
  corpo -- nunca sobrescreve conteudo que o profissional ja tenha digitado.

## 7. Seguranca e auditoria

- Nenhuma mudanca de fronteira de autorizacao existente; novo recurso segue o
  mesmo par de permissoes ja usado por evolucao clinica.
- `criar`/`arquivar` de modelo registram auditoria via
  `registrarAuditoriaNaTransacao` (recursoTipo `modelo_evolucao_clinica`),
  mesma forma nomeada exigida pelo gate `validar-redacao-auditoria` (nunca
  conteudo clinico nos metadados, so origem/tipo/contadores).
- Tabela nova entra automaticamente no gate exaustivo de RLS
  (`rls-isolamento-tenant.integracao.spec.ts`), que descobre tabelas pelo
  catalogo do Postgres.

## 8. Limitacao registrada explicitamente

Pre-preenchimento por "mesma data", nao por vinculo formal de consulta: duas
avaliacoes no mesmo dia (raro, mas possivel) fazem o sistema escolher a mais
recente das duas; nao ha como o profissional pedir "a avaliacao da consulta
de tal horario" especificamente. Vinculo formal `consulta_id` em
evolucao/avaliacao antropometrica fica registrado como gap de produto
separado (mesma secao 6.B da auditoria), nao resolvido por esta fase.

## 9. Implementacao e evidencia

Implementado nesta branch (`claude/jolly-turing-1eup7k`) em 2026-09-21.

**Backend** (`octaclin-backend`):
- Migration aditiva `1720000001049-CriarModelosEvolucaoClinica` (tabela
  `modelos_evolucao_clinica`, RLS/FORCE RLS, policy de isolamento por
  tenant, mesma constraint origem/profissional do PB-13). Registrada em
  `opcoes-typeorm.ts` (lista de migrations e de entidades).
- Dominio puro `modelos-evolucao-clinica.ts` (`podeAcessarModeloEvolucao`),
  espelhando `modelos-plano-alimentar.ts`.
- `ServicoModelosEvolucaoClinica` (`criar`/`listar`/`obter`/`arquivar`),
  mesma postura de seguranca do PB-13: visibilidade filtrada em SQL, 404 (nao
  403) para modelo pessoal de outro profissional, sem rota de "aplicar".
- `ControladorModelosEvolucaoClinica` em `evolucoes/modelos` (fora de
  `/pacientes/:id`), reaproveitando as permissoes `pacientes.ler`/
  `pacientes.gerenciar` ja existentes para evolucao.
- DTOs novos em `dtos.ts` (`CriarModeloEvolucaoClinicaDto`,
  `ListarModelosEvolucaoClinicaDto`).
- **Pre-preenchimento de peso/IMC nao exigiu nenhuma mudanca de backend**:
  reaproveita a rota `GET /pacientes/:id/avaliacoes-antropometricas` ja
  existente e ja autorizada (mesma usada pela Fase 264.5).
- Gate `validar-redacao-auditoria.mjs`: o envoltorio privado
  `registrarAuditoria` de `ServicoModelosEvolucaoClinica` precisou de entrada
  propria em `ENVOLTORIOS_DECLARADOS` (`scripts/validar-redacao-auditoria.mjs`),
  mesmo gemeo ja declarado para `servico-modelos-plano-alimentar.ts`.

**Frontend** (`octaclin-web`):
- `lib/prontuario-api.ts`: tipos e funcoes `listarModelosEvolucaoClinica`,
  `obterModeloEvolucaoClinica`, `criarModeloEvolucaoClinica`,
  `arquivarModeloEvolucaoClinica`.
- BFF novo em `app/api/evolucoes/modelos/` (`route.ts`,
  `[modeloId]/route.ts`, `_proxy.ts`), mesmo padrao de
  `executarProxyPlanoAlimentar` (permissao exigida antes do proxy).
- Componente `ModelosEvolucaoClinica` (mesma UX de `ModelosPlanoAlimentar`:
  aplicar substitui tipo/conteudo local, salvar captura o estado atual do
  formulario), plugado no formulario de "Nova evolucao clinica" em
  `prontuario-paciente.tsx`.
- `carregarEvolucoes` passou a buscar tambem `avaliacoes-antropometricas` em
  paralelo (falha isolada, nunca derruba a lista de evolucoes) e um novo
  `useEffect` pre-preenche peso/IMC quando ha avaliacao de hoje e o campo
  `conteudo` ainda esta vazio -- nunca sobrescreve o que o profissional ja
  digitou ou trouxe de um modelo.
- Testes BFF novos: `scripts/evolucoes-modelos-bff.spec.ts` +
  `scripts/test-evolucoes-modelos-bff.mjs`, adicionado a cadeia
  `pnpm test:authz`.
- Playwright novo em `tests/visual/console-regression.spec.mjs`: "permite
  aplicar e salvar modelo de evolucao clinica (PB-15)" e "pre-preenche peso e
  IMC quando ha avaliacao antropometrica de hoje (PB-15)", desktop e mobile.
  O fixture compartilhado `prepararProntuarioMockado` ganhou mock de
  `evolucoes/modelos`; `fase-248-estados-recuperacao.spec.mjs` tambem ganhou
  esse mock (helper `prepararProntuario` proprio do arquivo) para nao
  depender de rede real na jornada de recuperacao apos falha.

**Validacoes executadas nesta branch**:
- `pnpm --dir octaclin-backend typecheck` -- limpo.
- Suite completa do backend: 206 suites, 1985 testes, 0 falhas (3 suites/31
  testes SKIPPED por falta de Docker nesta sandbox -- RLS via testcontainers,
  mesma limitacao ja documentada em fases anteriores).
- `node scripts/validar-redacao-auditoria.mjs`,
  `node --test scripts/validar-guardas-controladores.spec.mjs`,
  `node scripts/validar-migracoes-fora-de-banda.mjs`,
  `node scripts/validar-inventario-security-quality.mjs` -- limpos.
- `pnpm --dir octaclin-backend build` (Nest + verificacao de artefato) --
  limpo.
- `pnpm --dir octaclin-web typecheck` -- limpo.
- `pnpm --dir octaclin-web lint` -- 0 erros (58 warnings pre-existentes no
  repositorio, incluindo uma nova ocorrencia do padrao ja tolerado
  `react-hooks/set-state-in-effect` no `useEffect` de pre-preenchimento,
  mesma classe das 5 ja existentes no mesmo arquivo).
- `pnpm --dir octaclin-web test:authz` -- verde, incluindo o par novo
  `evolucoes-modelos-bff`.
- `pnpm --dir octaclin-web build` -- limpo; rotas `/api/evolucoes/modelos` e
  `/api/evolucoes/modelos/[modeloId]` presentes no manifesto.
- Playwright: `console-regression.spec.mjs` completo (118 cenarios,
  desktop+mobile) e `jornadas-criticas.spec.mjs` completo (12 cenarios) --
  100% verde, incluindo os dois cenarios novos do PB-15 e o orcamento de
  performance de endpoints do resumo (nao regrediu).
- `git diff --check` e `pnpm security:secrets` -- limpos.
- Gates de raiz da "Governanca de repositorio" (a11y:matriz, confiabilidade,
  resposta-auditoria, actions-imutaveis, seguranca-dinamica,
  triagem-seguranca, tooling-agentes, versao-pnpm, excecoes-supply-chain,
  grupos-dependabot, versao-node, dockerfiles-runtime, licencas, lock-python,
  sbom) -- todos verdes. `test:workflows-seguros` reprova só o subteste que
  exige PowerShell (`validar-preflight-fail-closed.spec.mjs`), indisponivel
  nesta sandbox Linux -- mesma limitacao de ambiente ja documentada em ciclos
  anteriores (ex.: PR `#279`), nao uma regressao desta fase.

**Pendencias**: checks remotos de CI e merge humano.
