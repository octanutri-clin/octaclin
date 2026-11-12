# FOOD06 M11/M04/M12 — contrato de restrições alimentares, versão 2 (decisões D1–D11)

**Status:** CONTRATO PROPOSTO v2. **Nada foi implementado nesta PR**: sem código, rota, migration, flag ou configuração.
Substitui a proposta v1 (`tasks/food06-m11-restricoes-contrato-proposta.md`, PR #524) onde as decisões D1–D11 do
proprietário a alteram; a v1 fica como histórico.

- Base verificada: `main` em `d84b0f11` (2026-11-11). Tema **R4** (saúde/PHI, autorização, tenant). Esta entrega: R2 (documento).
- **B04 e M11-C2 continuam abertos.** Só serão reavaliados com contrato validado, evidências e aceite. Este documento não os encerra.
- Dados: somente exemplos sintéticos. Nomes de tabelas, enums e DTOs são **provisórios**; a implementação aproveita os
  padrões existentes (seção 4.9).
- Autorização do proprietário nesta rodada: posso implementar; **o proprietário mergeia todas as PRs**; **nenhuma migration
  é aplicada em staging ou produção** (só ensaio em PostgreSQL descartável); a ordem é este contrato, depois o domínio puro.

## 1. Resumo executivo

**Decidido (D1–D11):** três naturezas com regras separadas (clínica com subtipos, escolha, preferência); catálogo curado,
fechado na entrada e versionado, com a lista de rotulagem da Anvisa como referência **a conferir**; reconfirmação em 180 dias
como política de produto; alertas factuais e controle do **aplicar** por natureza, **sem exceção permanente**; profissional
confirma e paciente declara; respostas antigas do questionário não migram; paciente vê e propõe correção sem sobrescrever;
privacidade com verificação explícita; entrega em P1–P4 com rollback que desliga consumidores; só profissional assistencial
habilitado confirma; alvo desconhecido pode ser registrado e o resultado é `indeterminado`.

**Condicionado (não decidido por ninguém ainda):** a lista de alérgenos e cada mapeamento alimento→alvo; as **regras clínicas** que
fazem o aplicar ser impedido; os 180 dias; a semântica de gravidade; os textos; a base legal, a retenção e a cifragem de dados
em `jsonb`; testes com pessoas reais.

**Consequência importante para o projeto:** o sistema pode ser entregue **seguro e inerte**. Sem taxonomia, mapeamento e regra
clínica validados, o motor devolve `indeterminado` e exige revisão explícita onde há risco; ele nunca produz "sem conflito".
Nenhum conteúdo clínico é semeado por engenharia.

## 2. Tabela D1–D11

| ID | Decisão consolidada | Mudança versus v1 (#524) | Principal risco | Validação exigida |
| --- | --- | --- | --- | --- |
| D1 | `clinica` (4 subtipos), `escolha`, `preferencia`, com regras diferentes. | v1 deixava `preferencia` e `escolha` em segundo plano e não tinha subtipos. Entra o subtipo clínico e a separação alergia ao leite × intolerância à lactose e doença celíaca × alergia ao trigo. | Confundir naturezas; tratar `gluten` como alergia. | Responsável clínico: subtipos e regras. |
| D2 | Catálogo curado e versionado; Anvisa RDC 727/2022 como referência inicial **a conferir**; evidência positiva por mapeamento; sem IA classificando. | v1 já pedia tabela curada; agora há taxonomias distintas (alérgeno, constituinte, grupo, alimento, escolha, ingrediente) e rastreabilidade completa. | Lista de rotulagem tomada como lista clínica; silêncio de tabela virar "não contém". | Clínica (taxonomia e linhas); regulatório (vigência). |
| D3 | 180 dias como política de produto. | v1 sugeria 12 meses; agora 180 dias, com reconfirmação antecipada por mudança relevante e sem bloquear ajuste trivial. | Prazo sem base científica; ambiguidade sobre restrições já confirmadas (ver C9). | Clínica e UX. |
| D4 | Alertas factuais; **impedir** o aplicar em alergia ou celíaca com presença identificada, **sem botão de ignorar**; exceção só específica, auditável e revogável. | **Muda a minha recomendação.** A v1 propunha exceção reutilizável por paciente e alérgeno; a decisão proíbe isso. | Bloqueio operacional por mapeamento errado; falta de caminho de saída (C1). | Clínica: regras de tolerância e de contaminação. |
| D5 | Profissional registra e confirma; paciente declara; texto livre nunca infere. | v1 já tinha; entra confirmação em lote com visão individual e pendência visível nos módulos. | Pendência virar ruído ou ser silenciada. | UX. |
| D6 | Não migrar respostas antigas; promoção explícita; `nenhuma` nunca confirma. | v1 ia na mesma direção; agora a pergunta futura separa as naturezas e `nenhuma` é exclusiva. | Leitura de resposta antiga como fato. | UX e clínica. |
| D7 | Paciente vê o resumo próprio e propõe correção sem sobrescrever. | v1 deixava aberto; agora decidido, com três textos de estado. | Estado do motor vazar ao paciente; falsa sensação de proteção. | UX com pessoas reais, acessibilidade, privacidade. |
| D8 | Verificar, não presumir; DTO mínimo; tenant e carteira antes de tudo. | v1 seguia o padrão de `pacientes`; agora a verificação é explícita e há achado novo (C2). | Dado de saúde e de convicção em claro; base legal indefinida. | Privacidade e jurídico. |
| D9 | P1–P4 em PRs pequenas; rollback desliga consumidores. | v1 tinha 4 fases; agora há condição de avanço por fase e preservação do G06. | Merge virar deploy; migration em ambiente real. | Segurança e revisão cruzada. |
| D10 | Só profissional assistencial habilitado e autorizado confirma; compartilhamento só dentro do tenant e da carteira. | v1 dizia "qualquer profissional com carteira"; agora exige habilitação **por ação**. | "Habilitado" ainda não existe como conceito (C5). | Proprietário: o que significa habilitado. |
| D11 | Registrar alvo desconhecido com curadoria; `indeterminado` com motivo; visualmente distinto de "paciente não avaliado". | v1 propunha o mesmo; agora com lista de motivos e reprocessamento versionado. | Registro sem alerta confiável parecer protegido. | UX. |

## 3. Análise crítica

Severidade: **Crítica** (pode causar dano ou exposição, bloqueia), **Alta** (corrigir antes de usar em produção),
**Média** (corrigir na fase indicada), **Baixa**. "Verificado" = lido neste ciclo; "não verificado" = declarado como tal.

| # | Severidade | Achado | Tratamento no contrato |
| --- | --- | --- | --- |
| C1 | **Alta** | D4 impede o aplicar sem ignorar, mas **o caminho de saída precisa existir**: se o mapeamento estiver errado, ou o paciente tiver alergia remitida, o nutricionista fica preso. | A saída é sempre uma ação **sobre o registro ou sobre a classificação**, nunca sobre o alerta: (a) corrigir a classificação pela curadoria versionada, (b) revisão formal do registro (`em_reavaliacao`, que **continua valendo no motor**, ou `inativa` com motivo e autor). Ver questão Q3 (quem pode inativar uma alergia grave). |
| C2 | **Alta** (privacidade, anterior a este trabalho) | **Verificado:** o questionário grava `valor: resposta.valor` direto em `resposta_valores.valor` (`jsonb`), **sem cifragem de aplicação** (`servico-questionarios.ts`, gravação das respostas). A cifragem em repouso do provedor **não foi verificada**. A resposta sobre restrição alimentar é dado de saúde. | O contrato novo **não copia** conteúdo de respostas para tabelas sem cifragem; a leitura de respostas antigas (D6) é só leitura. A remediação do questionário é decisão separada (Q5). |
| C3 | **Média** | **Verificado:** o Anexo III do texto oficial da RDC 727/2022 (DOU, 06/07/2022) tem **18 itens**. **Não confirmado:** que seja a versão vigente hoje. A busca encontrou **revisão em curso**: diálogo setorial da Anvisa sobre rotulagem de alérgenos (2025) e as consultas públicas de 2026 sobre a RDC 727 (por exemplo a CP 1.400/2026, que na descrição consultada trata de outros temas). | A taxonomia é **versionada** e cita a fonte e a data de conferência; a vigência é item de acompanhamento regulatório (Q7). O artigo 4º, IV (a rotulagem não pode alegar ausência de alérgeno) e o artigo 14 ("pode conter" depende de Programa de Controle) reforçam que **silêncio de rótulo ou de tabela nunca prova ausência**. |
| C4 | **Média** | O Anexo III agrupa alimentos de formas que **não coincidem com entidades clínicas**: o item 1 junta trigo, centeio, cevada e aveia; o item 7 é "leites de todas as espécies de animais mamíferos". Lactose **não** é alérgeno nesse texto: tem advertência própria (art. 18, acima de 100 mg por 100 g) e o glúten é regido por outra lei (a Lei 10.674/2003, **citada no texto, não lida aqui**). | Taxonomias separadas (D2): alérgeno de declaração, constituinte (lactose, glúten), grupo, alimento, escolha. Alergia ao trigo, doença celíaca e alergia ao leite × lactose são alvos e regras distintos. |
| C5 | **Alta** | **Verificado:** só há os papéis `SuperAdmin`, `Professional`, `Collaborator`, `Patient` e `Client`. "Profissional assistencial habilitado" (D10) não existe como conceito. O precedente das gestações aceita `SuperAdmin`, `Professional` e `Collaborator` com `pacientes.ler` (leitura) ou `pacientes.gerenciar` (escrita). | Para restrições, o serviço é **mais estrito que o precedente**: confirmar exige `Professional` **mais** permissão nova específica; `Collaborator` só registra pendência; `SuperAdmin` não lê sem carteira. O catálogo de permissões e o mapa de rotas mudam na PR-D. O que "habilitado" significa é a questão Q6. |
| C6 | **Alta** | O `apply` do M04/M12 usa CAS, fingerprint e PA07. As restrições precisam **entrar no fingerprint**, senão uma restrição confirmada entre a prévia e o aplicar passa despercebida (TOCTOU). | O fingerprint inclui revisão das restrições, versão do mapeamento, versão da regra, validade da avaliação e versão da composição do alimento. Qualquer mudança invalida a prévia. |
| C7 | **Alta** | D4 e a seção 3.3 exigem que a prévia **não omita alerta que reaparece no aplicar**. Se prévia e aplicar usarem caminhos diferentes, divergem. | **Uma única função pura** avalia, e a prévia e o aplicar a chamam com as mesmas entradas. Teste de propriedade: avaliação da prévia = avaliação do aplicar para a mesma entrada. |
| C8 | **Média** | Vários resultados por restrição: o "sem conflito" de um alvo não pode ocultar o conflito de outro. | Resultado **agregado e lista individual**; precedência conservadora (seção 4.5). |
| C9 | **Média** | **Ambiguidade em D3:** a validade de 180 dias vale para `sem_restricoes_confirmadas`. Não está dito se uma **restrição já confirmada** também "vence" e passa a ser ignorada. | **Proposta:** restrição confirmada **nunca deixa de valer por decurso de prazo**. A reconfirmação em 180 dias é um pedido visível, não uma queda silenciosa. Vencida a **avaliação**, somem o `sem_conflito_registrado` e o resumo "sem restrições", mas continuam `conflita` e `pode_conflitar`. Q2. |
| C10 | **Alta** | D4 impede o aplicar "conforme regra clínica validada", e **não existe regra validada**. Sem regra, o motor não pode "impedir" por conta própria. | Cada regra é um registro versionado com validação humana. Sem regra validada, o resultado é `indeterminado` com motivo `regra_nao_validada` e o aplicar exige **revisão explícita** sempre que houver presença identificada ou possível. Nunca vira "liberado". |
| C11 | **Alta** (privacidade) | `escolha` pode revelar **convicção religiosa ou filosófica** (por exemplo, uma restrição religiosa), que a LGPD trata como dado sensível além do dado de saúde. A decisão fala em "razões éticas, culturais ou religiosas, quando declaradas". | Minimização: guardar o **alvo** (por exemplo, `sem_carne`) e a **razão** como campo opcional cifrado que nunca aparece em tela do paciente nem em auditoria; o motor só usa o alvo. Avaliação de privacidade obrigatória (Q4). Não é parecer jurídico. |
| C12 | **Média** | D1 diz que `preferencia` é "registrada e considerada em sugestões", e D5 diz que toda declaração do paciente entra como pendente. Não está dito se preferência precisa de confirmação. | **Proposta:** preferência não precisa de confirmação do profissional para ser exibida, **nunca** entra no motor de conflito e nunca bloqueia. Q8. |
| C13 | **Baixa** | `outra_restricao_clinica` (D1.4) fica sem regra até existir alvo e regra estruturados. | Aceita registro e fica `indeterminado` com motivo `regra_nao_validada`. |
| C14 | **Média** | Snapshots e histórico: uma decisão de aplicar precisa guardar a evidência e a versão usadas, e a curadoria posterior **não pode reescrever** o passado. | Registros de decisão são **append-only**, no padrão dos registros factuais (migration 1082, `RegistrosFactuaisAppendOnly`). |
| C15 | **Média** | O G06 continua BLOCKED e o Render faz auto-deploy da `main`: mergear já pode alterar produção. | Fases sem consumidor, depois consumidores atrás de flag desligada (`OCTACLIN_FEATURE_FLAGS`, `infraestrutura/feature-flags/servico-feature-flags.ts`). Nenhuma migration aplicada em ambiente real (decisão do proprietário). |
| C16 | **Média** (UX) | Com D4 o nutricionista pode ser **impedido de aplicar**, e a v1 já mostrava o risco de atrito e de alerta ignorado. | Revisão de UX da etapa A feita sobre este desenho (seção 9): sem P0, quatro P1 (NUX-11, 15, 18 e 19) incorporados ao contrato. |

## 4. Contrato proposto

### 4.1 Entidades (nomes provisórios)

Todos os dados de saúde ou de convicção ficam **cifrados** com `CriptografiaDadosSensiveis` (campo `*_criptografado`, como em
`pacientes` e nas gestações). Toda tabela tem `tenant_id`, RLS e `FORCE`. O tenant vem do servidor.

1. **`RestricaoPaciente`** — uma por restrição.
   `id`, `tenantId`, `pacienteId`, `natureza` (`clinica | escolha | preferencia`), `subtipoClinico`
   (`alergia_alimentar | intolerancia_alimentar | doenca_ou_condicao_com_restricao | outra_restricao_clinica`, só quando `clinica`),
   `alvoTipo` (`alergeno | constituinte | grupo | alimento | categoria_escolha | nao_catalogado`), `alvoId` (nulo em `nao_catalogado`),
   `alvoDeclaradoCriptografado` (só em `nao_catalogado`), `gravidade` (`leve | moderada | grave | nao_informada`, só `clinica`, padrão
   `nao_informada`), `estado` (`ativa | em_reavaliacao | inativa`), `origem`
   (`profissional | colaborador | declaracao_paciente | questionario_legado`), `confirmacao` (`pendente | confirmada | rejeitada`),
   `confirmadoPor`, `confirmadoEm`, `razaoCriptografada` (só `escolha`, opcional), `observacaoCriptografada`, `revisao` (CAS), `criadoPor`,
   `criadoEm`, `atualizadoEm`.
2. **`RestricaoRevisao`** — histórico append-only numerado (como as referências das gestações), com o conteúdo cifrado e o autor.
3. **`AvaliacaoRestricoesPaciente`** — uma por paciente. `situacao` (`nao_informado | sem_restricoes_confirmadas | restricoes_registradas`),
   `confirmadoPor`, `confirmadoEm`, `venceEm`, `revisao`. Mais um histórico append-only.
4. **`SolicitacaoRestricaoPaciente`** — `tipo` (`inclusao | correcao | remocao`), referência à restrição original, `estado`
   (`aberta | em_analise | aceita | recusada`), conteúdo cifrado, autor, decisão do profissional. **Nunca sobrescreve** a restrição.
5. **`TaxonomiaAlvo`** — catálogo curado: `tipo`, `codigo`, `nome`, `versaoTaxonomia`, `fonteReferencia` (por exemplo a norma e a data de
   conferência), `revisadoPor`, `revisadoEm`. Entra **vazio**.
6. **`MapeamentoAlimentoAlvo`** — `(fonteId, codigoOrigem)` ou ingrediente/receita → `alvoId`, `relacao` (`contem | pode_conter |
   nao_contem_confirmado`), `granularidade` (`alimento | produto | ingrediente`), `evidenciaReferencia`, `versaoMapeamento`, `revisadoPor`,
   `revisadoEm`, `justificativa`. **Invariante:** `nao_contem_confirmado` exige `evidenciaReferencia` e revisão humana; campo vazio de
   tabela nutricional nunca basta. Entra **vazio**.
7. **`RegraClinicaRestricao`** — versionada: `subtipo` e `alvo` → `acaoAplicar` (`impedir | exigir_esclarecimento | exigir_revisao |
   exigir_confirmacao | nenhuma`), `validadaPor`, `validadaEm`, `versaoRegra`. Entra **vazia**: sem regra validada, vale C10.
8. **`DecisaoAplicacaoRestricao`** — append-only: paciente, revisão das restrições, regra e mapeamento usados, hash e versão da
   composição do alimento/receita, decisão, justificativa cifrada, autor, validade e revogação. Registra a **evidência usada**.
9. **Auditoria** — eventos com ação e metadados mínimos, **sem conteúdo clínico** (redação conforme `redacao-auditoria.ts`).
10. **`PedidoCuradoria`** (vem de NUX-11 e NUX-19) — pedido para corrigir a classificação de um alimento ou ingrediente, ou para incluir um alvo
    que o catálogo não tem. Campos: paciente (opcional, só para contexto), alimento ou ingrediente, alvo, `motivoCriptografado`, `estado`
    (`aberto | em_analise | atendido | recusado`), autor, datas, e a versão de mapeamento resultante. **Não altera o resultado do motor** até que a
    curadoria humana publique uma nova versão do mapeamento. É a saída operacional do bloqueio do D4 e a lista de "registros sem alerta automático".

### 4.2 Invariantes

1. `natureza = clinica` ⇔ `subtipoClinico` presente; `gravidade` só em `clinica`.
2. Sem `confirmadoPor` e `confirmadoEm`, a restrição **não entra** em regra que produza `conflita` ou bloqueio; fica pendente e visível.
3. `confirmadoPor` é sempre um `Professional` autorizado para o paciente. `Collaborator` e o paciente só criam `pendente`.
4. `sem_restricoes_confirmadas` não pode ser confirmado **enquanto houver restrição confirmada ativa ou declaração pendente relevante**
   sem que o profissional as resolva na mesma ação (precedência explícita).
5. Texto livre (`observacao`, `razao`, resposta de questionário) nunca altera alvo, gravidade ou resultado.
6. Restrição `em_reavaliacao` **continua no motor** até decisão explícita de inativar (3.4 do documento do proprietário).
7. Toda mudança gera revisão numerada; edição concorrente usa CAS e transições de confirmação são atômicas.
8. Mapeamento, regra e taxonomia são versionados; decisões antigas guardam a versão usada e **não são reescritas**.
9. `preferencia` nunca produz `conflita`, `pode_conflitar` nem bloqueio.
10. `nenhuma` de questionário jamais cria `sem_restricoes_confirmadas`.

### 4.3 Estados e transições

| De | Para | Quem | Condição |
| --- | --- | --- | --- |
| (novo) | `pendente` | `Professional`, `Collaborator`, paciente (pedido) | origem registrada |
| `pendente` | `confirmada` | `Professional` habilitado | ação expressa, em lote com visão individual |
| `pendente` | `rejeitada` | `Professional` habilitado | motivo; mantém o histórico |
| `confirmada/ativa` | `em_reavaliacao` | `Professional` habilitado | continua valendo no motor |
| `em_reavaliacao` | `ativa` ou `inativa` | `Professional` habilitado | `inativa` exige motivo e autor |
| `inativa` | — | — | terminal; recorrência cria um registro novo |
| `ativa` | `inativa` | `Professional` habilitado | exige motivo; restrição grave: ver Q3 |

### 4.4 Semântica do mapeamento e dos resultados

Resultados por par **(item, restrição)** ou **(ingrediente, restrição)**; receita avalia cada ingrediente identificado, e ingrediente
não identificado gera `indeterminado` com motivo próprio.

| Resultado | Quando |
| --- | --- |
| `conflita` | mapeamento `contem` **e** regra clínica validada aplicável à restrição **confirmada** |
| `pode_conflitar` | mapeamento `pode_conter` (documentado), restrição confirmada |
| `sem_conflito_registrado` | mapeamento `nao_contem_confirmado` com evidência, **avaliação válida**, cobertura suficiente e nenhuma pendência relevante. **Não** significa seguro, ausência universal de alérgeno nem de contaminação cruzada. |
| `indeterminado` | qualquer falta, com **motivo**: `avaliacao_nao_informada`, `avaliacao_vencida`, `declaracao_pendente`, `alvo_nao_catalogado`, `alimento_sem_classificacao`, `ingrediente_nao_identificado`, `regra_nao_validada`, `mapeamento_sem_evidencia` |
| `sem_efeito_clinico` | `preferencia` (informa, não compara) |

### 4.5 Agregação e precedência conservadora

Por item: **lista de resultados individuais** mais **resultado agregado** pela ordem
`conflita` > `pode_conflitar` > `indeterminado` > `sem_conflito_registrado`. O agregado só é `sem_conflito_registrado` se **todas** as
restrições clínicas confirmadas deram `sem_conflito_registrado`, não há declaração pendente relevante e a avaliação é válida. Um
`sem_conflito_registrado` nunca oculta o `conflita` de outro alvo. A **ação de aplicar** agregada é a mais restritiva:
`impedido` > `exige_esclarecimento` > `exige_revisao` > `exige_confirmacao` > `permitido`. Sem selo verde e sem "seguro", "liberado" ou "adequado".

### 4.6 Versionamento e consistência

A avaliação é uma **função pura** `avaliar(entrada) → saída`, com a entrada completa e versionada (restrições com revisão, avaliação,
taxonomia, mapeamento, regra, versão e hash da composição). A prévia e o aplicar usam a mesma função. O `apply` recalcula tudo no
servidor, reautoriza, revalida e compara com o fingerprint da prévia; qualquer diferença exige nova revisão. A curadoria posterior
reprocessa resultados **futuros**; decisões passadas mantêm a evidência que usaram.

### 4.7 Autorização (servidor)

Tenant resolvido pelo servidor; a **carteira do paciente é autorizada antes de ler qualquer coisa**, inclusive a existência de
restrições. Respostas idênticas para "não existe" e "não autorizado". `SuperAdmin` sem carteira não lê. Matriz:

| Ação | `Professional` (habilitado) | `Collaborator` | `Patient` | `SuperAdmin` sem carteira |
| --- | --- | --- | --- | --- |
| Ler restrições do paciente | sim | só as que registrou ou o resumo de pendência (a definir em Q6) | só as próprias, resumo simples | não |
| Registrar pendência | sim | sim | sim (declaração/pedido) | não |
| Confirmar, rejeitar, inativar | sim | **não** | **não** | não |
| Reconfirmar a avaliação global | sim | **não** | **não** | não |
| Decisão de aplicar | sim | **não** | **não** | não |

### 4.8 Pendências

Declaração pendente e `avaliação ausente/vencida` aparecem como **faixa por paciente e sessão**, não repetidas em cada linha. A
pendência **não** vira conflito confirmado nem some em silêncio. Se um item é potencialmente incompatível com uma declaração pendente,
o aplicar exige revisão profissional proporcional ao risco.

### 4.9 Reuso (padrões existentes)

- Serviço por paciente com dado de saúde: `modulos/pacientes/aplicacao/servico-gestacoes-paciente.ts` (`ExecutorTenant`,
  `CriptografiaDadosSensiveis`, `garantirEscopoPaciente`, referências numeradas, lock pessimista, fingerprint, consentimento).
- RLS e migration aditiva: `migracoes/1720000001081-RegistrosAnalisesFactuais.ts`; append-only: `…1082-RegistrosFactuaisAppendOnly.ts`.
- Motor puro e prévia: `dominio/cenarios-dieteticos.ts`, `dominio/previa-dietetica.ts`, `dominio/cobertura-dietetica.ts`.
- Flags: `infraestrutura/feature-flags/servico-feature-flags.ts` (`OCTACLIN_FEATURE_FLAGS`).
- Papéis e permissões: `modulos/auth/dominio/` (`PapelUsuario`, catálogo de permissões e `permissoes.spec.ts`).
- Redação: `infraestrutura/auditoria/redacao-auditoria.ts`.

## 5. Matriz de decisão e critérios de aceite

### 5.1 Matriz (natureza/subtipo × confirmação × relação × avaliação → resultado e ação de aplicar)

Pressupõe restrição não inativa. "Regra" = regra clínica validada aplicável. Na linha **sem regra**, vale C10.

| # | Natureza / subtipo | Confirmação | Relação do item | Avaliação | Regra | Resultado | Ação de aplicar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | clínica / alergia | confirmada | `contem` | qualquer | sim | `conflita` | **impedido** (sem ignorar) |
| 2 | clínica / alergia | confirmada | `contem` | qualquer | **não** | `indeterminado` (`regra_nao_validada`) | **exige revisão explícita** |
| 3 | clínica / doença celíaca | confirmada | `contem` glúten | qualquer | sim | `conflita` | **impedido** |
| 4 | clínica / alergia | confirmada | `pode_conter` | qualquer | sim | `pode_conflitar` | exige esclarecimento e revisão |
| 5 | clínica / intolerância | confirmada | `contem` | qualquer | tolerância validada | `conflita` | exige confirmação e justificativa |
| 6 | clínica / intolerância | confirmada | `contem` | qualquer | tolerância **não** validada | `indeterminado` | exige revisão explícita |
| 7 | clínica / qualquer | confirmada | `nao_contem_confirmado` | válida | sim | `sem_conflito_registrado` | permitido |
| 8 | clínica / qualquer | confirmada | `nao_contem_confirmado` | **vencida ou não informada** | — | `indeterminado` | exige revisão (risco relevante) |
| 9 | clínica / qualquer | confirmada | sem classificação | qualquer | — | `indeterminado` (`alimento_sem_classificacao`) | exige revisão explícita |
| 10 | clínica / qualquer | **pendente** | `contem` ou `pode_conter` | qualquer | — | `indeterminado` (`declaracao_pendente`) | exige revisão proporcional |
| 11 | clínica / qualquer | pendente | sem relação | qualquer | — | `indeterminado` (`declaracao_pendente`) | permitido, com pendência visível |
| 12 | clínica / qualquer | confirmada, `em_reavaliacao` | `contem` | qualquer | sim | `conflita` (continua valendo) | **impedido** |
| 13 | escolha | confirmada | `contem` o alvo | qualquer | — | incompatibilidade **não clínica** | exige confirmação explícita (motivo quando cabível) |
| 14 | preferência | qualquer | qualquer | qualquer | — | `sem_efeito_clinico` | permitido, informa e sugere alternativas |
| 15 | `nao_catalogado` | qualquer | qualquer | qualquer | — | `indeterminado` (`alvo_nao_catalogado`) | exige revisão se risco relevante; registro **sem alerta automático confiável** |
| 16 | nenhuma restrição | — | — | `nao_informado` | — | `indeterminado` (`avaliacao_nao_informada`) | permitido, com aviso "não avaliadas" |

**Combinações impossíveis ou contraditórias (o sistema as recusa por invariante):** `natureza=preferencia` com gravidade; `escolha`
com subtipo clínico; `sem_restricoes_confirmadas` com restrição confirmada ativa (invariante 4); `confirmadoPor` sem papel
`Professional`; `nao_contem_confirmado` sem evidência; `conflita` sem regra validada (vira a linha 2); resultado `sem_conflito_registrado`
com avaliação vencida.

### 5.2 Critérios de aceite (os 20 do proprietário, com o teste que os prova)

Todos com dados **inteiramente sintéticos** e canários de PHI.

| # | Critério | Teste (positivo e negativo) |
| --- | --- | --- |
| 1 | Sem avaliação, vencida ou sem classificação, nunca `sem_conflito_registrado` | propriedade sobre o produto cartesiano de estados |
| 2 | Texto livre e questionário legado não alteram o motor | canário na `observacao`: resultado idêntico |
| 3 | Declaração pendente aparece e não vira confirmada sem ação | `Collaborator` e paciente não confirmam (403) |
| 4 | `em_reavaliacao` confirmada continua no motor | linha 12 |
| 5 | Leite × lactose, trigo × celíaca distintos | alvos e regras diferentes; um não ativa o outro |
| 6 | Preferência não bloqueia; escolha sem gravidade de alergia | linhas 13 e 14; invariante 1 |
| 7 | Sem mapeamento, ingrediente desconhecido ou composição alterada: indeterminação ou revisão | linha 9; mudança de hash invalida decisão |
| 8 | Conflito por ingrediente reproduzido em M11, M04 e M12 | mesma função pura nos três |
| 9 | Outro tenant, outra carteira ou `SuperAdmin` sem autorização não lê nem infere | respostas idênticas a "inexistente" |
| 10 | CAS e transições atômicas | duas confirmações concorrentes: uma vence |
| 11 | Versão auditável; snapshots não reescritos | decisão antiga mantém a versão |
| 12 | `apply` recalcula, reautoriza e revalida | TOCTOU: restrição muda entre prévia e aplicar, exige nova revisão |
| 13 | Sem exceção genérica permanente; gravidade leve não libera | nenhum caminho "ignorar"; gravidade não muda a ação |
| 14 | Dado sensível fora de logs, erros, telemetria, auditoria textual, fixtures e PDF | canários |
| 15 | `nenhuma` não confirma ausência | questionário legado com `nenhuma` |
| 16 | Interface expõe origem, estado, vencimento e pendência sem jargão ao paciente | Playwright, teclado e leitor de tela |
| 17 | Revogar, inativar ou corrigir preserva histórico e autoria | append-only |
| 18 | Flag desligada não apaga dado; rollback sem operação destrutiva | teste de rollback |
| 19 | Nenhuma fonte sem evidência de alérgeno conclui ausência | `nao_contem_confirmado` sem evidência é recusado |
| 20 | Dados sintéticos e canários | todo teste |

### 5.3 Exemplos sintéticos

- **A:** paciente sintético com alergia a crustáceos **confirmada**, regra validada, item com mapeamento `contem` crustáceos → `conflita`,
  aplicar **impedido**. A saída é corrigir a classificação ou revisar o registro, não ignorar.
- **B:** mesmo paciente, receita com ingrediente "molho industrial" sem composição cadastrada → `indeterminado`
  (`ingrediente_nao_identificado`), exige revisão. **Nunca** "sem conflito".
- **C:** paciente com `sem_restricoes_confirmadas` há 200 dias → vencida. O item, que era `sem_conflito_registrado`, vira `indeterminado`
  (`avaliacao_vencida`) e aparece o pedido de reconfirmar, sem perder o trabalho da prévia.
- **D:** paciente antigo com a resposta "lactose" e "nenhuma" no questionário: duas sugestões históricas a revisar. Nenhuma restrição
  nem avaliação é criada.
- **E:** paciente com preferência por "sem coentro": o item com coentro mostra a preferência e sugere alternativa, sem conflito.

**Testes negativos obrigatórios:** `Collaborator` tenta confirmar; paciente tenta sobrescrever restrição confirmada; `SuperAdmin` sem
carteira lê; tenant B lê restrição do tenant A; `nao_contem_confirmado` sem evidência; `conflita` sem regra validada; gravidade `leve`
tentando reduzir o alerta de alergia; fingerprint desatualizado no aplicar; canário na `observacao` aparece em log, erro ou auditoria.

## 6. Plano de implementação (PRs pequenas)

O proprietário **mergeia todas**. Nenhuma migration é aplicada em staging ou produção.

| PR | Escopo | Risco | Modelo sugerido | Revisão | Provas e gates | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| **A** (esta) | Contrato v2 (documento) e revisão de UX da etapa A | R2, tema R4 | Sonnet | proprietário e responsável clínico | `git diff --check`, `security:secrets`, `test:tooling-agentes`, caminhos conferidos | reverter o commit |
| **B** (P1a) | Motor de avaliação em **domínio puro**: tipos, transições, resultados, agregação, validade, regras de aplicar. **Sem tabela, rota nem dado** | R4 pelo tema | Sonnet, com revisão cruzada (Opus ou Codex) | cruzada | TDD com RED, oráculo, mutações, propriedades, canários | reverter (sem consumidor) |
| **C** (P1b) | Migration **aditiva**, tabelas vazias, RLS com `FORCE`, cifragem, ORMs | R4 | **Opus** | cruzada obrigatória | ensaio e rollback em PostgreSQL descartável, teste de isolamento por tenant, **sem aplicar em ambiente real** | reverter a migration antes de haver dado; depois só desligar consumidores |
| **D** (P2) | API/BFF, permissões novas, declaração, confirmação, revisão, histórico, auditoria, solicitações do paciente | R4 | **Opus** | cruzada obrigatória | funcionais, negativos, concorrência, `test:authz`, canários | **flag desligada**; dados persistem |
| **E** (P3) | Consumo no M11: marcadores, alertas, fonte e versão, faixa de pendência | R3/R4 | Sonnet com revisão | UX e cruzada | consistência, indeterminação, permissões, Playwright desktop e mobile com axe | desligar o consumo por flag |
| **F** (P4) | Consumo em M04/M12 e **controle do apply** com fingerprint | R4 | **Opus** | clínica e de segurança | E2E, TOCTOU, aprovação humana específica | reverter o leitor, nunca o writer |

**Condições transversais:** nenhuma leitura de tabela nova antes de a migration estar aplicada onde o código roda; flags
desligadas por padrão; o G06 e as dependências de deploy continuam BLOCKED até evidência nova do repositório; rollback desliga
consumidores e **não apaga** registro clínico.

## 7. Questões residuais essenciais

| ID | Quem decide | Questão | Por que não posso assumir |
| --- | --- | --- | --- |
| Q1 | Responsável clínico | Validar a taxonomia, cada mapeamento, a semântica de gravidade, as regras de aplicar (alergia e celíaca) e os critérios de tolerância e de contaminação. | É julgamento clínico; um erro causa dano. |
| Q2 | Proprietário e clínico | Confirmar a proposta C9: restrição confirmada nunca vence; só a avaliação vence. | D3 não diz; o risco é silenciar uma alergia por decurso de prazo. |
| Q3 | Proprietário e clínico | Quem pode **inativar** uma alergia grave e se exige um segundo olhar. | É a única saída do bloqueio do D4; define o risco real. |
| Q4 | Privacidade e jurídico | Base legal por operação, retenção, direitos do titular, menores e representação, e o tratamento de `escolha` religiosa como dado sensível. | Questão jurídica; D8 manda não presumir. |
| Q5 | Proprietário e equipe técnica | Escopo da remediação do questionário (respostas em `jsonb` sem cifragem de aplicação; cifragem em repouso do provedor não verificada). | Achado anterior a este trabalho, com impacto próprio. |
| Q6 | Proprietário | O que é "profissional habilitado": papel `Professional` mais qual permissão nova; o que o `Collaborator` pode **ler**. | Exige mudar o catálogo de permissões. |
| Q7 | Regulatório | Vigência e revisão em curso da RDC 727/2022 e das normas citadas (inclui a Lei 10.674/2003, não lida aqui). | Fonte externa em mudança. |
| Q8 | Proprietário e UX | Preferência precisa de confirmação do profissional (proposta: não)? | Escolha de produto. |
| Q9 | Proprietário | Quem faz a curadoria e em quanto tempo (inclusive para quem atua sem equipe). | Define se o bloqueio do D4 é viável no uso real (NUX-11). |
| Q10 | Proprietário e clínico | A reconfirmação de 180 dias exige registrar que o paciente foi perguntado, ou basta o clique? | Se for só um clique, o prazo vira rotina automática (NUX-12). |
| Q11 | Proprietário e UX | O que o paciente vê antes da confirmação, nos pedidos recusados ou ajustados e nas respostas antigas do questionário. | Escolha de produto com efeito em privacidade e confiança (PUX-12, 14, 16). |

## 8. Próxima tarefa única recomendada

**PR-B — motor de avaliação em domínio puro**, em `octaclin-backend/src/modulos/planos-alimentares/dominio/`, com TDD, a matriz da
seção 5.1 como tabela de casos, oráculo independente, mutações e canários. **Sem tabela, rota, flag, dado clínico ou migration.**
Ela pode ser feita sem esperar Q1 a Q8, porque o motor recebe taxonomia, mapeamento e regra como entrada e, sem eles, devolve
`indeterminado`. As Q1 a Q4 bloqueiam a **ativação**, não a escrita do motor.

## 9. Revisão de UX (etapa A) sobre o v2

Duas personas simuladas (nutricionista e paciente), cada uma com **só o brief**, avaliaram o que as decisões mudam; relatório em
`docs/agents/ux/reports/FOOD06-T8-A2-2026-11-11/` (brief, dois pareceres, consolidado e manifesto). **Não houve P0.** Há 4 achados **P1** da
nutricionista e nenhum da paciente. Os ajustes abaixo **não reabrem D1 a D11**: tratam de como cumprir as decisões. Tudo é hipótese a testar
na primeira interface; nada foi medido, e não houve pessoa real, tela, teclado nem leitor de tela.

### 9.1 O que entra no contrato (desenho recomendado)

| Origem | Ajuste |
| --- | --- |
| NUX-11 (P1) | O bloqueio do D4 tem **saída operacional rápida**: a ação principal é "Solicitar correção de classificação" (um gesto, com produto, ingrediente e motivo preenchidos, status visível, entidade `PedidoCuradoria`). Alternativas na mesma tela: "escolher outro item" e "salvar como pendente". **Inativar a restrição nunca é apresentado como saída do bloqueio**: fica separado, com aviso de que vale para todos os itens e confirmação reforçada (Q3). |
| NUX-15 (P1) | Promover resposta do questionário **não tem categoria padrão** (lactose pode ser alergia ao leite, intolerância ou preferência). Há "Promover" e "Descartar", com rastro do descarte. "Nenhuma" aparece só como informação histórica. O estado **"paciente não avaliado"** fica visível na entrada do plano e nas telas de troca, distinto de "alimento não classificado". |
| NUX-18 (P1) | Três ações com rótulo e forma distintos: **bloqueado**, **revisar** e **reconfirmar**. A revisão explícita acontece **uma vez por alvo por sessão**, com resumo no fim, sem repetir a cada troca. Medir no piloto a proporção de revisões e o tempo médio, para detectar clique automático. |
| NUX-19 (P1) | O selo **"este registro ainda não gera alerta automático confiável"** aparece também no cabeçalho do plano, na consulta de alimentos e na prévia de troca, e há uma lista de "registros sem alerta automático" com o status do `PedidoCuradoria`. |
| NUX-12 (P2) | Reconfirmar em um gesto dentro da prévia, mostrando quem confirmou e há quantos dias; um aviso por paciente e sessão; aplicar segue permitido com a marca "avaliação vencida"; a restrição já confirmada aparece distinta do "sem restrições" vencido. |
| NUX-13 (P2) | Entrada rápida de vários itens na primeira consulta, categoria escolhida **por item sem padrão que pareça confirmação**, campos secundários opcionais, "não encontrei" nunca impede salvar. |
| NUX-14 (P2) | Confirmação em lote mostra o texto original, quem registrou e quando, e a categoria proposta; itens **ambíguos ou sem alvo ficam fora da seleção padrão**; o resumo diz quantos e de que categorias. |
| NUX-16 (P2) | Fila de pendências do portal agrupada por paciente, com propostas de **remoção** priorizadas, texto do paciente e registro atual lado a lado; o portal diz que o registro confirmado continua valendo e que não é canal de urgência. |
| NUX-17 (P2) | Revisão **agrupada por receita**, decisão por ingrediente; composição informada pelo profissional é reaproveitada marcada como "informada pelo profissional, não validada". |
| NUX-20 (P2) | Lista individual primeiro, agregado como resumo; se o servidor achar diferença no aplicar, mostra **o que mudou** e preserva o rascunho. |
| PUX-11 a 14, 20 | Botão "Pedir correção" com tela de confirmação ("Pedido enviado ao seu nutricionista. O registro atual continua valendo até ele conferir."); **desfechos visíveis** ("conferiu e manteve", "conferiu e atualizou") com data; origem em linguagem simples ("anotado pela clínica; ainda será conferido"); apoio sem pressão no pedido de remoção, sem pedir justificativa clínica ao paciente. |
| PUX-15, 17 | O portal **não repete** o selo de engenharia nem mostra estado de bloqueio; **não há mensagem automática ao paciente** por causa de um bloqueio. Nenhum estado interno chega ao portal (teste de contrato). |
| PUX-18, 19, 21 | Cada restrição é um bloco com texto completo (nome, estado em texto, data), sem depender de cor; agrupamento por tipo ("Alergias", "Alimentos que você evita por escolha", "Preferências"); resumo a um toque do plano. |

### 9.2 O que depende de decisão do proprietário

- **D7-a:** o rótulo "Correção solicitada" (texto do D7) é **ambíguo** (quem pediu?). Proposta: "Você pediu uma correção". É uma alteração de um texto já decidido.
- **Q9:** quem faz a curadoria e em quanto tempo. Para uma nutricionista autônoma sem equipe, o bloqueio só é viável se a resposta for rápida (NUX-11).
- **Q10:** a reconfirmação de 180 dias exige **registrar que o paciente foi perguntado** ou basta o clique (NUX-12)?
- **Q11:** o paciente vê item registrado pela clínica antes da confirmação, vê pedido recusado ou ajustado e é avisado sobre respostas antigas do questionário (PUX-12, 14, 16)?

### 9.3 Critérios de aceite adicionais (de UX)

Cada saída do bloqueio é testada com dados sintéticos; uma sessão com 3 trocas na mesma receita pede a revisão **uma vez**; em lote sintético de 10 pendências com 2
ambíguas e 1 sem alvo, esses 3 não entram na seleção padrão e o colaborador não confirma nem por lote; promover exige escolher a categoria; o selo "sem alerta automático"
aparece nas três telas; nenhum estado interno chega ao portal. **Teclado e leitor de tela reais** antes do fechamento (etapa C).

### 9.4 Limites

Duas instâncias do runtime com o papel de `.codex/agents/*.toml` fornecido como prompt, sem ferramentas e **só com o brief**; não são independentes do coordenador, que escreveu o
brief. Sem pessoas reais, sem tela. Não é validação clínica, jurídica, de privacidade nem revisão R4.

## 10. Fatos verificados neste ciclo e o que não foi verificado

**Verificado (leitura):** papéis em `usuario-autenticado.ts`; precedente `servico-gestacoes-paciente.ts`; padrão de RLS em
`1081`; última migration `1082`; G06 BLOCKED e auto-deploy no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`; gravação do questionário sem
cifragem de aplicação; serviço de flags; texto do Anexo III (18 itens) da RDC 727/2022 na publicação original do DOU.

**Não verificado:** cifragem em repouso do provedor; texto livre do prontuário; alérgenos nas fontes TACO, USDA e IBGE; vigência atual do
Anexo III diante da revisão em curso; Lei 10.674/2003; qualquer exigência jurídica de LGPD; se o catálogo de permissões já tem
algo equivalente a "habilitado".
