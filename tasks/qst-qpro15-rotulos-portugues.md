# QPRO-15-A — português dos rótulos estáticos do console

## Escopo e diagnóstico

Base `65ec84192745ca21eb5c2951383281396fa09a51` (merge #573), branch
`fix/qst-rotulos-portugues`. Incremento independente da #574; sem integração
implícita, FOOD06, backend, BFF, dependências ou infraestrutura. Risco editorial
R0: somente strings de apresentação e atualização de expectativas existentes.

O console mostrava “Multipla escolha”, “Metrica”, “Distribuicoes”, “Media”,
“comparaveis”, “Sem comparacao” e configurações de escala sem acentuação.
Correção mínima em `area-editor.tsx`, `area-respostas.tsx` e
`editor-questionario.tsx`, dentro de `octaclin-web/components/questionarios/`.
IDs, enums, chaves, cálculos, ações, ordem e conteúdo editável foram preservados.
A média continua sendo o valor `mediaRespostasPorEnvio`, produzido pelo backend
como valores respondidos por envio; nenhuma mudança de agregação.

## Compatibilidade e limites

Não altera nomes, perguntas ou respostas gravados. `Nao` do formatador dinâmico
e valores padrão graváveis, inclusive `Sem secao`, ficam fora do incremento.
O formatador também participa da busca literal; corrigir sua grafia exige
verificação própria de compatibilidade. Não normaliza acentos nem muda CSV.
QPRO-15 global permanece **PARCIAL**: este incremento cobre rótulos estáticos,
não toda a linguagem do módulo. Prévia pode continuar exibindo texto legado.

Sem mudança de autorização, tenancy, RLS, contratos, persistência, publicação
ou acesso do paciente. Rollback é reversão editorial da PR, sem operação de banco.

## Evidências

- RED funcional: teste existente de recorrência passou a procurar a aba
  “Distribuições”; antes da correção, falhou aguardando o nome acessível.
  Uma primeira tentativa com projeto inexistente `desktop` foi falha de setup,
  **não RED**; repetição correta em `desktop-chromium` demonstrou a lacuna.
- GREEN/regressões: **118/118 PASS**, editor 50 e respostas 68, nos projetos
  desktop-chromium e mobile-chromium (6,1 min), no delta funcional descrito.
- Typecheck e lint direcionado: **PASS**; linguagem: **8/8 PASS** e gate
  de interface **PASS** com Node 22.21.1.
- Revisão própria do diff e `git diff --check`: **PASS**; scanner local de
  segredos: **PASS**, sem secret real detectado pelos padrões locais.
- Evidências de interface: capturas sintéticas desktop e Pixel 5 no relatório
  [UX](../docs/agents/ux/reports/QPRO-15A-ABC-2026-11-23/consolidado.md).
- Backend/RLS, build completo, leitor de tela manual e produção: SKIPPED,
  sem fronteira alterada neste delta editorial. Testes browser não provam banco.
- Node 22.21.1. Dependências locais reutilizadas, Next 16.3.8 versus manifesto
  ^16.4.5; build/instalação canônica ficam para o CI do HEAD enviado.
- Sem testes novos espelhando strings: reaproveitados navegação, contagens,
  edição, respostas, teclado, ampliação e axe existentes. Asserções numéricas
  e de comportamento mantidas.

## UX e próxima etapa

A/D: persona profissional favorável ao escopo, com ressalva sobre unidade de
agregação e ausência de interpretação clínica; checagem no código preserva isso.
Paciente N/A: alteração restrita ao console, sem mudança da prévia/portal.
B/C e limitações estão no relatório vinculado. Nenhuma nova decisão de produto.

Após os checks: revisão e merge somente pelo fluxo autorizado pelo proprietário.
Próxima tarefa proposta: planejar correção dos textos dinâmicos/padrões com
compatibilidade de busca e conteúdo legado, sem modificar respostas salvas.
Não iniciada neste incremento. Sem merge, deploy ou migrations.

## Entrega

CI do novo HEAD: pendente após publicação, não herda o PASS de outra PR.
Mudanças geradas por Next em `next-env.d.ts` removidas somente desta worktree.
Sem alteração da main ou de arquivos de outras worktrees.

## Retomada de CI — 23/11/2026

HEAD inicial `b47132d814c7b2b41ec88cc2d1cf7f8dcbc43e66`, run
[45089637299](https://github.com/octanutri-clin/octaclin/actions/runs/45089637299):
Backend, Web (incluindo build canônico), Mobile, governança e scanners PASS;
Demo local smoke FAIL e PR Gate FAIL por consequência. Nos logs do job
137419718203, o smoke visual terminou com **6 falhas, 1 flaky, 10 skipped e
1439 passed**. Não é PASS global. Etapas posteriores de estados, densidade,
linguagem e jornada de microcopy SKIPPED após essa falha.

Causa das seis falhas: três seletores de aba ainda procuravam “Distribuicoes”
em `tests/visual/acessibilidade.spec.mjs`: distribuição (1597), alternância de
áreas por teclado (1631) e criação/distribuição integral por teclado (5926).
Os três cenários falharam nos dois projetos, inclusive retry. O delta anterior
omitiu esse consumidor do nome acessível. Correção estrita dos três nomes para
“Distribuições”, sem alterar asserções de foco, heading, payload, axe ou timeout.
Logs do CI são RED funcional existente; nenhuma necessidade de forçar nova falha.

Há ainda um resultado intermitente no P05 “cópia aguarda ACK da reordenação por
teclado” mobile: o anúncio de destino p-2 não apareceu na primeira tentativa;
retry passou. Não atribuído ao rótulo sem reprodução. Verificação específica
registrada abaixo; sem relaxar asserts nem aumentar timeout.

Validação da retomada em Node 22.21.1:

- **18/18 PASS**: gate de acessibilidade de questionários e jornada completa de
  criação/distribuição por teclado, desktop/mobile (1,1 min), com asserts
  originais de foco, axe, heading e payload.
- **6/6 PASS**, três execuções por projeto do mesmo teste P05 de ACK/reordenação
  (20,7 s), sem retries configurados localmente. A falha intermitente do CI
  não se reproduziu; não declarar causa corrigida nem garantia de estabilidade.
- Gate de linguagem, `git diff --check` e scanner local de segredos: **PASS**.
- Sem alterações de código funcional, timeouts, asserções ou workflows.
- CI final: **PENDING** após envio do delta. Run anterior continua FAIL histórico;
  não substituído por um rerun sem correção.

Os 118 testes anteriores seguem evidência histórica do mesmo código funcional;
esta retomada muda somente seletores de teste e documentação. Sem reexecução
redundante de build/typecheck para mudança sem TypeScript funcional.
