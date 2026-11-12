# Auditoria Q5 — armazenamento de respostas de questionário (FOOD06 T8, somente leitura)

**Escopo:** onde as respostas de questionário (inclusive texto livre) são guardadas e se há cifragem de aplicação, para decidir como proteger os **novos** fluxos de restrição alimentar. **Nada foi migrado, alterado ou executado em banco.** Leitura de código em 2026-11-12 sobre `main`; **não** foi consultado nenhum banco, nem dado real. Não afirmo vazamento: afirmo o que o código mostra e o que não foi verificado.

## O que o código mostra

| Local | Fato verificado | Referência |
| --- | --- | --- |
| `resposta_valores.valor` | Coluna `jsonb`, **sem cifragem de aplicação** (`valor: unknown` gravado como veio) | `octaclin-backend/src/modulos/questionarios/infraestrutura/resposta-valor.orm.ts` (coluna `valor`); gravação em `servico-questionarios.ts` (~l. 1300-1306) |
| `envios_questionario.respostas_rascunho` | Coluna `jsonb` com `{perguntaId, valor}[]`, **sem cifragem de aplicação** | `envio-questionario.orm.ts` l. 74; gravação em `servico-questionarios.ts` (~l. 1248); migration `1720000001010` |
| Isolamento por tenant | `resposta_valores` e `envios_questionario` constam da lista que recebe `ENABLE` + `FORCE ROW LEVEL SECURITY` na migration de fundação | `1720000000000-CriarFundacaoOctaClin.ts` (lista em ~l. 526-528 e `force row level security` ~l. 559) |
| Cifragem existente no módulo | `CriptografiaDadosSensiveis` é usada para **nomes de pacientes** na revisão de formulários, **não** para valores de resposta | `servico-revisao-formularios.ts` l. 5, 23, 46, 78 |
| Consumidores dos valores | Portal do paciente (`servico-portal-paciente.ts` ~l. 1421), contagens e indicadores no serviço de pacientes (`servico-pacientes.ts` ~l. 1406) e distribuições/histórico em `servico-questionarios.ts` | arquivos citados |

## Leitura dos fatos

1. A proteção hoje dos valores é **isolamento por tenant com RLS forçado** mais a proteção da infraestrutura (cifragem em repouso do provedor, **não verificada aqui**). Não há **cifragem de aplicação por campo**, como existe para os campos de paciente.
2. Texto livre de questionário pode conter **dado de saúde** (inclusive alergias declaradas). Isso é **possibilidade**, não prova: **não examinei conteúdo**.
3. Os indicadores e distribuições leem `valor` em claro; cifrar o campo existente **quebraria** esses consumidores sem um plano.
4. Os caminhos de rascunho e de resposta final gravam o mesmo formato; um plano de proteção precisa cobrir **os dois**.

## Decisões e plano (proposta; depende de aprovação do proprietário)

- **Fluxos novos de restrição (P1b em diante):** **não** reutilizar `resposta_valores.valor`. Guardar restrições em tabelas próprias, com campos sensíveis cifrados na aplicação (padrão `servico-gestacoes-paciente.ts`) e RLS com `FORCE`. O questionário apenas **sugere** revisão ao profissional (somente leitura), sem copiar o valor em claro.
- **Migração histórica (separada, fora desta rodada):** inventário sem conteúdo (contagem de linhas por questionário e por tipo de pergunta, sem ler valores), decisão do proprietário sobre cifrar campo a campo ou por tipo de pergunta, plano de consumo dos indicadores com valores cifrados, ensaio **somente em PostgreSQL descartável**, rollback definido. **Nada disso foi iniciado.**
- **Não afirmar vazamento:** sem evidência. Registrar como **risco de exposição ampliada em caso de acesso indevido ao banco**, a ser avaliado pela matriz LGPD (`docs/governance/MATRIZ_TRATAMENTO_LGPD_RESTRICOES.md`, linha 6).

## Não verificado

- Cifragem em repouso e backups do provedor do banco.
- Conteúdo real de qualquer resposta ou rascunho (não lido, por regra de dados).
- Exportações, relatórios e filas que possam copiar `valor` (a busca encontrou só os arquivos listados; **busca textual, não prova de ausência**).
- Se algum caminho do app web guarda rascunho no navegador (`rascunho` não apareceu em `octaclin-web/src` na busca textual).

## Condição objetiva de aceite do Q5

Plano de proteção dos fluxos novos aprovado pelo proprietário **e** plano de migração histórica aprovado, ensaiado em banco descartável, com rollback. Sem isso, a ativação clínica (ATV do contrato v3) permanece bloqueada.
