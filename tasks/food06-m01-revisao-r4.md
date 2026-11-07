# FOOD06 M01 — revisão R4 independente (somente leitura)

Síntese editorial do coordenador a partir do relatório devolvido pelo revisor; não é transcrição literal.

- Revisor: subagente de runtime do tipo `tenant-security-reviewer` (ferramentas de leitura), instância única, sem escrever no projeto. **Independência:** não escreveu o código; foi fornecido o escopo e as perguntas pelo agente que implementou. IDs de instância não preservados.
- HEAD avaliado: `9e4c1fe5772ff189cbb080a5bf05d36a65215641`. Delta lido: `git diff origin/docs/food06-contratos-fontes...HEAD -- octaclin-backend octaclin-web` (18 arquivos). Código de produção lido por inteiro; specs só amostrados.
- **O revisor não executou testes, typecheck nem lint.** O resultado dos testes vem do CI e das execuções do implementador, não desta revisão.
- Não verificou: RLS e `ExecutorTenant` (sem SQL ou migration no delta), limites HTTP do middleware, consumidores externos do registro, specs de integração por inteiro, AGENTS por arquivo.

## Veredito por pergunta

| Pergunta | Veredito |
| --- | --- |
| 1. Tenant e autorização | OK. Sem consulta nova; função pura chamada depois de `autorizar`, `carteira` e `obterRegistro`, dentro do executor de tenant; BFF e `tenantId` do cliente não tocados |
| 2. Minimização/PHI/PII | OK. Allowlist explícita, regex em `codigo` e `versao`, `baseCodigo` restrito, leitor Web reconstrói o objeto |
| 3. Imutabilidade/persistência | OK. Construtor, envelope, hash, leitor e migrations não tocados; nenhum caminho de escrita usa o campo |
| 4. Fail-open | OK com ressalva R4-M01-01 |
| 5. Limites/DoS | OK. No máximo 22 × 50 grupos; custo O(itens × 22); limite de 10.000 itens preexistente |
| 6. Compatibilidade | OK. Formato 1 intacto; resposta sem o campo continua válida |
| 7. Honestidade do texto | OK, com risco residual visual R4-M01-03 |
| 8. Outros | Nenhum P0 ou P1 |

## Achados

| ID | Sev. | Tipo | Resumo | Estado |
| --- | --- | --- | --- | --- |
| R4-M01-01 | P3 | Risco plausível (resiliência) | `fontes` malformado derruba a análise inteira, inclusive a tabela válida. É fail-closed, portanto seguro | ACEITO: o comportamento é intencional; degradar só a origem é decisão de produto |
| R4-M01-02 | P3 | Hipótese | Ordenação por `localeCompare` numérico pode empatar "01" e "1", dependendo de ICU | ABERTO, opcional |
| R4-M01-03 | P3 | Risco plausível (UX) | A ressalva fica abaixo da tabela; em várias páginas a coluna pode aparecer sem ela | ABERTO, mesmo núcleo do M01-NUX13; decisão do proprietário |
| R4-M01-04 | P3 | Sem cobertura citada | Sem teste negativo cross-tenant específico para `fontesPorNutriente` | RESOLVIDO depois da revisão: negativas do relatório formato 2 (outro paciente, outro tenant, sem permissão de gerenciar) e a revogação por transferência de carteira foram adicionadas ao spec PostgreSQL (commit `9e4c1fe5`, incluído no HEAD avaliado mas não lido por inteiro pelo revisor). A etapa do Testcontainers concluiu com sucesso no CI desse commit |

## Limites desta revisão

Leitura estática. Não prova comportamento em execução. Não substitui revisão humana de segurança nem a decisão do proprietário. Dois achados de produto (R4-M01-03 e o conjunto NUX) seguem para decisão.
