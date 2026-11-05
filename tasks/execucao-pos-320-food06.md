# FOOD06 — execução técnica

> Estado vigente local — extensão M10-C2: [contrato e provas](food06-m10-historico.md).
> Backend unit 4/4, PostgreSQL descartável/RLS 41/41, Web 69/69, Playwright 2/2 desktop/mobile, typechecks backend/Web e ESLint afetado PASS com Node22.21.1.
> Build backend/Web, scanner local de segredos e `git diff --check` PASS; CI/scanners GitHub do novo HEAD ainda precisam ser concluídos.
> M10 PARCIAL; extensão não enviada, CI anterior 4447146d não valida este delta. UX B/C e R4 independente PENDENTES.
> Sem migration externa, merge, deploy ou alteração de G06/direitos/DRI. Checkpoints anteriores abaixo são históricos.

> Histórico — fonte DB de versão salva M05/M07: [contrato/evidências](food06-fonte-versao.md).
> Origem exata, revisão sob lock e materialização atual; confirmação operacional cifrada v2.
>170focados/60PG e R4 delimitada PASS. Sem nova migration, API/UI ou contexto clínico integrado.
> M05/M07 parciais;37,5% administrativos. CI novo pendente; direitos/DRI/G06 BLOCKED.
> Sem merge/deploy/migrations externas. Checkpoints abaixo são históricos.

> Histórico — construtor M05/M07: [envelope factual](food06-construtor-registro-factual.md).
> Envelope em memória e marcadores derivados dos snapshots; não é persistência em banco.
>115focados/4.002backend PASS,180SKIPPED; build/typecheck Node22 e R4 delimitada favoráveis.
> Base d8d63d62 com CI aprovado (22SUCCESS/ProvenanceSKIPPED). Novo CI pendente.
>37,5% administrativos; M05/M07 parciais; direitos/DRI/G06 BLOCKED. Histórico abaixo.

> Histórico — M07 fundamento interno: [execução e contrato](food06-comparacao-versoes-dominio.md).
>39testes M07 e44regressões focadas PASS; backend3.970PASS/180SKIPPED; R4 delimitada favorável.
> Sem API/UI/registro novo; M07 parcial. Baseb9ed65bc:22checksSUCCESS/ProvenanceSKIPPED.
> M09 concluída tecnicamente nos critérios existentes. Progresso37,5%;1/12encerrada.
> CI do novo delta pendente; direitos/DRI/G06 BLOCKED. Checkpoints abaixo são históricos.

> Histórico PA07: [liberação efetiva PA07](food06-pa07-release.md). Fragilidade
> reproduzida com2RED e corrigida;72unitários/4browser controlados/build Node22PASS.
> Matriz162/162PASS, zero skipped; CI do novo delta pendente. M09 abaixo é checkpoint histórico.

> Histórico M09: ajuda explicativa própria na tabela factual e nas prévias.
> [Execução, testes e limites](food06-interface-ajuda.md). Backend3.931PASS/180SKIPPED;
> Web61PASS; browser157PASS/1FAIL PA07; isolado6PASS e suíte PA07 posterior61PASS/1FAIL.
> Regressão intermitente em investigação; não é gate verde irrestrito. CI próprio pendente. Comparações DRI continuam indisponíveis.
> CI da base c949821b concluído com sucesso; novo delta exige CI próprio.29,2%,0/12.
> Direitos/G06 BLOCKED. Os checkpoints abaixo são históricos, não o estado vigente.

> Histórico — M04 receitas integrada na Web: [execução/handoff](food06-interface-previa-receitas.md).
>48unitários/150browser e2retestes visuais/build/typecheck Node22 PASS; R4 delimitada favorável.
> API373c1ddf com PG/RLS141PASS/0skip; novo delta tem CI próprio. M04 parcial,29,2%,0/12.

> Histórico — M04 receitas, backend em validação: [contrato/handoff](food06-api-previa-receitas.md).
> CI anterior c8389ebc aprovado;431focados/3.926backend PASS,180SKIPPED. Novos3PG aguardam CI.
> Interface de receitas ainda pendente; M04 parcial,29,2%,0/12. Direitos/G06 BLOCKED.

> Checkpoint histórico — M04 editor: [execução e handoff](food06-interface-previa.md).
> API/PG da base a657e696 aprovados;50browser/47unitários/build Node22 PASS no editor.
> PA07 legado62/62 PASS; CI do novo delta pendente. M04 parcial,29,2%,0/12.


> Checkpoint histórico substituído: M04 API factual de prévia/confirmação de porção manual e
> troca de catálogo, na mesma #455 Draft. [Contrato/evidências/limites](food06-api-previa-micronutrientes.md).
> Base53835d72: Backend/Web/PG/RLS/scanners PASS; CI global FAIL em Demo/microcopy,
> reproduzido e corrigido no marcador sintético do teste. Novo delta tem gates próprios.
>29,2% administrativos,0/12 encerradas. Direitos/G06 BLOCKED.
> Checkpoints anteriores abaixo são históricos; não representam o estado vigente.

## Histórico — incremento M02

A implementação da interface de contribuições e suas provas estão em
[execução M02 Web](food06-interface-contribuicoes.md). Base992fee05 com CI
aprovado; o delta Web tem testes locais próprios e aguarda seu CI.
[Progresso das12 melhorias](progresso-food06.md):25% estimados,0/12 encerradas.
Os resultados abaixo são históricos dos respectivos commits; Mobile FAIL e
provas PG pendentes desses checkpoints foram substituídos pela base992fee05.
Direitos e G06 continuam BLOCKED; nenhuma comparação clínica foi ativada.

## Expansão M01–M12 e auditoria (2026-10-31)

Todas as12 melhorias foram aprovadas para planejamento/implementação isolada.
Especificação, aceite e Onda A agora detalham requisitos, reuso, gaps, divisão de
PRs e provas. Núcleo isolado não equivale a conclusão funcional. UX A executada
por duas instâncias separadas, sem ferramentas/interação/dados reais; sínteses e
manifesto em `docs/agents/ux/reports/FOOD06-A-2026-10-31/`. Não são R4 ou validação
de interface. Portal paciente N/A, relatório/efeitos do plano avaliados.

CI de `eeb552fa`: **FAIL Mobile Expo e PR Gate**, 20 outros checks success e
SBOM provenance SKIPPED. Job `124490037570`, run `41184991822`: falhou em
`Run pnpm audit:security`, exit1. Log lista14 identificadores GHSA; não fornece
nessa mensagem o diagnóstico completo por pacote. Prefixo textual “OK” não muda
o exit1/reprovação. Segurança Mobile deve ter fluxo separado; não dispensar gate
ou alterar severidade/política para aprovar FOOD06.

Auditoria documental executada por leitura do código/contratos. Nenhum teste de
implementação das12 novas melhorias foi aprovado nesta rodada. Migrações, banco
externo, UI, PDF real, Playwright e R4 integral: NOT RUN. Fontes/direitos e G06
mantêm seus bloqueios. As evidências do núcleo a seguir são históricas do delta.

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
