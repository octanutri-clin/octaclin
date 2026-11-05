# FOOD06 — M10: histórico longitudinal factual

## Estado deste incremento

**PARCIAL, implementação local não enviada**, na branch isolada `feat/food06-main-sync`, sobre o HEAD remoto `f731c807e04b3a951ceeb3290e9ce34e49a42a33` da PR #455 Draft. Não há migration nova. A implementação mostra somente registros factuais já salvos; não recalcula planos, não ativa DRI e não estima consumo real.

## Contrato

- Endpoint profissional `POST /pacientes/:pacienteId/planos-alimentares/analises-factuais/historico`, com rota BFF correspondente.
- Página keyset de até 10 registros; cursor inclui UUID e timestamp UTC de seis casas, preservando precisão do PostgreSQL. Uma análise criada entre páginas não desloca nem duplica o restante da página anterior.
- A cada requisição, backend revalida usuário profissional, tenant, permissão de leitura e vínculo atual com a carteira do paciente dentro do `ExecutorTenant`/RLS. O escopo SQL restringe tenant e paciente. Sem cache (`private, no-store`).
- Backend abre somente os envelopes cifrados da página autorizada e devolve projeção por allowlist: instante do registro, plano/versão/status/revisão, versão do motor, valores e cobertura por nutriente, indicação booleana das bases documentais e referência explicitamente indisponível.
- Compara internamente o marcador de composição/fonte com o registro imediatamente mais antigo (inclusive através do cursor), retornando apenas `IGUAL`, `DIFERENTE`, `NAO_COMPARAVEL` ou `SEM_REGISTRO_ANTERIOR`; hashes nunca saem do backend. Diferença não atribui causalidade: pode refletir mudança dos alimentos, da composição ou da fonte.
- Valores completos só são expostos como `total`; parciais somente como `quantidadeConhecida`; zero conhecido permanece zero. Ausências continuam desconhecidas. Envelope, ciphertext, hash/fingerprint, contexto, tenant e identificador do paciente não fazem parte da resposta.
- Interface profissional sob demanda, sem armazenamento persistente no navegador. Gráfico exibe pontos completos sem linha/interpolação; tabela acessível mantém registros parciais/desconhecidos, datas, versões e lacunas. Não representa melhora clínica.

## RED/GREEN e evidências locais

| Verificação | Resultado |
| --- | --- |
| Projeção do histórico e limites de paginação | 5 testes Web novos PASS; rejeita campo inesperado, cursor divergente, ordem inválida e total completo com cobertura parcial |
| Núcleo FOOD06 e contratos Web | 68/68 PASS com Node 22.23.1 |
| PostgreSQL real descartável, runtime sem owner/bypass e RLS | 41/41 PASS na integração da migration 1081; inclui carteira/negação, projeção cifrada, cursor estável após inserção concorrente e comparação de composição sem hash |
| BFF da Web | 105/105 PASS; incluindo sessão/permissão, limite por bytes, `no-store` e conflito sem retry |
| Typecheck Web | PASS com Node 22.23.1 |
| Lint Web afetado | PASS sem avisos após correções locais |
| Build Next.js Web | PASS com `next build --webpack`, Node 22.23.1; gerou as 194 páginas/rotas estáticas previstas e completou a etapa TypeScript |
| Typecheck backend | PASS com Node 22.23.1 e `--incremental false` |
| Build Nest e verificação do artefato | PASS com Node 22.23.1; `dist/main.js` validado |
| Playwright da tabela/histórico | 24/24 PASS, desktop e mobile; axe/teclado, parcial, zero, desconhecido, paginação e revogação de acesso |
| Rotas assíncronas Next.js | PASS: 169 arquivos validados |
| Scanner local de segredos | PASS: nenhum segredo real identificado |
| `git diff --check` | PASS |
| Teste authz agregado | NÃO EXECUTADO: o harness local falhou antes dos testes ao tentar gravar `tsbuildinfo` em caminho sem permissão; não é falha funcional comprovada |
| CI e scanners GitHub no novo HEAD, UX independente B/C e revisão R4 | PENDENTES; não herdar os resultados da base |

Setup: o comando padrão Playwright acionou o `pnpm` disponível fora do intervalo do projeto e tentou reinstalação sem TTY; não alterou dependências. O `next dev` padrão Turbopack recusou o symlink de `node_modules` entre worktrees. Reutilizamos as dependências existentes e iniciamos Next em Webpack (`next dev --webpack`) sem mudar arquivo de configuração; nesse servidor os 22 cenários passaram. O harness BFF foi ajustado para não herdar `incremental` do tsconfig, evitando escrita de `tsbuildinfo` em caminho sem permissão.

## Limites e próximo trabalho

- A referência nutricional aparece indisponível, conforme o gate de direitos/DRI; este histórico não compara RDA/AI/UL.
- O sistema sinaliza quando o marcador agregado de composição/fonte difere, mas não separa por si só troca de alimento, atualização da fonte ou outras diferenças; não compara referência DRI e não atribui causalidade. A M10-C2 permanece parcial.
- M10 não recebe validação UX independente nesta etapa; precisa das etapas B/C previstas para FOOD06. A interface é exclusivamente profissional; perspectiva de paciente é N/A justificado para esta visualização.
- CI/scanners GitHub da alteração local, authz integral, UX B/C e revisão R4 permanecem pendentes; não marcar M10 como completa. Builds e scanner local de segredos passaram, mas não substituem esses gates.
- Sem merge, deploy, migrations externas, acesso ou escrita em staging/produção.
