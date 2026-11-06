# FOOD06 — M02: fonte, ordenação global e consulta da origem

## Escopo e base

PR única #455 Draft, branch docs/food06-contratos-fontes, base36223bcd confirmada
com22 checks success e SBOM provenance SKIPPED. O incremento anterior e suas
provas permanecem em [interface](food06-interface-contribuicoes.md). Sem merge,
deploy, alteração de permissões, migration, catálogo vivo ou referência clínica.
Direitos e G06 permanecem BLOCKED; não inicia FOOD05-MDL/D18.

Risco R4 conservador: projeção/consulta de fatos clínicos autorizados. Rollback
somente de código; nenhum formato persistido, snapshot ou registro é modificado.

## Contratos implementados

- Ordem opcional `plano|contribuicao` validada por DTO e serviço; ausência conserva
  comportamento anterior, null/objeto/string desconhecida não passa no pipe.
- Ordenação da seleção inteira antes de paginar, pelo valor de porção congelado
  e classificador PA06 existente, escala8 para comparação, sem arredondar tela.
  Zero conhecido antes de desconhecidos; empates preservam ordem de origem.
  Posição global serve à apresentação, não identidade/capability ou nutrição nova.
- Grupos transportados uma vez por refeição, com total integral. Lista global usa
  posições para preservar intercalamento9,8,7 de refeições diferentes.
- Fonte/preparo/base disponíveis por allowlist do snapshot congelado, sem consulta
  ao catálogo atual. Fonte estruturada só de catálogo; composição manual/custom
  identificada, ausência explícita. Não expõe referência livre custom, contexto,
  hash/cifra, origem de grupo ou metadados de outro paciente.
- Coordenadas da refeição persistente e número de versão autorizados no detalhe.
  Modal reutiliza GET de versão existente, no-store; exige versão publicada/ID/
  número, refeição e item exatos. Projeta só nome/ingredientes/quantidades, descarta
  objetivos, observações, contextos e alternativas. Não troca o rascunho aberto.
- Cancelamento/abort, Escape/foco e403/404/409 invalidando o ancestral PA06.
  Informação de outro registro, erro interno ou resposta tardia não restaura modal.

## TDD e revisão

RED funcional inicial:4FAIL/156PASS em domínio/DTO/serviço; implementação160PASS,
repetida em Node22.23.4. Os temporários do Node22 haviam sido limpos na retomada:
o primeiro diagnóstico foi Node24, não evidência de compatibilidade com engines.
Binário Node22 recomposto via distribuição oficial com SHA256 conferido; sem
alterar engines, lockfile, dependências ou segurança. Reprodução adicional da
base36223bcd em diretório descartável Node22:5FAIL/160PASS funcionais, mantendo
a worktree intacta. Os testes novos foram copiados para a base; dois acessos de
tipo novo foram adaptados apenas no harness temporário (Reflect/variável de
janela) para compilar contra a assinatura antiga, sem retirar asserts. Primeiras
tentativas com erro de compilação não contam como RED funcional.

Web: metadados não projetados RED1; origem publicada stub RED1; GREEN33/33.
Browser RED funcional por falta de “Preparo:Cozido” com página/detalhe carregados;
primeira integração2/2 desktop/mobile. Matriz inicial38/38 antes da correção R4.

R4 independente `/root/food06_m02_ui_r4` reproduziu P2: posições válidas mas
valores crescentes ou desconhecido antes de conhecido aceitos no parser.
RED33PASS/2FAIL; correção de monotonicidade por posição, sem arredondamento,
GREEN35/35. Revisor repetiu35 testes Node22 e fechou o P2; sem achado pendente
no delta. Executou também161 testes backend em três suítes no checkpoint que
examinou; não browser, benchmark, CI ou novo PostgreSQL. Não é R4 de toda FOOD06.
Validação de ordem entre páginas é do backend; o parser verifica só sua página.

UX B/C: [relatório](../docs/agents/ux/reports/FOOD06-M02-ORIGEM-BC/consolidado.md).
Sem nova decisão de produto aplicada por opinião de persona, sem paciente real.

## Gates em execução / pendentes

- Backend completo3832PASS/170SKIPPED,377suítesPASS/9SKIPPED; focadas215PASS
  antes das quatro negativas extras do pipe (cobertas na suíte completa).
- Typecheck backend, build Nest/verificador de artefato e BFF76/76 PASS.
- Web35/35 e lint PASS; matriz38/38 antes do ajuste final de largura.
- Inspeção própria da captura revelou bloco mobile423px onde cabiam361px. RED
  funcional no build local otimizado; largura limitada ao viewport e select
  contido, sem remover rolagem/teclado da tabela. Build194páginas/tsc Web e
  matriz final38/38 no build local otimizado PASS após o ajuste. Lint final PASS.
- PostgreSQL/RLS novo: NOT RUN local. Docker disponível, mas imagem Timescale
  oficial não está cacheada e filesystem do daemon tem cerca de134MiB livres.
  Não puxar imagem grande, mudar storage/daemon nem substituir por Postgres sem
  extensões para aparentar aprovação. Prova ampliada na suíte oficial do CI:
  ordenação8antes2, posições/paginação, fonte manual, snapshots imutáveis, role
  runtime/RLS; negativos e conflitos das bases mantidos. CI do novo HEAD pendente.
- Sem carga HTTP produtiva, AT humana, R4 integral ou comparação DRI ativada.

## Progresso e próximo passo

M02 permanece parcial: este delta resolve os três itens factuais anteriores,
mas não substitui testes específicos de receitas/porções e substituição planejada
explicitamente selecionada (dependências FOOD07/FOOD05). Não inferir ingestão
real de preferência/liberação de alternativa. A FOOD06 mantém25% estimados pelo
[método fixo](progresso-food06.md),0/12 melhorias integralmente encerradas.
Concluir gates deste delta, depois completar matriz M02 e seguir M04 conforme
as dependências aprovadas. Nenhum gate skipped ou execução iniciada vira PASS.

## Desempenho do domínio — evidência delimitada

Node22.23.4,10.000 alimentos sintéticos em2planos×50refeições×100itens,
25retornados por ordenação global, três execuções:390,43/250,67/252,25ms.
Reutiliza classificador/motor existente. Não é teste HTTP, banco/cifra, capacidade
concorrente, orçamento de latência aprovado ou prova de carga de produção.

## Reprodução

No backend, Node22 no PATH: Jest `--runInBand` e arquivos específicos de domínio,
DTO, projeção/serviço; suíte completa sem filtro; `tsc --noEmit`; `nest build` e
`scripts/verificar-artefato-producao.mjs`. No Web: harness
`scripts/test-calculo-combinado-planos.mjs`, `scripts/test-planos-alimentares-bff.mjs`,
ESLint dos quatro arquivos novos/alterados, Next `build --webpack` e `tsc --noEmit`.
Playwright com configuração oficial, specs `food06-tabela-factual` e
`pa06-calculo-combinado`, desktop/mobile. Servidor local3100, dados sintéticos,
E2E_REUSE_EXISTING_SERVER=true. Nenhuma chamada mutável externa.

Dependências reutilizadas do cache local por symlink, sem reinstalação/lockfile.
Artefatos visuais ignorados desta worktree preservados/movidos para/tmp e caminho
local mantido por symlink por falta de espaço; não é alteração do repositório ou
da configuração do CI. Imagens finais selecionadas e manifesto de hashes versionados no relatório.
Inspeção própria confirmou modal legível e detalhe contido; personas não viram
as capturas. R4 manteve parecer delimitado após leitura estática do ajuste CSS.
