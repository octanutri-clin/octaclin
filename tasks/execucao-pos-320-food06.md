# FOOD06 — execução técnica

## Checkpoint de 2026-10-31

Branch `docs/food06-contratos-fontes`, PR #455. Base remota preservada em
`cb8a9c47` antes desta retomada. Nenhum reset, descarte, rebase ou merge realizado.
O diretório anterior em `/tmp` não persistiu após reinicialização; o último estado
conhecido estava limpo e enviado. Nova worktree sob `/workspace/octaclin/.worktrees`
reutiliza a mesma branch/PR. Alteração preexistente da worktree principal em
`octaclin-web/next-env.d.ts` foi preservada.

### Aceites humanos

Proprietário/equipe clínica ratificaram ficha CL01–CL08 e quadro de `cb8a9c47` nas
três respostas da sessão: regras/valores DRI, confirmação do mesmo dia planejado
e tabagismo (+35 mg somente RDA C confirmada, UL intacto, desconhecido sem essa
comparação RDA). Ficha canônica registra o aceite, sem inferir direitos de tabelas.

### Escopo entregue neste delta

- Núcleo puro `dominio/comparacao-dietetica.ts`: recebe total PA06, referência
  injetada e contexto; sem registro Nest, rota, banco, tabela oficial ou UI.
- Razões decimais exatas até as saídas; percentual e diferença apresentados em
  escala8, diferença arredondada identificada explicitamente. Campos originais
  preservados; nenhuma mutação das entradas ou comparação parcial enganosa.
- Reutilização por exportação de `decimalComoRazao`, sem alterar seu algoritmo
  ou cálculos existentes de micronutrientes. Nenhuma dependência nova.
- Cobertura completa versus parcial, zero versus ausência, mg/mcg e qualificadores,
  ULs de origem/fração incompatível, contexto/dia, dados inválidos, limites e
  resultados independentes. Ajuste C não alcança AI, outros nutrientes ou UL.
- Oráculo Python Decimal, precisão60, 15 razões sintéticas, sem dados DRI.
  Referências sintéticas são de aritmética, não uma tabela de prescrição.

### RED/GREEN

| Evidência | Resultado |
| --- | --- |
| Tentativa inicial da suíte | Erro de tipagem da fixture; não contado como RED funcional; corrigido antes do ciclo |
| Núcleo inicialmente indisponível | RED funcional: 29 falhas, 11 passes, 40 testes |
| Primeira implementação | GREEN: 40/40 |
| Ajuste C aplicado indevidamente a AI sintética | RED: 1 falha/42 passes; corrigido para somente RDA C |
| Revisão cruzada: referência arredondada antes da razão | RED: 3 falhas/59 passes; usar razão exata resolveu os exemplos |
| Metadado de arredondamento da diferença | RED: 2 falhas/64 passes; agora zero de apresentação não simula igualdade exata |
| Final, núcleo + regressões micros/combinado | PASS: 109/109, três suítes, Node22.23.4 com ferramentas em cache |
| Pesquisa Python | PASS: 19/19; regeneração do oráculo idêntica via `cmp` |
| Typecheck backend | PASS local com dependências em cache; não comprova instalação exata congelada |
| Build Nest + verificação do artefato | PASS local com dependências em cache; sem pesquisa/testes/tabelas no registro de runtime |
| Segurança de workflows, segredos e diff | PASS: 22 testes existentes, scanner sem segredos e `git diff --check` limpo, Node22 |

Comando Jest final: Node22 executando `node_modules/jest/bin/jest.js`, configuração
`octaclin-backend/package.json`, `--runInBand --runTestsByPath`, com arquivos
`comparacao-dietetica.spec.ts`, `micronutrientes.spec.ts` e `calculo-combinado.spec.ts`
do diretório `src/modulos/planos-alimentares/dominio`.

### Ambiente e limites reais

- `/workspace` sem espaço suficiente para instalar ferramentas; somente artefatos
  criados nesta sessão foram movidos para `/tmp`. Conteúdo preexistente preservado.
- Node22.23.4 obtido do distribuidor oficial e SHA256 do arquivo conferido antes
  de uso; pnpm11.25.0 conferido contra SHA512 de `packageManager` do repositório.
- Instalação offline congelada: **BLOCKED** por minimumReleaseAge. As versões
  `@aws-sdk/client-s3@3.1156.0` e `@aws-sdk/s3-request-presigner@3.1156.0` não estavam
  no manifesto consultado. Não reduzir política, alterar lockfile ou liberar pacote.
- Testes/compilação locais usaram conjunto previamente disponível em outra
  worktree, por symlink ignorado pelo Git. Jest30.5.2 e TS6.0.3; transformador
  ts-jest29.4.14 em cache versus29.4.15 declarado no lock. Evidência válida para
  os testes executados, com essa limitação; o CI deve provar conjunto exato.
- PostgreSQL/RLS e integração HTTP: N/A para o núcleo puro desta rodada;
  obrigatórios na futura integração T04/T06, não considerados aprovados aqui.
- Acessibilidade/UX B/C: NOT RUN; nenhuma interface foi implementada nesta rodada.
- Direitos: BLOCKED para incorporar/ativar as tabelas clínicas; registro OGL e
  ressalvas continuam no parecer, sem aprovação jurídica presumida.

### Revisão estática por outra instância

Revisor: `/root/food06_core_static_review`, instância separada, somente leitura,
sem coautoria do código. Escopo: núcleo, testes, oráculo e exportação do helper.
Identificou P2 por arredondamento precoce: `1 / 3.0000000049` e
`0.00000001 / 0.0000000149`. Após RED/GREEN, reavaliou e fechou o P2 por inspeção,
sem novo achado reproduzível no delta corrigido. Conversões e sinais coerentes.
Testes/typecheck/build pelo revisor: SKIPPED. Não é validação clínica, execução
independente dos testes, R4 integral da futura integração ou liberação assistencial.

### CI e gates

`cb8a9c47`: 22 checks success, SBOM provenance SKIPPED; evidência histórica.
O novo HEAD precisa concluir seus próprios checks, especialmente backend, suíte
Python, governança e scanners. Não atribuir resultado anterior ao novo código.
A PR foi reconvertida em Draft antes do envio do novo código, pois sua mudança
anterior para Ready pelo ator do GitHub precedeu este incremento técnico.

T01 e ratificação da ficha: PASS. T02 direitos: BLOCKED. T03-A: PASS local
delimitado, CI pendente. T03-B e T04–T07: pendentes. G06: BLOCKED operacional.
Rollback deste delta: reversão aditiva de código/helper exportado, sem migração,
escrita ou reinterpretação de histórico. Não ativar assistência para contornar gates.

### Próxima ação

Observar CI do HEAD enviado; corrigir falhas reproduzíveis sem relaxar políticas.
Resolver alcance de direitos das referências antes de registrar tabelas e integrar
comparação ao serviço/BFF. Não fazer merge, deploy ou operação externa por este
registro. FOOD05 #446 e FOOD05-MDL/D18 permanecem fora do escopo.
