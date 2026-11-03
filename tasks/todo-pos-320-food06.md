# FOOD06 — checklist

> Estado vigente — fonte DB de versão salva M05/M07: [contrato/evidências](food06-fonte-versao.md).
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

## Histórico — estado anterior M02

Interface M02 paginada em validação na #455 Draft, sobre992fee05 com API,
PostgreSQL/RLS e concorrência aprovados no CI. [Evidências do delta Web](food06-interface-contribuicoes.md).
[Progresso](progresso-food06.md):25% estimados,0/12 melhorias encerradas.
M02 permanece parcial; direitos e G06 BLOCKED. CI do delta Web separado da base.

## Histórico da consolidação

Branches #456–#459 consolidadas na #455, sem merge na main. Estados antigos
abaixo são checkpoints históricos; não representam falha atual da base992fee05.

Estado vigente: ficha/quadro ratificados em 2026-10-31; núcleo T03-A isolado
implementado, sem comparação assistencial ou referência clínica habilitada.
Incremento A1 em `feat/food06-onda-a1`, empilhado sobre #455/`0ec4cd31`: cobertura e explicações em domínio puro; ver [execução A1](execucao-pos-320-food06-a1.md). Não conclui a Onda A.
Fonte de contrato: [plano](plan-pos-320-food06.md), base `68499c15`.

## Construtor M05/M07 — estado observado

- [x] Recuperar executor sem descartar delta e reproduzir testes pendentes com Node22.
- [x] Derivar marcadores e contexto do mesmo snapshot factual, por allowlist e sem fonte atual.
- [x] Preservar fatos/ausências/zero e não inventar identidade estável de manual/legado.
- [x] Tratar divergências por conferência, sem reparo histórico ou diagnóstico de corrupção.
- [x] Corrigir2P2 com RED/GREEN, re-revisão independente e regressões finais.
- [x]115focados/4.002backend PASS,180SKIPPED; build/typecheck final PASS.
- [ ] CI/scanners do novo HEAD; não reutilizar verde da base para este delta.
- [ ] Persistência cifrada/append-only, autorização, CAS/idempotência, PG/RLS e API/UI.

## Incremento M07 — fundamento

- [x] Identidade/revisão exatas e separação de escopo no contrato interno.
- [x] Comparação sobre estados congelados com PA06/M04, sem segundo motor.
- [x] Dimensões documentais/cobertura sem atribuição causal ou contexto bruto.
- [x] TDD,83focados, backend completo, build/typecheck e R4 delimitada.
- [x] UX A complementar; B/C pendentes de interface real.
- [x] Construtor canônico de envelope em memória, sem habilitar registro histórico.
- [ ] Registro persistente imutável M05/M07, com gates próprios.
- [ ] API/BFF/autorização/RLS/concorrência/paginação, UI e referência comum quando autorizada.
- [ ] CI/scanners do novo HEAD; não herdar o verde da base.

## Histórico — incremento M09, encerrado no CIb9ed65bc

- [x] Projeção própria versionada, sem valores DRI ou contexto do paciente.
- [x] Mesmo guia na tabela e prévias, compatibilidade legada e falha isolada.
- [x] TDD Backend/Web, parser negativo e fingerprint independente da redação.
- [x] Backend completo/build, Web build/typecheck, lint e microcopy em Node22.
- [x] R4 independente delimitada e UX B/C por brief, com limitações explícitas.
- [x] Executar matriz browser final com fixture exata e registrar capturas/resultados.
- [x] Reproduzir fragilidade PA07 com barreira e corrigir ACK após release efetivo.
- [x] Matriz final162/162PASS após correção PA07, zero skipped; falhas históricas preservadas.
- [ ] CI do novo HEAD; não atribuir causa retrospectiva aos timeouts sem prova.
- [x] M09/PA07 publicados e CIb9ed65bc concluído:22SUCCESS/ProvenanceSKIPPED. M09 técnica encerrada, demais gates preservados.

## Expansão obrigatória aprovada em 2026-10-31

- [x] Registrar M01–M12 integralmente e auditar compatibilidade PA06/04/05/07.
- [x] Produzir matriz de aceite rastreável e detalhar Onda A.
- [x] Executar UX A por duas instâncias separadas, referenciando #451/0d3382b6.
- [x] A1: cobertura com causas/contagens + catálogo estático M03/M09, TDD e revisão independente delimitada.
- [x] A2-fundamento: contexto puro19+, confirmações e datas civis, sem ativação/rota.
- [ ] A2: fontes/contexto autorizados, direitos, integração e rastreabilidade persistida.
- [ ] Onda A: M01 cobertura, M03 causas, M05 rastreabilidade, M09 explicações.
- [x] B-factual: implementar/testar tabela de cobertura e filtros, UX B/C do incremento.
- [x] B-factual: CI consolidado992fee05 aprovado; Mobile corrigido, SBOM provenance SKIPPED.
- [x] M02-fundamento: decomposição interna sem segundo somador, RED/GREEN e revisão independente delimitada.
- [x] M02 API: backend/BFF de leitura, paginação, IDs persistentes e precondições por página.
- [x] M02 API: PostgreSQL/RLS/concorrência aprovados no CI992fee05.
- [x] M02-UI: detalhe sob demanda/paginação, cobertura, teclado/axe, desktop/mobile e invalidação de leitura; [provas e limites](food06-interface-contribuicoes.md). CI próprio ainda pendente.
- [x] M02 factual: fonte/preparo por allowlist, ordenação global e consulta somente leitura da origem exata; provas locais em execução documentada.
- [ ] M02: conferir PG/CI deste delta e concluir integrações específicas de receitas/substituição planejada explícita.
- [ ] Onda B: concluir M02 contribuições e M06 com referências elegíveis.
- [x] M04-fundamento: núcleo factual antes/depois, diferenças, cobertura e limites; TDD/R4 delimitados, sem rota/aplicação.
- [x] M04-API inicial: porção manual/troca catálogo, DTO/BFF, autorização, revisão/fingerprint, writer único e RED/GREEN/R4 delimitados.
- [ ] M04-API: comprovar os cinco novos cenários PostgreSQL/RLS e CI do HEAD.
- [ ] M04-integração: UI/PA07/ACK/autosave, demais operações e UX B/C; M04 permanece parcial.
- [ ] Onda C completa: M04 prévias, M11 consulta assistida/restrições e M12 cenários.
- [ ] Onda D: M07 versões, M08 PDF seguro e M10 longitudinal.
- [ ] UX B/C com interface/artefatos reais e R4 independente integral.
- [x] Resolver falhas Mobile/PR Gate dos checkpoints históricos na consolidação992fee05.

Nenhuma melhoria é opcional. As linhas existentes abaixo registram fundamentos
anteriores e não equivalem à conclusão das ondas ou dos aceites M01–M12.

- [x] Criar branch/worktree isoladas e preservar delta preexistente.
- [x] Inventariar motor PA06, escala decimal, serviço, DTO, BFF e interface.
- [x] Registrar decisões humanas F06-D01, F06-D02 e F06-D03.
- [x] Consultar apenas os repositórios pertinentes já mapeados no planejamento;
      nenhuma nova dependência necessária nesta inspeção.
- [x] Obter páginas oficiais candidatas e hashes preliminares de Health Canada.
- [x] Identificar licença OGL no registro oficial e exceção para terceiros.
- [x] Preparar matriz semântica de todos os 22 códigos e regras F06-CL01–08.
- [x] Criar coletor documental sem dependências e executar oito testes sintéticos.
- [x] Registrar nova obtenção e hashes de bytes/texto; conservar histórico anterior.
- [x] Extrair quadro adulto candidato com unidades RDA/AI versus UL separadas.
- [x] Registrar confronto com outras publicações oficiais e limites 403/CAPTCHA.
- [x] Conferir cadeia registro OGL → índice → páginas atuais; documentar ressalvas.
- [x] Executar RED/GREEN do extrator; 19 testes sintéticos locais aprovados.
- [x] Adicionar workflow específico para executar os testes documentais no CI.
- [x] CI de `cb8a9c47`: 22 checks success, incluindo suíte específica; SBOM provenance SKIPPED.
- [x] Ratificação humana CL01–CL08 e quadro adulto DRI de `cb8a9c47` registrada.
- [x] T01: confirmar contexto diário e regras de elegibilidade; implementação da resolução ainda pertence a T03-B/T04.
- [ ] T02: mapear cada código a RDA/AI e UL com unidades, origem, notas e versão.
- [x] T02: ficha clínica e valores ratificados pelo proprietário/equipe clínica.
- [ ] T02: fechar direitos do artefato específico e revisão institucional aplicável.
- [x] T03-A: implementar núcleo puro com TDD, referências sintéticas e oráculo Python Decimal, sem registro/rotas.
- [ ] T03-A: verificar CI do novo HEAD com ferramentas/dependências exatas.
- [ ] T03-B: referências clínicas versionadas, direitos e resolução de contexto/faixas.
- [x] T04-factual: implementar serviço/rota/BFF sobre PA06, sem referências habilitadas.
- [x] T04-factual: PostgreSQL/RLS comprovado no Backend CI de código80763589.
- [x] T04-factual: Web/authz CI e27 scripts locais aprovados para código80763589.
- [ ] T04-factual: concluir Demo/CI do HEAD final, auditoria Mobile ainda FAIL.
- [ ] T04: concluir integração clínica de backend/BFF com permissões, revisões e projeções.
- [ ] T05: interface acessível e avaliações UX etapa B.
- [ ] T06: banco descartável/RLS, regressões e revisão R4 independente.
- [ ] T07: UX C, CI/scanners e PR Draft com evidências rastreáveis.

Cobertura futura obrigatória: 18/19 anos, fronteiras por faixa de tabela, sexo da
referência não confirmado, gestação/lactação, data inválida, totais completos e
parciais, zero conhecido, unidade e forma incompatíveis, UL ausente/restrito,
seleção vazia, planos/refeições OFF, publicações/revisões stale, transferência de
carteira, tenant adversário, acesso revogado, cancelamento e resposta tardia.

Fora do escopo: EAR/CDRR como substituto de UL, diagnóstico, consumo real presumido,
suplementação automática, ajuste de prescrição, portal, TBCA e operação externa.
Registro histórico da etapa inicial: não havia testes de implementação naquela etapa; evidências posteriores estão na execução principal e no incremento A1. G06 permanece
fora desta entrega. Uma PR documental não comprova ativação ou disponibilidade.

## Comunicação de progresso por entrega

Ver [painel das12 melhorias](progresso-food06.md). Checkpoint atual:25% estimados,
0/12 encerradas. M02 interface em validação; não converter testes de incremento
em aceite global. A cada entrega informar feito, próximo, critérios abertos e
percentual pelo método fixo, sem alterar escopo/pesos para produzir avanço.
