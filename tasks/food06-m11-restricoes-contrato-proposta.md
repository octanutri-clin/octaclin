# FOOD06 M11 individualizada — proposta de contrato de restrições alimentares (T8)

**Status:** PROPOSTA, aguardando decisão do proprietário. **Nada foi implementado**: sem código, rota,
migration, flag nem alteração de contrato. Esta proposta **não aprova** o contrato nem libera o caminho
individualizado de M11, M04 ou M12 (bloqueio B04 / critério M11-C2 continuam abertos até a decisão).

- Base verificada: `main` em `d84b0f11`, 2026-11-11.
- Risco do tema: **R4** (dado de saúde/PHI, autorização, tenant, segurança clínica). Risco desta entrega: R2 (documento).
- Dados: este texto só tem exemplos sintéticos. Nenhum dado real de paciente.

## 1. Por que existe

`tasks/food06-bloqueios-compartilhados.md` (B04) e `tasks/food06-pendencias-por-criterio.md` (M11-C2)
registram que falta um contrato validado de restrições/alergias estruturadas com correspondência a alimentos.
Sem ele, a consulta de alimentos (M11), a troca com prévia (M04) e os cenários (M12) só podem ser genéricos:
**ausência de dado não significa compatibilidade**, e texto livre não pode ser inferido. Esta proposta define o
contrato mínimo para destravar a decisão.

## 2. Estado verificado hoje (por leitura, neste ciclo)

| # | Fato | Onde |
| --- | --- | --- |
| F1 | A tabela `pacientes` **não tem** coluna de alergia ou restrição. Tem nome e contato cifrados (`bytea`), `data_nascimento`, `status_adesao` e campos de ciclo de vida/retenção (`retention_reason`, `retention_until`, `legal_basis`, `deleted_at`). | `octaclin-backend/src/modulos/pacientes/infraestrutura/paciente.orm.ts` |
| F2 | Existe **uma** pergunta de questionário sobre restrição: "Voce possui alguma restricao alimentar?", múltipla escolha com 4 opções (`lactose`, `gluten`, `vegetariano_vegano`, `nenhuma`), no modelo `triagem-primeira-consulta`. | `octaclin-backend/src/modulos/questionarios/dominio/modelos-questionario.ts` (~linha 170) |
| F3 | A resposta fica em `resposta_valores.valor` (`jsonb`), ligada a `pergunta_id` e ao check-in. Não há vínculo com alimentos, gravidade nem confirmação profissional. | `octaclin-backend/src/modulos/questionarios/infraestrutura/resposta-valor.orm.ts` |
| F4 | O catálogo `alimento_composicao` **não tem** coluna de alérgeno, ingrediente ou grupo. Tem `nome`, `preparacao`, `base_gramas`, macros e `micronutrientes` (`jsonb`), mais `fonte_id` e `codigo_origem`. | `octaclin-backend/src/modulos/planos-alimentares/infraestrutura/alimento-composicao.orm.ts` |
| F5 | Fora de F2 e da lista de redação de auditoria (F6), uma busca textual por "alergi", "intoleranc" e "restrição alimentar" no código de produção do backend (excluídos os `*.spec.ts`) **não encontrou nenhuma outra ocorrência**. | busca em `octaclin-backend/src` |
| F6 | O termo `alergia` já consta da lista de termos clínicos a redigir em auditoria. | `octaclin-backend/src/infraestrutura/auditoria/redacao-auditoria.ts` |
| F7 | O M11 atual é uma consulta genérica de teor (`prepararConsultaTeorCatalogo`), sem leitura de paciente. | `tasks/food06-m11-consulta-catalogo.md` |

**Limitações da verificação (não verificado):**
- se alguma tela, DTO ou campo de texto livre do prontuário/evolução recebe "alergia" digitada (a busca acima cobre
  identificadores e textos do código, não o conteúdo dos dados);
- se `resposta_valores.valor` tem cifragem em nível de aplicação ou de disco (a coluna é `jsonb`, sem sufixo
  `_criptografado` como em `pacientes`);
- se TACO, USDA ou IBGE trazem informação de alérgeno nas fontes originais (o esquema atual não a guarda);
- RLS e cifragem das tabelas novas: seguir o padrão existente, a confirmar na implementação.

**Consequência de F2:** a pergunta existente **não** é um contrato de restrição. Mistura intolerância (`lactose`),
doença ou condição (`gluten`) e escolha ética (`vegetariano_vegano`), não cobre alergias por alimento (ovo,
amendoim, frutos do mar etc.), não tem gravidade e a opção `nenhuma` convive com as demais numa pergunta de
múltipla escolha. Suas respostas **não devem** ser migradas como restrições confirmadas.

## 3. Princípios (não negociáveis nesta proposta)

1. **Ausência não é compatibilidade.** Sem restrição confirmada, nenhuma saída diz "seguro", "compatível" ou "adequado".
2. **Texto livre não é inferido.** Observação clínica livre pode existir, mas nenhum cálculo ou regra a lê.
3. **Resultado indeterminado é o padrão.** Alimento sem classificação gera `indeterminado`, não "sem conflito".
4. **Nada de diagnóstico, semáforo ou decisão clínica autônoma.** O sistema marca fatos; o profissional decide.
5. **Servidor decide tenant e autorização.** O cliente nunca informa tenant; a carteira do paciente é autorizada antes de ler.
6. **Dado de saúde:** cifrado, retido e registrado em auditoria conforme a classificação (`docs/agents/DATA_CLASSIFICATION.md`).

## 4. Dados estruturados propostos (nomes provisórios)

**Registro de restrição** (um por restrição do paciente):

| Campo | Valores / regra |
| --- | --- |
| `natureza` | `clinica` (alergia, intolerância, doença com restrição), `escolha` (religiosa, cultural, ética) ou `preferencia`. **Preferência fica fora de qualquer "conflito".** |
| `alvo` | `{tipo: alergeno \| grupo \| alimento, id}` com ID de uma lista curada. Nunca texto. |
| `gravidade` | Só para natureza `clinica`: `leve`, `moderada`, `grave`, `nao_informada` (padrão, sem bloquear). Não se aplica a `escolha` nem `preferencia`. Informa destaque; **não** autoriza nem proíbe. |
| `estado` | `ativa`, `em_reavaliacao`, `inativa`. |
| `origem` | `profissional`, `declaracao_paciente`, `questionario`. |
| `confirmado_por`, `confirmado_em` | Obrigatórios para uso em qualquer regra. Sem confirmação, o registro é **rascunho** e não gera conflito. |
| `revisao` | Contador para edição concorrente (CAS), como nos fluxos existentes. |
| `observacao` | Texto livre cifrado. **Nunca** lido por regra. |

**Situação da avaliação do paciente** (um por paciente, distinta dos registros):

| Valor | Significado |
| --- | --- |
| `nao_informado` | Ninguém avaliou. Padrão para todo paciente existente. |
| `sem_restricoes_confirmadas` | O profissional confirmou ativamente que não há restrição. Tem `confirmado_em` e **validade**. Vencida, volta a `nao_informado`. |
| `restricoes_registradas` | Há pelo menos um registro ativo confirmado. |

## 5. Quem preenche e confirma

- O **profissional** registra e confirma. A declaração do **paciente** (portal ou questionário) entra como rascunho
  até confirmação.
- Toda criação, confirmação, edição e inativação gera evento de auditoria **sem o conteúdo clínico** (redação
  conforme F6).
- Permissão: a de escrita no prontuário/plano do paciente, sem criar papel novo na primeira fase. SuperAdmin não
  lê restrição sem carteira, como já ocorre com o contexto confirmado da DRI.

## 6. Mapeamento para alimentos

Tabela **curada e versionada** `alimento_alergeno` (nova, aditiva): `(fonte_id, codigo_origem)` → `alergeno_id`,
`relacao` (`contem`, `pode_conter`, `nao_contem_confirmado`), `versao_mapeamento`, origem da classificação e
quem revisou. Não há como derivar isso do catálogo atual (F4).

Resultado por par (alimento, restrição ativa e confirmada):

| Resultado | Quando |
| --- | --- |
| `conflita` | Mapeamento `contem` para o alvo da restrição. |
| `pode_conflitar` | Mapeamento `pode_conter`. |
| `sem_conflito_registrado` | Mapeamento `nao_contem_confirmado` **e** avaliação confirmada. Texto factual: não diz "seguro". |
| `indeterminado` | Sem classificação, avaliação `nao_informado` ou vencida, ou restrição em rascunho. **Padrão.** |

Sem IA classificando alérgeno e sem classificação por nome do alimento. Toda linha do mapeamento tem revisão humana.

## 7. Como os fluxos consomem o contrato

- **M11 (consulta):** marca cada item com o resultado da seção 6, **sem esconder** itens com conflito (esconder
  faz o profissional não saber que o alimento existe e foi excluído). Sem avaliação, mostra o aviso "restrições
  não avaliadas" em vez de calar.
- **M04 (troca com prévia):** lista os conflitos do "depois" ao lado do "antes", como fato.
- **M12 (cenários):** lista conflitos por alternativa; **apply** (aplicar ao plano) exige reautorização no servidor e
  a confirmação do conflito, e é trabalho para sessão Opus (R4).
- **Paciente:** não vê julgamento de compatibilidade. Decisão sobre ver as próprias restrições declaradas: aberta (D7).

## 8. Segurança e privacidade (R4)

- Tenant resolvido pelo servidor; carteira autorizada **antes** de ler restrição (mesma ordem de
  `carregarContextoConfirmado` da DRI).
- Dado de saúde cifrado com o padrão já usado em `pacientes` (`*_criptografado`), ver
  `docs/governance/DESENHO_CRIPTOGRAFIA_TITULOS_PHI_FASE261.md` (a reler na implementação). RLS por tenant como nas
  tabelas existentes.
- Retenção e exclusão seguem os campos de ciclo de vida de `pacientes` (F1). Base legal: decisão D8.
- Nada em logs, telemetria, erros, Cache Storage, PDF sem a opção explícita do profissional, ferramenta externa ou
  fixture real. Respostas HTTP só com DTO mínimo e allowlist.
- DDL e migration só com ambiente, banco, branch e role confirmados, fora de banda, com ensaio em banco descartável.

## 9. Propriedades de teste exigidas na implementação

1. Ausência de restrição, avaliação `nao_informado` ou vencida **nunca** produz `sem_conflito_registrado`.
2. Texto livre (`observacao`, resposta de questionário) **nunca** altera resultado.
3. Restrição em rascunho não gera conflito; sem `confirmado_por`/`confirmado_em` não entra em regra.
4. Alimento sem linha em `alimento_alergeno` é `indeterminado` em todo caminho (M11, M04, M12).
5. Isolamento: outro tenant e outra carteira não leem, não escrevem e não inferem existência (resposta idêntica).
6. SuperAdmin sem carteira não lê.
7. Edição concorrente: CAS recusa a segunda escrita.
8. Auditoria e erros sem conteúdo clínico (canários).
9. Preferência nunca vira conflito.
10. Mutação do mapeamento muda a versão e é rastreável; o resultado cita a versão usada.
11. Consistência entre as saídas (tabela, detalhe, relatório), como na T6.

## 10. Fases de entrega (PRs pequenas) e rollback

| Fase | Entrega | Risco | Rollback |
| --- | --- | --- | --- |
| P1 | Modelo, tabelas e migration aditivas (restrição, avaliação, mapeamento), sem consumidor | R4 | Tabelas novas e vazias: reverter a migration antes de haver dado; depois, só desativar o consumo (dado clínico não é apagado sem política). |
| P2 | API/BFF e autorização (criar, confirmar, listar), com testes negativos | R4 | Desligar por flag; dados persistem. |
| P3 | Consumo no M11 (marcação, aviso de "não avaliadas") | R3 | Desligar o consumo por flag. |
| P4 | Consumo em M04 e M12 (apply só em sessão Opus) | R4 | Reverter o leitor, nunca o writer. |

## 11. Decisões abertas para o proprietário

| ID | Decisão | Recomendação |
| --- | --- | --- |
| D1 | Quais naturezas entram na primeira fase. | Só `clinica` (alergia e intolerância) e `escolha`; `preferencia` registrada mas **fora** de conflito. |
| D2 | Lista de alérgenos/grupos e **quem a valida**. | Lista curta e fechada, validada pelo responsável clínico. Fonte candidata a validar: a lista de alérgenos de declaração obrigatória na rotulagem da Anvisa (**não verificada nesta sessão**). |
| D3 | Validade de `sem_restricoes_confirmadas`. | Valor a definir pelo responsável clínico; sugestão de partida: 12 meses e reconfirmação a cada nova versão de plano. |
| D4 | Conflito: aviso ou bloqueio, e a granularidade da exceção. | Marcar e avisar sempre; bloquear só o **aplicar** de item que `conflita` por restrição `clinica` confirmada, com exceção auditada e motivo do profissional. Para não travar o plano, a exceção vale **por paciente e alérgeno** (visível e revogável), com motivos pré-definidos mais campo opcional; para natureza `escolha` ou gravidade leve, só confirmação simples (NUX-05). |
| D5 | Quem preenche. | Profissional confirma; paciente declara como rascunho. |
| D6 | O que fazer com a pergunta atual do questionário (F2). | Não migrar respostas antigas; tratar como "declaração antiga, não confirmada". |
| D7 | O paciente vê as próprias restrições e pode propor correção? | Sim, só as que ele declarou, com dois textos leves ("Você informou. Seu nutricionista ainda vai conferir" e "Conferido pelo seu nutricionista") e sem julgamento de compatibilidade. A correção do paciente entra como rascunho e nunca altera uma restrição confirmada sem ação do profissional (PUX-01, NUX-07). Decisão de produto. |
| D8 | Cifragem, retenção e base legal (LGPD). | Seguir o padrão de `pacientes`; confirmar a base legal com o responsável de privacidade. |
| D9 | Ordem e dono de cada fase. | P1 e P2 em Sonnet com revisão cruzada; P4 (apply) em Opus. |
| D10 | Quem pode confirmar e reconfirmar a avaliação em clínica; a confirmação vale para toda a equipe? | Qualquer profissional com carteira sobre o paciente, com autor e data visíveis. Confirmar com o proprietário (NUX-04). |
| D11 | Alvo ou alimento sem classificação: só avisar ou impedir o registro até a curadoria? | Só avisar, com pendência visível de curadoria e a frase "este registro ainda não gera alerta automático" (NUX-02). |

## 12. O que exige validação humana clínica (não é decidido por mim)

A lista de alérgenos e de grupos; cada linha do mapeamento alimento→alérgeno; a semântica de gravidade; a validade da
confirmação; a regra de conflito e de exceção; os textos mostrados ao profissional e ao paciente. Nenhum desses itens
pode ser fechado por revisão técnica ou por simulação de persona.

## 13. Fora de escopo

Classificar adequação de dieta, calcular risco, diagnosticar, importar restrições de texto livre, usar IA para
classificar alérgenos, migrar dados reais, qualquer implementação.

## 14. Ajustes incorporados depois da revisão de UX (etapa A, 2026-11-11)

Duas personas simuladas (nutricionista e paciente) avaliaram o brief desta proposta; relatório em
`docs/agents/ux/reports/FOOD06-T8-A-2026-11-11/`. Não houve P0. Os pontos abaixo entram **na proposta** como desenho
recomendado e continuam sujeitos à decisão do proprietário; nenhum foi implementado nem validado com pessoas reais.

- **Entrada rápida (NUX-01, NUX-10):** padrões (origem `profissional` quando ela digita, estado `ativa`, gravidade
  `nao_informada`), busca por nome e **confirmação em lote** com revisão visível. Natureza sugerida pelo tipo de alvo,
  editável. Gravidade só para natureza `clinica`.
- **Alvo fora da lista (NUX-02):** usar o grupo mais próximo ("crustáceos" cobre camarão) ou "não encontrei", que cria
  pendência visível de curadoria e mostra que o registro **ainda não gera alerta automático**. Alimento não classificado
  mostra texto próprio, distinto de "avaliação ausente".
- **Base legada (NUX-03, PUX-03):** a resposta antiga do questionário aparece como **sugestão a confirmar**, promovível em
  um gesto; a opção `nenhuma` **nunca** vira `sem_restricoes_confirmadas`. O aviso "restrições não avaliadas" é uma faixa
  por paciente/sessão, não repetida a cada busca de alimento.
- **Validade vencida (NUX-04):** não bloqueia a troca. A prévia mostra data e autor da última confirmação e oferece
  "reconfirmar agora" sem sair da troca.
- **Exceção ao aplicar (NUX-05):** ver D4 (por paciente e alérgeno, reutilizável e revogável).
- **Texto do selo (NUX-06, PUX-02):** `sem_conflito_registrado` aparece como "sem alérgeno mapeado para as restrições
  confirmadas deste paciente", com a indicação de que traços, contaminação cruzada e ingrediente composto **não** estão
  cobertos e de que a avaliação clínica continua sendo do profissional. Nunca "seguro", "liberado" nem ícone verde.
- **Paciente (PUX-01, 02, 05, 06):** nenhum estado do motor (`indeterminado`, `pode_conflitar`, `sem_conflito_registrado`,
  `em_reavaliacao`) vira rótulo para o paciente. Textos leves e fixos, por exemplo "Ainda não conferimos este item.
  Pergunte ao seu nutricionista". Troca de ingrediente mostra a quantidade e uma nota curta, sem termos de auditoria.
- **Reavaliação e receitas (NUX-08, NUX-09):** `em_reavaliacao` **mantém o conflito ativo** e mostra o estado na
  marcação; na troca de receita o conflito aponta **o ingrediente e a restrição**, em linha curta.
- **Etapas B e C:** medir a entrada (NUX-01), o texto do selo com nutricionistas reais (NUX-06) e a compreensão e o uso
  por teclado e leitor de tela do lado do paciente (PUX-01, 04). Nada disso foi testado.
