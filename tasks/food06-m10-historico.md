# FOOD06 — M10: histórico longitudinal factual

## Estado deste incremento

**PARCIAL, extensão M10-C2 local ainda não enviada**, branch `feat/food06-followup-2026-11-05` sobre o commit `4447146d053002fc4d4ca759cd6a9685e5788b3f` da PR #455 Draft. Não há migration nova. Este delta expande a comparação histórica a planejamento, composição/fonte, referência, contexto e cobertura por nutriente. Só projeta estados comparativos; hashes permanecem internos. A implementação mostra registros factuais já salvos; não recalcula planos, não ativa DRI e não estima consumo real.

## Contrato

- Endpoint profissional `POST /pacientes/:pacienteId/planos-alimentares/analises-factuais/historico`, com rota BFF correspondente.
- Página keyset de até 10 registros; cursor inclui UUID e timestamp UTC de seis casas, preservando precisão do PostgreSQL. Uma análise criada entre páginas não desloca nem duplica o restante da página anterior.
- A cada requisição, backend revalida usuário profissional, tenant, permissão de leitura e vínculo atual com a carteira do paciente dentro do `ExecutorTenant`/RLS. O escopo SQL restringe tenant e paciente. Sem cache (`private, no-store`).
- Backend abre somente os envelopes cifrados da página autorizada e devolve projeção por allowlist: instante do registro, plano/versão/status/revisão, versão do motor, valores e cobertura por nutriente, indicação booleana das bases documentais e referência explicitamente indisponível.
- Compara internamente os marcadores de planejamento, composição/fonte, referência e contexto com o registro imediatamente mais antigo (inclusive através do cursor), retornando apenas `IGUAL`, `DIFERENTE`, `NAO_COMPARAVEL` ou `SEM_REGISTRO_ANTERIOR`. Também compara a cobertura estrutural por micronutriente (estado, contagens e causas). Hashes nunca saem do backend. Diferença documental não atribui causalidade nem determina se houve mudança de consumo.
- Valores completos só são expostos como `total`; parciais somente como `quantidadeConhecida`; zero conhecido permanece zero. Ausências continuam desconhecidas. Envelope, ciphertext, hash/fingerprint, contexto, tenant e identificador do paciente não fazem parte da resposta.
- Interface profissional sob demanda, sem armazenamento persistente no navegador. Gráfico exibe pontos completos sem linha/interpolação; tabela acessível mantém registros parciais/desconhecidos, datas, versões e lacunas. Não representa melhora clínica.

## RED/GREEN e evidências locais

| Verificação | Resultado |
| --- | --- |
| RED/GREEN da comparação histórica no domínio | RED reproduzido antes da exportação de `compararBasesHistoricas`; GREEN 4/4 PASS, Node 22.21.1 |
| PostgreSQL 15 descartável, role runtime sem owner/bypass e RLS | 41/41 PASS na integração da migration 1081; inclui matriz atualizada por dimensão/cobertura, carteira/negação, projeção cifrada e cursor concorrente |
| Contrato Web do histórico factual | 69/69 PASS, Node 22.21.1; inclui rejeição de estado inválido/chaves clínicas adicionais |
| Playwright específico da M10-C2 | 2/2 PASS, desktop e mobile; tabela acessível, detalhes de dimensões, sem causalidade |
| Typecheck backend e Web | PASS, Node 22.21.1 |
| ESLint nos arquivos Web afetados | PASS |
| Build Nest e verificação de artefato | PASS, Node 22.21.1; `dist/main.js` validado |
| Build Next.js Web | PASS, Node 22.21.1; 194 rotas geradas; aviso preexistente de `process.cwd` sob Edge Runtime, build terminou com exit 0 |
| `git diff --check` e scanner local de segredos | PASS; nenhum segredo real identificado pelos padrões locais |
| BFF 105/105, builds integrais, rotas assíncronas e testes 24/24 | Evidência do commit-base `4447146d`, não reexecutada neste delta |
| CI/scanners GitHub do commit-base `4447146d` | Run `41943692782` e CodeQL/Semgrep/Trivy associados concluídos com sucesso; Provenance SBOM skipped. Não validam este delta |
| Extensão M10-C2 — comparação dos quatro marcadores e cobertura | RED esperado: export ainda inexistente; GREEN: 4/4 testes focados PASS com Node 22.21.1 |
| Integração PostgreSQL 15 descartável/RLS/runtime da migration 1081 | 41/41 PASS; inclui novos estados por dimensão, cobertura e ausência de hashes/identificadores na projeção |
| Contrato Web histórico factual | 69/69 PASS; parser rejeita estados/chaves extras e preserva a allowlist |
| Playwright histórico M10 | 2/2 PASS, desktop Chromium e mobile Chromium; detalhes de dimensão acessíveis e ausência de causalidade |
| Typecheck backend/Web e ESLint afetado | PASS com Node 22.21.1 |
| Teste authz agregado | NÃO EXECUTADO: o harness local falhou antes dos testes ao tentar gravar `tsbuildinfo` em caminho sem permissão; não é falha funcional comprovada |
| CI e scanners GitHub no novo HEAD, UX independente B/C e revisão R4 | PENDENTES; não herdar os resultados da base |

Setup: nesta retomada, `pnpm` tentou reinstalar `node_modules` sob Node 24 e abortou por ausência de TTY; nenhuma dependência foi alterada. Turbopack recusou o symlink de `node_modules` entre worktrees, então o teste visual foi executado com Node 22, servidor Next Webpack e host `localhost` compatível com cookies sintéticos. O primeiro teste visual em `127.0.0.1` não passou por incompatibilidade do domínio do cookie do fixture; após usar `localhost`, desktop/mobile passaram. Next alterou o arquivo gerado `next-env.d.ts`; a alteração foi revertida. O executor anterior de authz falhou antes dos testes ao tentar escrever `tsbuildinfo`; isso não constitui evidência de falha funcional.

## Limites e próximo trabalho

- A referência nutricional aparece indisponível, conforme o gate de direitos/DRI; este histórico não compara RDA/AI/UL.
- A comparação por referência permanece `NAO_COMPARAVEL` enquanto referências não forem habilitadas; o contrato não expõe identificadores/hash nem números DRI. `DIFERENTE` indica somente que o marcador congelado difere, sem identificar alimento, fonte ou causa.
- M10 não recebe validação UX independente nesta etapa; precisa das etapas B/C previstas para FOOD06. A interface é exclusivamente profissional; perspectiva de paciente é N/A justificado para esta visualização.
- Os testes desta extensão ainda não foram validados pelo CI/scanners GitHub do novo HEAD. UX B/C e revisão R4 independente permanecem pendentes; não marcar M10 como completa. A R4 estática anterior e o CI verde do commit `4447146d` não validam este delta.
- Sem merge, deploy, migrations externas, acesso ou escrita em staging/produção.
