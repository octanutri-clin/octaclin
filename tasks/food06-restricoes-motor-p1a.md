# FOOD06 P1a — motor de avaliação de restrições alimentares (domínio puro)

**Status:** implementado em domínio puro, **sem tabela, rota, flag, migration, dado clínico nem consumidor**. Não ativa nada.
Contrato de origem: `tasks/food06-m11-restricoes-contrato-v2.md` (PR #524, ainda não mergeada quando este arquivo foi escrito).
B04 e M11-C2 **continuam abertos**: este motor é uma peça, não o contrato validado.

- Arquivos: `octaclin-backend/src/modulos/planos-alimentares/dominio/restricoes-alimentares.ts` e `.spec.ts` (67 testes).
- Risco: R4 pelo tema (saúde, segurança clínica); R4 não é rebaixado, mas o código não toca banco, autorização nem rede.
- Dados: só sintéticos.

## O que o motor faz

`avaliarItem`, `avaliarReceita` e `compararPreviaComAplicacao` recebem restrições, avaliação global, regras e o mapeamento do item **já resolvidos** e
devolvem fatos: resultado por restrição, resultado agregado, ação de aplicar, motivos, versões usadas e uma **impressão** (sha256) das entradas que decidem.
A prévia e o aplicar devem chamar a mesma função e comparar com `compararPreviaComAplicacao`; qualquer diferença exige nova revisão (contrato C6 e C7).

**Inerte por construção.** Sem regra clínica validada por uma pessoa (`validadaPor` e `validadaEm` preenchidos), o motor nunca devolve `conflita`,
`pode_conflitar`, `impedido` nem `exige_esclarecimento`: devolve `indeterminado` com `regra_nao_validada` e exige revisão. Nenhuma regra, alérgeno ou mapeamento é semeado.

## Decisões de desenho que ACRESCENTAM ou ESPECIFICAM o contrato v2

Itens que o contrato não fixava ou fixava de outra forma. Devem ser **incorporados ao contrato** (ou revertidos) por decisão do proprietário e do responsável clínico.

| # | Decisão no motor | Por quê | Onde confirmar |
| --- | --- | --- | --- |
| 1 | Novo resultado `incompatibilidade_escolha` (escolha confirmada com o alvo presente ou possível), ação `exige_confirmacao`. | A linha 13 da matriz descrevia "incompatibilidade não clínica" sem nome de resultado. Fica entre `pode_conflitar` e `indeterminado` na precedência. | Contrato 4.4 e 4.5 |
| 2 | A regra clínica tem **duas** ações, `acaoContem` e `acaoPodeConter`, e **não existe "nenhuma"**. | O contrato tinha uma ação só e "nenhuma" permitiria uma regra que silencia o alerta (D4 proíbe). | Contrato 4.1, item 7 |
| 3 | **Guarda fail-closed:** para alergia e doença com restrição, `acaoContem` precisa ser `impedir` e `acaoPodeConter` precisa ser `impedir` ou `exigir_esclarecimento`. Regra diferente **recusa a entrada**. | Uma regra mal cadastrada não pode transformar o bloqueio de alergia em aviso. A regra de intolerância pode ser mais branda. | Q1 (clínico) |
| 4 | Novo motivo `avaliacao_inconsistente`: avaliação "sem restrições" com restrição confirmada ativa, "restrições registradas" sem nenhuma, ou sem `venceEm`. | Dado incoerente nunca deve virar `sem_conflito_registrado`. | Contrato 4.2, invariante 4 |
| 5 | **Restrição confirmada nunca vence por prazo**; o vencimento da avaliação só remove o `sem_conflito_registrado`. | É a proposta C9/Q2 do contrato, implementada como recomendada. | Q2 |
| 6 | Preferência não exige confirmação: sempre `sem_efeito_clinico` e `permitido` (exceto rejeitada ou inativa, que saem da avaliação). | É a proposta Q8. | Q8 |
| 7 | Declaração pendente: `indeterminado` com `declaracao_pendente`; ação `exige_revisao` **só** para restrição clínica com o alvo presente ou possível, senão `permitido` com pendência visível. | D4: "revisão proporcional ao risco". Pendência de escolha não trava. | Clínico e UX |
| 8 | Agregado só de preferências é `sem_efeito_clinico`; sem nenhuma restrição o agregado vem da avaliação global (válida: `sem_conflito_registrado`; senão `indeterminado` com o motivo). | Matriz, linhas 14 e 16. | Contrato 4.5 |
| 9 | Várias linhas de mapeamento para o mesmo alvo: vale a relação mais conservadora (`contem` > `pode_conter` > `nao_contem_confirmado`); `nao_contem_confirmado` só com evidência **e** cobertura suficiente em todas. | Duplicidade não pode ocultar um conflito. | P1b (persistência) |
| 10 | `item.ingredienteIdentificado = false` gera `ingrediente_nao_identificado`, exceto se há indício de conflito (que prevalece). | Receita com ingrediente industrial sem composição (cenário 7). | UX |
| 11 | O motor recebe `venceEm` e `agora`; **não calcula os 180 dias**. | A política de prazo pertence a quem grava a confirmação (P2), não ao avaliador. | D3 |
| 12 | `alvo.tipo = nao_catalogado` em restrição clínica confirmada: `exige_revisao`; em escolha: `permitido`. | Sem alvo estruturado não há como saber a relevância; a revisão uma vez por alvo por sessão é da interface (NUX-18). | UX |

## O que o motor NÃO faz

Não lê nem grava dado; não autoriza (D10 e a matriz de permissões são da P2); não decide quem é "profissional habilitado"; não cifra; não valida alérgenos nem mapeamentos;
não impede nada sozinho (devolve `acaoAplicar` para quem aplica); não diagnostica; não calcula risco numérico; não usa gravidade, observação nem questionário para decidir.

## Provas

- RED primeiro: o spec falhou com `Cannot find module` antes do motor existir.
- **Matriz do contrato (seção 5.1):** 16 linhas como tabela de casos.
- **Propriedades sobre o produto cartesiano** (natureza e subtipo × confirmação × estado × mapeamento × avaliação × regra, 2.000+ combinações): `sem_conflito_registrado` só quando um predicado escrito à parte
  permite; sem regra validada nunca conflita nem impede; preferência nunca bloqueia; inativa e rejeitada saem; `em_reavaliacao` igual a `ativa`; gravidade nunca muda o resultado.
- Agregação e precedência em qualquer ordem de entrada; receita com o ingrediente exato; prévia × aplicar; entrada fechada (chaves extras, tipos, limites) e erro **sem eco** de conteúdo; canários.
- **Mutações: 24 aplicadas ao motor, 24 detectadas.** Na primeira rodada, 2 sobreviveram (ação agregada com a menos grave primeiro; instante exato do vencimento) e viraram testes novos.

## Limites

É um motor sobre **fatos de entrada**: a correção clínica depende do conteúdo (taxonomia, mapeamento, regras) que ainda não existe e exige validação humana clínica (Q1). Não cobre persistência, autorização,
concorrência (CAS), auditoria nem interface; isso é P1b, P2, P3 e P4. A `impressao` protege contra prévia desatualizada, mas o **aplicar** continua precisando reautorizar e revalidar no servidor.

## Próximo passo

P1b: migration **aditiva e vazia** com RLS e cifragem, ensaiada só em PostgreSQL descartável (não aplicada em ambiente real). **Pede Opus** e revisão cruzada.
