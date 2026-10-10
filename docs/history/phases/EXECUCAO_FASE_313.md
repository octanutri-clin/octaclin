# Execução — Fase 313

2026-10-10. Branch `feature/fase-313-antropometria-gestantes`, base `774cf34f`.
R4. Implementação autorizada em GPT-6.1 Sol médio; sem troca de modelo.
Regras da ficha atualizada ratificadas pelo proprietário/equipe nesta conversa.
O parecer documental permanece preservado, com seu escopo original distinto.

## Entregas

- Tabela MS/UFS 2022 offline, fonte/algoritmo versionados, comparação decimal
  exata e motivos de inaplicabilidade. Peso habitual como origem própria.
- Episódios explícitos, encerramento/reabertura, referência corrigida em versão
  nova e snapshot cifrado por avaliação. Registros antigos não são recalculados.
- Migration 1068 aditiva, FKs compostas, FORCE RLS, triggers de imutabilidade,
  replay durável sob locks e versões esperadas/409.
- Console com condição por data, confirmação de divergência, contexto/IG,
  gestão de episódios e gráfico por referência. Cobertura paginada visível.
- Portal com convites genéricos, liberação atual+futura explícita e aceite
  específico revogável, por usuário/termo/geração. Notas/fingerprints excluídos.
  Vínculo ausente/ambíguo nega leitura. Erros e respostas sem cache clínico.
- Demo sintética cobre o contrato de episódios e replay; não duplica o
  classificador clínico. Cálculo e autorização são provados no backend real.

## Evidências locais

Ambiente: Node 24.19.0/pnpm 11.19.0. O projeto/CI declara Node 22/pnpm 11.25.0;
PASS local não substitui os gates na configuração declarada da PR.
PostgreSQL: Timescale/PG15 em Testcontainers descartável; migrations pela conexão
administrativa; serviço pela role runtime não owner, sem DDL/BYPASSRLS.

| Gate | Resultado observado |
| --- | --- |
| Jest domínio/contratos/migration + regressões antropometria/ServiçoPacientes | PASS, seis suites / 180 testes |
| Transcrição contra ficha ratificada | PASS, 31 linhas / 124 faixas / 248 valores |
| PostgreSQL real com provas da 313 | PASS, 29 testes na execução final, incluindo vínculo ambíguo e 102 avaliações com microssegundos; duas páginas recuperam todos os IDs sem perdas/duplicatas |
| Visual focado, desktop/mobile e comparação anterior | PASS, oito cenários em dev e repetidos no build de produção local; zero violações axe |
| Web typecheck | PASS |
| Backend typecheck | PASS |
| Backend build | PASS, artefato dist/main.js validado |
| Web lint | PASS, zero erros e 65 avisos; nenhum aviso novo nos componentes da 313 |
| BFF novo | PASS, dois casos; registrado em test:authz |
| Web build | PASS, 177 páginas, rotas novas registradas |
| Demo BFF sobre build de produção local | PASS, incluindo episódio/replay/referência/encerramento; smoke UI PASS, nove rotas |
| test:authz completo | PASS, incluindo harness da 313 |
| Governança: confiabilidade/a11y/migrations/guardas/redação auditoria | PASS nas execuções locais; matrizes finais revalidadas |
| CI da PR | SKIPPED, aguardando abertura/checks da branch |
| Revisão R4 independente | SKIPPED, sem segundo revisor neste ciclo |
| Migration 1068 em staging/produção | SKIPPED, não autorizada/executada neste ciclo |

Falhas encontradas e corrigidas: configuração do harness sem entidades novas;
exibição do IMC com artefato binário; fixture de transferência tentou responsável
nulo (o schema exige vínculo válido); seletor de subaba/combobox no teste; tabela
com rolagem sem foco pelo teclado no mobile. A última foi defeito real do
componente compartilhado, corrigido com região nomeada e foco acessível. Uma reexecução PG excedeu 180s no hook de preparação enquanto builds/checks pesados estavam simultâneos; sem aumentar timeouts, a repetição após concluir os builds passou (29 testes). A prova adicional com 102 avaliações reproduziu perda de registros na segunda página, por truncar microssegundos em JS Date. O cursor agora compara a âncora diretamente no PostgreSQL; execução final PASS (29 testes).

## Operação e limites

Seguir o procedimento fora de banda no `RUNBOOK_PRODUCAO.md` antes do deploy,
conferindo alvo/role e grants DML. Nenhuma credencial owner no runtime.
Rollback vazio testado em PG; com dados, `down` recusa. Não apagar histórico para
permitir downgrade. Revisão independente e leitor de tela real não são inferidos
pelas provas automatizadas. Monitor de produção FAIL registrado no planejamento
continua uma pendência operacional separada; este relatório não declara saúde
produtiva ou implantação.

Preflight PowerShell local: SKIPPED, executável não disponível neste ambiente Linux. Gates equivalentes de governança acima executados; CI continua obrigatório.
