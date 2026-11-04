# Planejamento pós-FOOD07 — FOOD06 e FOOD08

**Atualizado em:** 2026-10-30

**Base consultada:** `main` em `87df565f` após merge da FOOD07 #452; correção Mobile #453 em `9697bc18`.
**Estado:** planejamento documental; não autoriza implementação, merge, deploy ou migration externa.

## Objetivo e limites

Registrar uma sequência concreta para as próximas entregas alimentares, reconciliando o roadmap pós-320 com o trabalho atual de FOOD07. Esta atualização trata FOOD06 e FOOD08 como entregas separadas, cada uma sujeita a auditoria própria da `main`, decisão de produto e PR individual.

Não altera runtime, schema, catálogo, configuração do Neon/Render ou a operação da FOOD04/FOOD05 em produção. O NO-GO de TBCA continua válido. Não pressupõe licença de dados clínicos ou de conteúdo de receitas.

## Estado observado e reconciliação

- O roadmap pós-320 coloca FOOD06 (comparação com IDR/DRI/UL) e FOOD08 (biblioteca pública de receitas entre organizações) na Onda 2; FOOD06 está listado antes de FOOD07.
- A PA06 já fornece composição de micronutrientes e cálculo combinado. `docs/product/FONTES_MICRONUTRIENTES_PA06.md` registra whitelist, unidades, estados de ausência, fontes e snapshots; também afirma expressamente que IDR/DRI/UL pertencem à FOOD06. Isso cobre a base de composição, mas não a comparação com referências populacionais.
- A descrição histórica de FOOD07 como “somente gap residual da Fase 310” não representa o escopo aprovado. A FOOD07 foi integrada pela PR #452 no merge `87df565f`; o HEAD validado `7a963b16` concluiu os checks aplicáveis, com Provenance do SBOM `SKIPPED`. A PR #453 foi integrada antes no commit `9697bc18`; Mobile Expo passou no CI da #452 após sincronização com essa base.
- Merge e CI não comprovam implantação, aplicação da migration 1080 em ambientes externos ou liberação operacional. G06 segue BLOCKED; nenhuma consulta ou operação de produção foi feita nesta atualização.
- O planejamento foi atualizado em worktree própria e sincronizado com `main` no commit FOOD07. A worktree principal e alterações preexistentes nela não foram modificadas.

## Sequência recomendada

| Ordem | Trabalho | Razão | Condição para avançar |
|---|---|---|---|
| 0 | Concluir a fila de segurança/FOOD07 (#453 e #452) | Evitou planejar sobre contratos ainda em mudança e deixou a correção Mobile na base antes dos gates FOOD07. | **CONCLUÍDO**: #453 integrada em `9697bc18`; #452 integrada em `87df565f`; checks aplicáveis do HEAD FOOD07 passaram, SBOM provenance `SKIPPED`. Isso não encerra G06. |
| 1 | Planejamento e gates de FOOD06 | A PA06 fornece nutrientes, mas falta escolher e validar as referências de ingestão e UL. Fontes, direitos e populações têm maior antecedência clínica/documental. | Equipe clínica ratifica a referência/população; direitos de uso comercial ficam comprovados; contrato de dados incompletos e escopo de apresentação aprovados. |
| 2 | Planejamento e gates de FOOD08 | A biblioteca pública amplia o acervo pessoal/clínico para publicação entre organizações; precisa de contrato de publicação, atribuição, revisão e retirada. | Decisões de produto, privacidade, direitos de conteúdo e moderação aprovadas; relação com FOOD07 reconciliada na `main`. |
| Posterior | FOOD05-MDL | D18 é direção aprovada separadamente e não é pré-requisito para FOOD06/08. | Plano próprio e autorização de implementação; não iniciado neste documento. |

As personas UX discordaram sobre qual plano preparar primeiro. A persona nutricionista priorizou FOOD08 por causa das decisões de publicação e cópia; a persona paciente considerou FOOD06 mais valiosa/menos arriscada, desde que a comparação não pareça meta individual. A recomendação deste documento é tratar primeiro os gates de FOOD06, pois direitos e referências clínicas podem alongar o caminho, enquanto mantém FOOD08 documentada como a próxima entrega independente. A discordância fica preservada e não é validação clínica nem pesquisa com usuários.

## FOOD06 — comparação de ingestão com IDR/DRI/UL

### Escopo candidato

Comparar, no console profissional, os nutrientes computáveis das refeições/planos selecionados com uma referência populacional aplicável e versionada. Reutilizar os dados e totais da PA06, sem novo motor paralelo de composição. A tela descreve **valores planejados estimados**; não afirma que o paciente consumiu os alimentos. Valores ausentes continuam desconhecidos e reduzem a cobertura declarada.

Apresentar somente referências efetivamente ratificadas para a população e o nutriente. Exibir fonte, versão, faixa/população, unidade, período e cobertura dos dados. Sem contexto suficiente, referência aplicável ou composição confiável, apresentar “comparação indisponível” e o motivo. UL é referência superior quando publicada; não é diagnóstico, garantia individual de segurança nem instrução automática.

### Não incluir sem decisão própria

- Não prescrever, diagnosticar deficiência/excesso, recomendar mudança do plano nem classificar clinicamente pacientes.
- Não inferir sexo, gestação, lactação, idade ou elegibilidade por nome, aparência, conteúdo de campo livre ou valores do plano.
- Não exibir a comparação no portal do paciente nesta entrega sem decisão explícita de produto e política de compartilhamento.
- Não incluir referências ausentes, não misturar unidades/qualificadores incompatíveis, e não preencher ausências com zero.
- Não importar TBCA ou qualquer fonte cuja licença/uso comercial não esteja comprovado.

### Bloqueios antes de implementação

1. **Referência e direitos:** selecionar as tabelas oficiais e versões exatas; comprovar permissão de uso comercial, redistribuição/armazenamento e apresentação dos valores. Referência bibliográfica aberta não significa automaticamente licença de reutilização dos dados.
2. **Ratificação clínica:** aprovar populações, faixas etárias, variáveis necessárias, categorias de referência, condições fisiológicas suportadas, exceções e terminologia. Não extrapolar recomendações entre populações.
3. **Contrato de cálculo:** decidir quais totais entram (plano publicado, seleção combinada da PA06, ambos ou outro contexto), como substituir alternativas, período/unidade, cobertura mínima e cálculo de percentuais. O valor do plano deve ser rotulado como planejado, não ingerido.
4. **Experiência de apresentação:** confirmar console profissional como primeiro e único consumidor; decidir se resultados ficam por nutriente em tabela, com detalhamento da referência e lacunas. Sem cores/alertas que pareçam diagnóstico.
5. **Governança/versionamento:** determinar como uma atualização de tabela cria nova versão e como avaliações/snapshots antigos mantêm seus resultados reproduzíveis.

### Critérios propostos de aceite

- Para cada referência, testes de tabela/versão conferem unidades, limites e valores de borda contra uma fonte independente antes do uso.
- Totais são reusados da PA06; testes provam que seleção vazia, itens desligados, substituições e nutrientes incompletos não criam total falso ou ingestão presumida.
- Cada resultado identifica referência/população/versão/unidade/período e cobertura; sem entrada ou tabela aplicável, o resultado fica indisponível com motivo explícito.
- Retificação de cadastro ou nova versão da referência não altera snapshots anteriores; reprodução histórica usa os dados congelados.
- Testes cobrem tenant, profissional, paciente, acesso revogado, projeções e RLS se persistência exigir mudanças; nenhuma nova saída clínica aparece no portal sem consentimento/contrato específico.
- Revisão R4, regressões PA06/FOOD07, acessibilidade e CI correspondentes passam antes de recomendar integração.

### Repositórios e referências

O catálogo aponta R015 (SDK Open Food Facts) e utilitários genéricos de teste/mutação (R056/R057/R076). Nenhum deles é fonte de referência dietética ou substitui validação das tabelas. Não recomendo adicioná-los para FOOD06: a PA06 já oferece contratos de nutrientes e a precisão deve ser tratada com primitives existentes, salvo prova concreta de lacuna. O trabalho de fonte clínica deve consultar publicações oficiais e seus direitos, não repositório de software.

## FOOD08 — biblioteca pública de receitas entre organizações

### Escopo candidato

Extensão explícita da biblioteca FOOD07/310 para compartilhar receitas entre organizações por publicação voluntária, autoria/versão, tags e favoritos, com cópia para a biblioteca própria. Quem recebe não edita a receita pública da autora. A cópia é independente e a publicação/atualização não altera planos ou envios anteriores.

Publicar apenas uma projeção allowlist de conteúdo da receita, sem tenant/paciente, plano, consulta, instrução individual, consentimento, notas internas ou identificadores derivados. A autorização para consultar uma receita pública não concede acesso ao paciente que participou da criação da receita. A função é para reutilização profissional; inclusão no plano e envio ao paciente seguem as confirmações e snapshots existentes.

### Bloqueios antes de implementação

1. **Quem pode publicar:** profissional individual, clínica ou ambos; quem administra/tira do ar conteúdo de autoria de pessoa que saiu da clínica.
2. **Audiência e identidade:** se o catálogo é globalmente público e acessível sem login ou apenas compartilhado entre organizações autenticadas; quais dados de autoria aparecem; possibilidade de publicação sem nome pessoal.
3. **Direitos do conteúdo:** titularidade/licença concedida pelo autor; atribuição exigida; retirada, denúncia, contestação, infração autoral e direitos sobre textos/fotos. Direitos de software dos repositórios avaliados não cobrem conteúdo de receitas.
4. **Moderação e responsabilidade:** publicação imediata com denúncia posterior ou fila de revisão; papéis, prazos, estados, critérios e auditoria. Não usar “validada”/“segura” sem protocolo definido.
5. **Campos e mídias:** campos permitidos na publicação; se imagem fica fora do MVP; tratamento de texto livre, instruções, nome de arquivo e metadados para evitar exposição incidental.
6. **Despublicação e cópias:** efeito da retirada sobre busca/links e cópias já feitas; rastreabilidade da versão de origem, sem sincronizar alterações ou reexpor dados do autor.
7. **Paciente:** confirmar se o acervo público é apenas para profissionais no início. Recomendação: não incluir busca pública no portal nem compartilhamento automático ao paciente nesta entrega.

### Critérios propostos de aceite

- Publicar requer ação explícita, prévia dos campos públicos e confirmação do responsável; a interface distingue rascunho, em revisão, publicado, denunciado e retirado.
- Um scanner de projeção/testes de canário prova que nenhum ID de paciente, tenant de origem, plano, observação, contexto cifrado, token, URL privada ou metadado de arquivo chega às respostas públicas, cache, URL ou auditoria.
- Revisão da autorização inclui tentativas cross-tenant, autor sem acesso, clínica desativada, usuário desligado, revogação e links antigos após retirada.
- Cópia cria ID/snapshot próprio com proveniência pública mínima (origem e revisão), sem atualizar com mudanças da origem; usuário não pode alterar objeto de outro autor.
- Denúncia e retirada possuem estado verificável, trilha sem conteúdo clínico, critérios de retenção e comportamento de busca/cache definidos.
- Testes validam licença/atribuição do conteúdo fornecido pelo usuário, acessibilidade e UX mobile. O fluxo de publicação não inventa alergênicos, adequação clínica ou equivalência nutricional.

### Repositórios avaliados (somente os candidatos desta fase)

| Referência | Constatação desta consulta | Decisão de planejamento |
|---|---|---|
| R015 `openfoodfacts/openfoodfacts-js` | Repositório do SDK API de produtos, Apache-2.0; não oferece a biblioteca pública de receitas proposta. | Não instalar como dependência; não usar a API de alimentos para transportar receitas clínicas. |
| R018 `TandoorRecipes/recipes` | Gerenciador de receitas com colaboração/tags; README declara AGPLv3 com Commons Clause selling exception. O caminho `LICENSE` não existe; README aponta `LICENSE.md`. | Referência de UX/fluxo apenas; não copiar código sem análise jurídica específica. Licença do conteúdo é questão separada. |
| R042 `openfoodfacts/openfoodfacts-server` | Product Opener/servidor Open Food Facts sob AGPL-3.0; stack e domínio são distantes do recurso de biblioteca profissional do OctaClin. | Não adotar dependência nem código; pouco ganho arquitetural para a entrega. |

Nenhum dos três foi clonado, executado ou incorporado. Os metadados de licença observados no repositório não resolvem licença, autoria ou redistribuição do conteúdo publicado por terceiros.

## Relatório das avaliações de produto

As duas revisões foram instâncias separadas dos papéis de UX aprovados, sem ferramentas sobre dados reais. Nenhuma pessoa real participou; não houve protótipo ou teste de interface.

| ID | Origem | Hipótese de fricção/risco | Prioridade | Proposta e aceite verificável |
|---|---|---|---|---|
| UX-FOOD06-01 | Nutricionista | Total parcial por micronutrientes pode ser confundido com baixo consumo quando faltam dados de alimentos. | P1 | Mostrar cobertura e motivo de indeterminação por nutriente; não tratar ausência como zero. |
| UX-FOOD06-02 | Nutricionista e paciente | Referência errada/sem contexto pode parecer uma meta individual; UL pode ser lido como diagnóstico. | P1 | População, fonte, versão e unidade visíveis; explicar siglas; não comparar sem elegibilidade/contexto aprovado. |
| UX-FOOD06-03 | Paciente | Um valor de ingestão planejada pode ser entendido como consumo real ou recomendação. | P1 | Recomendar console profissional primeiro; se houver tela de paciente futura, separar planejado/consumido e explicitar que não é diagnóstico. |
| UX-FOOD08-01 | Nutricionista e paciente | Texto livre/imagem pode identificar paciente ou parecer revisão clínica. | P1 | Allowlist, prévia pública e decisão de moderação; sem rótulo de segurança/adequação clínica sem fonte. |
| UX-FOOD08-02 | Nutricionista | Cópia pode perder versão/autoria, e mudanças originais podem parecer atualizar a receita aplicada. | P2 | Nova cópia independente, origem/revisão indicada, sem sincronização; aplicações enviadas continuam snapshots. |
| UX-FOOD08-03 | Paciente | Receita pública acessada fora do contexto do profissional pode parecer indicada ou segura para restrições individuais. | P1 | Manter catálogo no console inicialmente; envio ao paciente continua fluxo separado e explícito. |

Estas prioridades são hipóteses de produto. P0 fica reservado a risco grave comprovado; nenhum P0 foi identificado nesta revisão documental.

## Decisões que exigem resposta humana antes da implementação

### FOOD06 — clínica/produto/direitos

- Qual conjunto oficial de referência deve ser adotado e qual prova de uso comercial/redistribuição cobre armazenamento e exibição?
- Quais faixas/populações e condições fisiológicas entram na primeira versão? Quais dados serão confirmados por profissional e quais ausências impedem cálculo?
- A comparação usa plano publicado, seleção combinada de planos, ou ambos? A tela permanece restrita ao console profissional inicialmente?
- Como a equipe clínica quer apresentar diferença, percentuais e UL sem linguagem de diagnóstico ou recomendação?

### FOOD08 — produto/operação/direitos

- A publicação é por profissional, por clínica ou ambas? A autoria é pública, opcional ou pseudônima?
- O catálogo exige login profissional ou é público sem autenticação?
- Publicação passa por pré-moderação, denúncia com retirada posterior, ou outro fluxo? Quem responde por moderação e contestação?
- Qual licença/autorização o publicador concede para armazenamento, exibição, cópia e atribuição? Qual processo remove conteúdo e resolve alegações de direitos?
- A primeira versão será somente profissional, sem busca no portal? Recomendação registrada: sim.

As perguntas não ratificam decisões clínicas ou legais. A equipe correspondente precisa confirmar as regras e os direitos antes de qualquer componente assistencial ou publicação externa.

## Gates e próximos passos

| Gate | Estado | Condição de saída |
|---|---|---|
| FOOD06-G1 Fontes/direitos | BLOCKED | Referências/versionamento identificados e direitos documentados para uso comercial pretendido. |
| FOOD06-G2 Clínica/população | BLOCKED | Ratificação humana da população, variáveis, exceções, limites, terminologia e fonte. |
| FOOD06-G3 Contrato de dados | BLOCKED | Escopo planejado-versus-consumido, cobertura, seleção de planos, snapshot e projeções aprovados. |
| FOOD08-G1 Publicação/direitos | BLOCKED | Público, autoria, licença, remoção e atribuição formalmente definidos. |
| FOOD08-G2 Privacidade/moderação | BLOCKED | Allowlist e fluxo de revisão/denúncia/retirada aprovados e testáveis. |
| FOOD08-G3 Arquitetura | NOT RUN | Auditoria do modelo atual FOOD07 integrado, fluxos 310 e capacidade de versionamento após a #452. |
| FOOD07/#452 e correção Mobile/#453 | INTEGRADAS | Evidência do HEAD `7a963b16`: checks aplicáveis concluídos com sucesso; SBOM provenance `SKIPPED`. Produção/migration 1080 não inferidas. |
| G06 FOOD04/FOOD07 | BLOCKED operacional | Após o retorno do proprietário, verificar Neon, schema/ledger 1078/1080, Render, backup/rollback e sequência operacional sob autorização específica. |

1. Auditar FOOD06 contra a implementação atual da PA06 e fechar a ficha de fontes/direitos/populações antes de qualquer implementação.
2. Resolver decisões humanas de produto, conteúdo/direitos, privacidade e moderação de FOOD08; depois auditar os contratos da FOOD07 integrada.
3. Manter a migration 1080 e G06 fora de operações externas até regularização e autorização operacional específicas.
4. Só iniciar FOOD06 ou FOOD08 quando seus gates humanos correspondentes e autorização explícita de implementação estiverem registrados.

## Limitações desta rodada

- Não houve revisão adicional do runtime, auditoria de migrações em bancos externos ou consulta ao estado operacional de produção. Os metadados do merge e checks FOOD07 foram lidos no GitHub; nenhuma implantação é inferida.
- A leitura documental foi reconciliada com `main` em `87df565f`; mudanças de código incluídas pela atualização da base vêm do merge FOOD07 já integrado, não desta PR documental.
- Não foram executados testes de software, testes clínicos, testes com profissionais/pacientes ou testes de acessibilidade de interface.
- A licença de dados alimentares e referências clínicas precisa ser conferida separadamente da licença de código aberto.
- Esta proposta não muda G06, produção FOOD04/FOOD05 ou o NO-GO da TBCA.
