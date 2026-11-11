# FOOD06 — bloqueios compartilhados (reconstrução)

Base137aa547,07/11/2026. Um ID por dependência. Não duplicar uma aprovação jurídica
para cada melhoria. Riscos indicam consequências possíveis, não incidentes provados.

**Atualização 2026-11-09:**

- **B01 encerrado** por decisão do proprietário: direito de uso de todas as fontes,
  exceto Tucunduva (sem direito, fora de qualquer ambiente). As 19 referências DRI
  adultas foram reconferidas contra as tabelas oficiais atuais da Health Canada
  (2025-11-19), sem divergência. Ver `docs/product/PARECER_FONTES_DRI_FOOD06.md`.
- **B02 desbloqueado para implementação:** a integração científica das referências
  nas saídas agora depende só de engenharia e dos testes positivos/negativos.
- **B06 diagnosticado:** 1079/1080 aplicadas nos dois bancos; 1081/1082 ausentes;
  staging sem TACO. Plano em `tasks/food06-g06-diagnostico-2026-11-09.md`.

| ID/categoria | Causa e evidência | Afetadas | Responsável sugerido / dependência | Resolução imediata / ação | Risco e critério de encerramento |
| --- | --- | --- | --- | --- | --- |
| B01 FONTES/DIREITOS | Parecer DRI ainda possui gates; ratificação CL01–CL08 não libera todo uso/importação. `docs/product/PARECER_FONTES_DRI_FOOD06.md` | M03–M08/M10 e partes científicas M12 | Proprietário + jurídico/fontes | Não por código; consolidar artefatos/atribuições/escopo autorizados | Uso sem direitos ou mistura de referência; encerra com autorização documental aplicável à versão e finalidade exatas |
| B02 INTEGRAÇÃO CIENTÍFICA | Projeções retornam `referencias_nao_habilitadas`; conjunto versionado/elegibilidade não integra integralmente as saídas | M03–M08/M10/M12 quando comparações científicas | Engenharia + revisão clínica; B01 e protocolo ratificado | Preparar contratos/testes isolados permitidos; não habilitar por este documento | Percentual inválido; encerra com fonte permitida, versão/contexto/unidade/forma corretos e provas negativas/positivas nas saídas |
| B03 IMPLEMENTAÇÃO FACTUAL | Resumo global M08 não identifica contribuintes por nutriente; origem do registro não comprova célula. E01/E08 | M01/M02/M03 e parte factual M05/M08 | Engenharia, snapshots já autorizados | Sim: próxima tarefa M01, sem migration/catalogo atual | Falsa proveniência ou contagem; encerra com projeção única honesta e FT01–FT20 aplicáveis comprovados |
| B04 DADOS/CONTRATOS | Falta contrato validado de restrições/alergias estruturadas para M11 individualizada; ausência não significa compatibilidade | M11-C2, caminhos individualizados M04/M12 | Produto/clínica/segurança + engenharia | Auditar dados e propor contrato; não inferir texto livre nem declarar seguro por omissão. **Proposta publicada em 2026-11-11** (`tasks/food06-m11-restricoes-contrato-proposta.md`), aguardando decisão do proprietário e validação clínica; o bloqueio continua | Sugestão incompatível/exposição; encerra com IDs/regras/autorização/negativas aprovados e testados |
| B05 TESTES/QUALIDADE | Matriz global de jornadas, acessibilidade/AT/PDF e R4/UX integrais não concluída. CI de base verde não prova todo requisito | Todas; M09 só regressões/gates transversais | QA/engenharia/revisor independente | Mapear e executar apenas lacunas correspondentes ao código | Falso aceite; encerra por critério com evidência de commit, execução real, limitações e revisões exigidas |
| B06 INFRA/OPERAÇÃO | G06 exige etapa operacional separada; estado atual de produção não foi revalidado nesta auditoria | Disponibilização de toda FOOD06 e dependências | Proprietário + operação | Não executar nesta tarefa | Deploy parcial/schema incompatível; encerra somente com autorização e provas reais de schema/roles/RLS/backup/readiness/smokes/rollback |
| B07 HISTÓRICO/INTEGRAÇÃO | Contexto factual e marcadores existem; reprodução com referência científica comum/atualizada e compatibilidade completa de leitores/escritores pendem | M05/M07/M08/M10/M12 | Engenharia + clínica; B01/B02 | Completar critérios factuais e planejar os científicos separados | Reescrita histórica/causalidade falsa/rollback incompatível; encerra com registros imutáveis, sem catálogo vivo retroativo, referência versionada e ensaios de compatibilidade |
| B08 AMBIENTE/RECUPERAÇÃO | TEMP original/cfaa42f5 indisponíveis; código M01 não commitado perdido; espaço persistente residual inferior a1GiB | Próxima execução M01 e testes pesados, não defeito do produto | Engenharia + administrador do executor | Sim parcialmente: reconstruir de base remota com checkpoints; liberar capacidade de modo autorizado antes de instalações/PG | Nova perda/ENOSPC; encerra com worktree preservada, capacidade suficiente medida e provas descartáveis efetivamente executadas |

B02 não se encerra apenas com B01: autorização de fonte não implementa a comparação.
B06 não pode bloquear indevidamente desenvolvimento factual isolado; pode bloquear
operação. B08 não invalida os testes anteriores do código preservado, mas impede
reaproveitar artefatos perdidos como se cobrissem uma nova implementação.

As decisões clínicas ratificadas não estão sendo reabertas. Se uma lacuna exigir
decisão clínica nova, apresentar a questão concreta. Não pedir ratificação repetida
de adulto19+, mesmo dia ou tabagismo já aprovados.
