# Plano e análise de gaps — Fase 313: acompanhamento gestacional

Planejamento e execução em 2026-10-10; implementação em validação. Risco da implementação: R4.
Branch: `feature/fase-313-antropometria-gestantes`.
Base: `774cf34fab2e9cd26e888e57fbaabfe14295930e` (PR #390).
Handoff: [tasks/plan.md](../../../tasks/plan.md).
Tarefas: [todo-fase-313.md](../../../tasks/todo-fase-313.md).
Ficha clínica: [FICHA_VALIDACAO_CLINICA_FASE_313.md](../../product/FICHA_VALIDACAO_CLINICA_FASE_313.md).

## 1. Escopo confirmado pelo proprietário

1. Curvas brasileiras adotadas pelo Ministério da Saúde: IMC de referência
   pré-gestacional e ganho acumulado por semana. Não usar IMC atual/Atalah.
2. Classificação somente com idade >=18 anos na data da avaliação, gestação
   de feto único e risco habitual confirmado. Adolescência, múltipla, alto
   risco, risco desconhecido e dados incompletos permitem medidas, sem classificação.
3. Novos registros gestantes não recebem interpretações adultas de IMC atual,
   cintura/RCQ nem estimativas de gordura/massa gorda/massa magra. Medidas
   brutas e RCQ factual podem permanecer; resultados antigos são preservados.
4. Peso de referência pré-gestacional medido ou informado; se ausente, aceitar
   medida até oito semanas, com origem explícita. Após o parecer, proprietário
   incluiu também peso habitual como origem própria. Limites/uso na ficha.
5. Confirmar condição por avaliação, sugerida pelo cadastro; divergência pede
   confirmação. Não alterar o cadastro por efeito colateral.
6. Entregar avaliação e histórico profissional, gráfico por gestação e portal.
7. Profissional abre/encerra gestações; vínculo das avaliações é explícito.
8. Compartilhamento desligado por padrão, liberação explícita por gestação,
   com confirmação de inclusão das avaliações atuais e futuras. Sem notas internas.
9. Paciente dá aceite específico, inicialmente desligado, e pode revogá-lo.
10. Correção do peso/altura de referência cria nova versão para próximos
    registros. Avaliações preservam a cópia original; gráfico separa séries.
11. Encerramento bloqueia novas avaliações/referências no episódio, preserva
    histórico e compartilhamento autorizado. Reabertura explícita, confirmada e auditada.
12. Proprietário/equipe clínica ratificaram a ficha atualizada em 2026-10-10: “Ficha revisada; equipe/responsável ratifica todas as regras”.

Parecer recebido e preservado em [PARECER_REVISAO_FASE_313.md](../../product/PARECER_REVISAO_FASE_313.md),
SHA-256 do anexo original `73e2c7a28e74b1a38c3a9bd87afa80ae696b62c0f55daa29427949fc7cb27b3c`.
Cópia no repositório tem apenas espaços finais normalizados para o gate de diff.
O parecer relata transcrição conferida sem divergências e, naquele momento, aprovação clínica pendente. Depois, o proprietário aprovou peso habitual como origem própria e ratificou a ficha atualizada, incluindo essa origem e todas as bordas técnicas. G01/G02 concluídos; implementação autorizada no GPT-6.1 Sol médio. A ratificação veio do proprietário/equipe; este agente não realizou revisão clínica independente.

## 2. Reconciliação da fase anterior

- PR #390 mergeado em 2026-10-10; SHA `774cf34fab2e9cd26e888e57fbaabfe14295930e`,
  confirmado no GitHub e por `git fetch origin main` neste ciclo.
- CI final da PR `38049949959`: todos os dez jobs retornaram SUCCESS, incluindo
  Backend, Web, Governança, Demo local smoke e PR Gate.
- CI pós-merge `38052856367`: SUCCESS. Scanners pós-merge Semgrep
  `38052856349`, Trivy `38052856362` e CodeQL `38052856379`: SUCCESS.
- O proprietário informou migrations aplicadas e validadas em staging e
  produção. Para a Fase 312, a migration nova é a 1067. Não houve consulta
  direta ao banco, nova aplicação, deploy ou validação do aplicativo produtivo
  neste planejamento; não atribuir esse relato às migrations de outras fases.
- Atestados continuam aguardando validação específica, conforme decisão da 312.
  As limitações históricas de testes e revisão independente da 312 permanecem
  documentadas, sem transformar merge em prova das propriedades não ensaiadas.
- Monitor de produção `38065380981`, execução de 2026-10-10T15:52:39Z: FAIL no
  passo “Verificar backend, dependencias e web”; log às 15:53:34Z registrou
  HTTP 503 após três tentativas. Causa não determinada. Última execução
  anterior com sucesso: `38043058328`. Esse fato exige diagnóstico operacional
  antes de afirmar saúde de produção; não demonstra causa no PR #390.

## 3. Fonte clínica e gate

A ficha concentra tabela semanal, fórmulas, origem, discrepâncias, exemplos e
itens de aceite. Material UFRJ V3 baixado somente para análise pública em `/tmp`:
SHA-256 `180888b53b2d34bfa5cb20548caa66303d2dd03f4349d038787b93f3d8a213f4`;
MD5 publicado `5ee94e716e115e9ebb6387a121ec78e3`, publicado em 2024-06-21,
CC0 com atribuição científica. Não incorporar código de calculadoras externas.
O guia semanal foi lido e conferido visualmente; download direto retornou 403,
portanto seu checksum não foi obtido. A seção pertinente da caderneta atual
oficial foi acessada; não declarar revisão integral do PDF de 108 páginas.

Runtime offline, fonte e versão fixadas no backend. Nenhum dado de paciente
vai para UFRJ/MS ou outras ferramentas. Não inserir no runtime a tabela até
validar a ficha, inclusive divergências de semana 13, oito semanas e arredondamento.

## 4. Gaps observados no código

| Gap | Evidência | Trabalho necessário |
| --- | --- | --- |
| Sem dados de gestação no DTO | `CriarAvaliacaoAntropometricaDto`, `octaclin-backend/src/modulos/pacientes/aplicacao/dtos.ts` | Contexto aninhado validado, limites e campos opcionais para registros incompletos |
| Bloqueio de IMC depende do cadastro atual | `registrarAvaliacaoAntropometrica`, `servico-pacientes.ts`: perfil cifrado -> `gestante` | Confirmar condição por avaliação e gravar a condição efetivamente usada |
| Condição gestacional não preservada | JSON cifrado contém medidas; resultado sem contexto gestacional | Snapshot cifrado de condição, origem, idade gestacional e referência |
| Sem classificador gestacional | `dominio/antropometria.ts`: calcula IMC e omite faixa se gestante | Módulo puro próprio com dados e referência versionados |
| RCQ/cintura e composição ainda adultas | `calcularAntropometria` aplica esses cálculos independentemente de `gestante` | Bloquear classificações de RCQ/cintura e estimativas de gordura/massas, com avisos; preservar valores medidos e RCQ factual |
| UI só avisa que falta semana | `octaclin-web/components/pacientes/aba-antropometria.tsx` | Campos gestacionais, estado sem classificação e resultados com fonte no histórico |
| Prévia Web duplica classificação adulta | `classePrevia` na mesma aba | Manter o servidor autoritativo; não duplicar nova tabela clínica na Web |
| Formulário/requisições podem sobreviver à troca de paciente | `salvar`, `comparar`, carregamento do perfil na mesma aba | Limpar contexto e descartar resposta atrasada; validar o teste por troca de paciente |
| BFF antropometria não declara cache privado | `octaclin-web/app/api/pacientes/[id]/avaliacoes-antropometricas/route.ts` | Permissão por método, `private, no-store` inclusive erros, origem de mutação e teste de contrato |
| Histórico lê JSON genericamente | `mapearAvaliacaoAntropometrica` -> `lerJsonCriptografado` | Projetar apenas novo contexto autorizado; preservar registro antigo e motivo de ilegibilidade |
| Portal não tem métrica gestacional | Allowlist de `dominio/progresso-paciente.ts` | Criar contrato separado por gestação com dupla autorização; não ampliar a allowlist genérica |
| Comparação genérica pode misturar gestações | `listarAvaliacoesAntropometricas` compara duas avaliações | Não adicionar deltas gestacionais automaticamente; gráfico/episódio exigem contrato próprio |
| Mocks antigos de perfil não representam gestação | `servico-pacientes.spec.ts`, Playwright e API demo | Fixtures sintéticas separadas por perfil, avaliação e data; preservar smoke completo |

Gaps adicionais introduzidos pelo escopo aprovado:

| Lacuna | Contrato necessário |
| --- | --- |
| Ausência de episódios de gestação | Persistência própria, ciclo abrir/encerrar/reabrir, tenant/paciente e carteira |
| Referência corrigível sem modelo de versão | Versão imutável com snapshot por avaliação e controle de concorrência |
| Gráfico existente usa datas e métricas adultas | Eixo gestacional, séries por episódio/versão, tabela acessível e limites visíveis |
| Portal resume últimas 24 avaliações e não tem aceite gestacional | Endpoint próprio, paginação por episódio e autorização/consentimento em cada leitura |
| Leitura atual limita 100 avaliações de todo o paciente | Não usar essa janela para afirmar cobertura completa de uma gestação |
| RLS não cobre tabelas ainda inexistentes | Migration aditiva, FKs compostas, FORCE RLS e prova PostgreSQL com role não owner |

## 5. Modelo de persistência e segurança

Proposta de migration `1720000001068-AcompanhamentoGestacional.ts`: número
livre no checkout observado; reconfirmar no início da implementação. Registrar
em `src/infraestrutura/banco-dados/opcoes-typeorm.ts`, módulos e inventário do
procedimento fora de banda. Nenhuma execução de migration nesta tarefa.

### Episódio e referência

- `gestacoes_pacientes`: UUID, tenant/paciente, status `ativa|encerrada`, versão
  de concorrência, autoria/timestamps, liberação do profissional e geração do
  compartilhamento. Datas/observações clínicas, quando necessárias, cifradas.
- `referencias_gestacao`: UUID, tenant/paciente/gestação, número sequencial,
  autoria/timestamp, contexto cifrado (peso, altura, origem, idade da medida
  substituta, data do peso quando conhecida ou ausência explícita, unidade e
  precisão). Origens: `pre_gestacional_medido|pre_gestacional_informado|inicio_gestacao_medido|peso_habitual_informado`.
  Peso habitual exige confirmação do profissional de que representa valor
  anterior à gestação, sem inferência pelo peso atual nem substituição automática
  de baseline conhecido. Confirmar uso na ficha. Uma versão pode ser incompleta; isso impede classificação,
  não o registro factual. Não herdar silenciosamente peso de avaliação atual.
- `consentimentos_gestacao`: UUID, tenant/paciente/gestação/usuário vinculado,
  geração da liberação, versão do termo, aceite/revogação e timestamps.
  Consentimento não é herdado por outro usuário nem por nova liberação após retirada.
- Referências não são alteradas/apagadas pelo runtime. Número sequencial gerado
  sob lock do episódio, com unique composto. Contexto de risco/tipo é confirmado
  em cada avaliação e preservado nela; alterações não reclassificam o histórico.
- Avaliações existentes ganham `gestacao_id` e `gestacao_referencia_numero`
  nullable em conjunto, FK composta para a referência do mesmo tenant/paciente.
  Índices de leitura por episódio/data/ID. Sem backfill ou vínculo deduzido.
- FKs entre as três tabelas incluem tenant e paciente. FORCE RLS e política
  da identidade runtime conforme padrão existente; tenant sempre do servidor.
  Consentimento e status não são autorização por si só: serviço revalida carteira
  e vínculo do paciente. Metadados identificadores permanecem protegidos.
- Trigger protege o snapshot clínico das avaliações com vínculo novo; permite
  somente metadados de exclusão/compartilhamento já autorizados. Trigger de
  referência imutável impede UPDATE/DELETE runtime; não bloquear rollout owner.

Não impor episódio único ativo sem requisito do proprietário: seleção explícita
é obrigatória mesmo se houver vários. Não criar automaticamente gestações nem
inferir datas por peso, DUM ou alteração do cadastro.

### Transações e concorrência

Reusar `ExecutorTenant`, criptografia e autorização de paciente existente.
Se extrair `garantirPacienteExiste` para helper compartilhado, manter carteira,
profissional ativo, paciente não arquivado, tenant explícito e testes negativos.
Não copiar exclusividade de emissão do encaminhamento da 312: antropometria
continua com os papéis/permissões atuais do módulo.

Ordem uniforme: paciente (quando exigir lock de vínculo), episódio, referência/
consentimento. Gravação, publicação, encerramento, reabertura, revogação e
criação de referência usam transação e versão esperada; conflito retorna 409.
A confirmação do registro envia número esperado da referência: mudança desde
abertura do formulário pede nova conferência, nunca troca a base silenciosamente.
A consulta de referência sempre usa tenant+paciente+episódio+versão.

Criação do episódio e da avaliação usa chave UUID de confirmação: repetição
idêntica devolve o mesmo recurso; chave com corpo diferente retorna 409. Revalidar
identidade/carteira antes de replay. Armazenar fingerprint apenas cifrado; não
consultar após `23505` em transação abortada. Provar replay no serviço real.

## 6. Contratos de entrada e resposta

### Contexto por avaliação

Estender `CriarAvaliacaoAntropometricaDto` e `lib/prontuario-api.ts` de forma
aditiva: `condicaoGestacional: gestante|nao_gestante`, confirmação de divergência
quando necessário, e `gestacao` opcional com UUID do episódio, número esperado
positivo, semanas inteiras 0–45, dias 0–6, `tipo: unica|multipla|nao_informada`,
`risco: habitual|alto|nao_informado`. Dias sem semanas são inválidos. Intervalo
aceito de captura não é intervalo de aplicabilidade da curva.

Adicionar `origemIdadeGestacional: pre_natal|ultrassonografia|dum|nao_informada`,
`dataFonteIdadeGestacional` opcional e `idadeGestacionalInconsistente` booleano
confirmado pelo profissional. IG sempre referente a `dataAvaliacao`; preservar
origem/data cifradas. Nenhuma derivação automática por DUM/USG ou relógio atual.
Data da fonte futura/semana ou dia inválido rejeitados; falta/origem desconhecida/
inconsistência permite medidas sem classificação. Alterar data do formulário
invalida a confirmação e exige nova IG correspondente. Não inferir inconsistência
entre gestações diferentes. Estes detalhes foram ratificados na ficha.

Plausibilidade de IMC 8–100 é proteção técnica herdada de `LIMITES.imc`, não
corte clínico publicado; motivo próprio `referencia_fora_plausibilidade_tecnica`.
Ratificar seu uso na referência. Capturar unidade/precisão sem arredondar para
comparar; não alterar retroativamente valores antigos nem limites não gestantes.

Avaliação gestante pode salvar medidas sem episódio/dados completos, com motivo
visível; não recebe classificação gestacional e não é incluída automaticamente
no gráfico/portal. Para acompanhamento completo, UI exige escolha explícita do
episódio. Não gestante com objeto gestacional é inválido. Datas civis precisam
ser válidas no calendário, não apenas corresponder à regex; idade vem do cadastro
no backend na data da avaliação, nunca de um número enviado pelo navegador.

Cliente antigo sem condição explícita continua usando sugestão do perfil, com
origem `perfil_legado` registrada nos novos snapshots. Perfil desconhecido não
vira não gestante explicitamente confirmada. História anterior sem contexto
permanece `legado`, sem reclassificação ou vínculo automático.

Resultado cifrado adiciona `gestacional` com `source_id` e `algorithm_version`
(com nomes equivalentes nos tipos TypeScript, mapeamento explícito), condição/origem,
unidade/precisão, origem/data da IG, consistência e dados efetivamente
usados, fonte/versão de algoritmo, versão da referência, IMC de referência/grupo,
ganho, semana informada e semana da curva, faixa, classificação e motivos de
não classificação. Não usar `protocolo` de composição como versão gestacional.
`formulaAplicada` em claro recebe só nome público da fórmula, nunca valores.
DTO de histórico projeta apenas campos aprovados; não expor entidade ORM crua.

### Rotas propostas (prefixo global existente preservado)

| Método/recurso | Contrato |
| --- | --- |
| GET/POST `pacientes/:id/gestacoes` | Listar/abrir sob ler/gerenciar; POST confirmado + UUID; resposta mínima |
| GET `pacientes/:id/gestacoes/:gestacaoId` | Detalhe e avaliações paginadas, autoriza paciente antes do episódio |
| POST `.../:gestacaoId/referencias` | Nova versão, versão esperada, contexto e confirmação; episódio ativo |
| POST `.../:gestacaoId/encerrar` ou `/reabrir` | Confirmação/versão; encerramento não retira compartilhamento |
| PUT `.../:gestacaoId/compartilhamento` | Booleano, versão e confirmação de conteúdo atual/futuro; liberação cria geração |
| POST avaliação existente | Contexto novo; mesma transação/snapshot, episódio ativo quando vinculado |
| GET `portal-paciente/gestacoes` | Resolver paciente por tenant+usuarioId+não arquivado, sem paciente arbitrário |
| GET `portal-paciente/gestacoes/:gestacaoId` | Dados clínicos só com liberação+aceite vigente+vínculo atual |
| PUT `portal-paciente/gestacoes/:gestacaoId/consentimento` | Aceitar/revogar pelo próprio usuário, termo/geração/versão esperados |

Aplicar os prefixos reais do controlador de portal existente na implementação;
a tabela nomeia recursos lógicos, não autoriza criar segundo fluxo de identidade.
Convite antes do aceite contém apenas mensagem genérica, ID opaco necessário e
versão do termo; nenhum peso, semana, gráfico, classificação ou nota.

Paginação: episódios 20/página, teto 50; avaliações 100/página com cursor estável
(data, criação, ID), sempre restrito ao episódio. Cursor não autoriza nem contém
medidas. UI mostra cobertura e “carregar mais”; gráfico usa somente as páginas
carregadas e não se anuncia completo até o fim. Não truncar sem aviso. Avaliações
excluídas ficam fora. JSON ilegível não vira zero nem classificação, indica lacuna.

## 7. Gráfico, histórico e portal

- Novo componente compartilhado de gráfico/tabela recebe DTO já calculado pelo
  backend; nenhum cálculo clínico/tabela de faixas duplicado no browser.
- Eixo X: idade gestacional informada (semanas+dias/7), tooltip/tabela mostram
  também semana da curva. Faixa semanal discreta; não interpolar classificação.
- Filtro explícito de episódio e versão da referência; não conectar pontos de
  bases diferentes. Pontos duplicados na mesma semana permanecem visíveis.
  Registros sem base/sem idade ficam na tabela, sem pontos inventados.
- Histórico conserva sua fonte e baseline originais. Não incorporar ganho
  gestacional aos deltas genéricos ou resumir gestações diferentes numa série.
- Portal usa allowlist: data da avaliação, idade gestacional, peso/altura usados,
  referência/origem, ganho, faixa, classificação, fonte e motivos compreensíveis.
  Sem notas, autor, consulta, formulários internos ou blobs cifrados.
- Leitura clínica requer liberação atual do profissional E aceite específico
  atual do paciente. Desligar qualquer um oculta todas as páginas seguintes e
  detalhe. Cada request revalida vínculo/termo/geração; nenhuma URL é capability.
- Revogação/retirada válida no servidor imediatamente após commit; UI apaga o
  estado na ação e verifica ao recuperar foco. Não prometer recolher dados já
  vistos nem invalidar resposta já transmitida. Responses clínicas `private,
  no-store`, sem Cache Storage/localStorage/telemetria; descartar requests antigos.
- Encerrar não revoga. Retirar e depois liberar novamente exige novo aceite,
  exibindo claramente quais registros atuais/futuros passam a ser acessíveis.
- UI desktop/mobile, teclado, foco, tabela equivalente ao gráfico, texto além
  de cores, estados de erro/sem dados/não aplicável e paginação visível.
- Preservar medidas brutas de cintura/dobras, mesmo com cálculo adulto bloqueado.
  RCQ factual visível como razão sem faixa/risco; nenhuma interpretação, alerta
  automatizado ou gatilho derivado de gordura/RCQ adulto em novos registros gestantes.
  Limpar formulário, referência, perfil e séries ao mudar paciente/episódio;
  resposta atrasada não publica conteúdo do contexto anterior.

## 8. Validação e entrega

[Checklist executável](../../../tasks/todo-fase-313.md) define dependências,
arquivos e aceites. Nomes de arquivos novos ali são planejados, não evidência.
Usar Node 22/pnpm 11.25.0 dos manifests; não modificar lockfile para contornar
ambiente. Ler guias Next instalados antes de alterações Web.

Gates de implementação: ficha clínica validada; Jest positivo/negativo por
contrato; PG real sob runtime não owner (RLS, FKs, imutabilidade, idempotência,
concorrência referência/encerramento/transferência/consentimento); BFF authz/cache/
origem; visual desktop/mobile e axe; smoke demo com endpoints/fixtures novos;
build/typecheck/lint; governança e CI da única PR de implementação; revisão R4
independente quando viável, registrando se não foi independente.

Não aplicar migration em staging/produção com autorização apenas de planejar.
Rollout futuro: confirmar alvo e role owner, ensaiar migration em descartável,
aplicar fora de banda conforme runbook, verificar policies/registro/schema e
então liberar writer/portal. Runtime sem privilégio permanente adicional.

Rollback de aplicação preserva leitura de snapshots e bloqueios de interpretação
adulta em gestantes. Pode suspender criação/classificador/liberação, mantendo
histórico cifrado. Schema aditivo permanece; `down` recusa se existirem episódios,
referências, consentimentos ou avaliações vinculadas. Não apagar dados clínicos
para permitir downgrade; correção por migration futura se necessário. Provar
rollback vazio e recusa com linhas em PG descartável.

Leitura de contratos/Git/CI PASS; regras clínicas ratificadas; implementação e evidências em andamento. Resultados executados serão consolidados no relatório de execução da fase. Revisão R4 independente SKIPPED: não há segundo revisor neste ciclo. Monitor de produção FAIL observado
na seção 2 é pendência operacional separada; não declarar saúde produtiva.

## 9. Modelo e próxima ação

Manter GPT-6.1 Sol médio para implementação completa: episódios, versionamento,
concorrência, RLS, consentimento e projeções clínicas atravessam contratos R4.
GPT-6 Luna alto basta para tarefas menores já delimitadas (componentes visuais,
fixtures e textos) depois que contratos estiverem implementados e aprovados.
Não trocar automaticamente; avisar o modelo desejado e pausar antes da troca.

Próxima ação exata: proprietário/equipe clínica revisar a ficha e confirmar
fonte semanal, divergências e regras de dias; após esse aceite e autorização
para implementar, iniciar T01 no checklist, na mesma branch. Sem PR documental
isolada. Preservar gates residuais da 312 em seu checklist histórico.


## 10. Organização efetiva da implementação

O serviço de episódios também concentra as projeções e o consentimento, mantendo
uma única ordem de locks paciente/episódio. Não foram criados os arquivos
hipotéticos `acompanhamento-gestacional.ts` ou `servico-portal-gestacoes.ts`.
Contratos/guardas/DTOs estão em `gestacoes-contratos.spec.ts`; provas reais de
serviços, FKs, replay e concorrência entram no harness RLS já registrado no CI.
O portal usa o prefixo existente `/portal/paciente/gestacoes`. O teste profissional
reusa os mocks de prontuário em `console-regression.spec.mjs`; o spec dedicado da
313 cobre o portal. Ambos entram em `smoke:visual`, nos dois projects.

Evidência consolidada: [EXECUCAO_FASE_313.md](EXECUCAO_FASE_313.md).
