# OctaClin — Ciclo 2: login, cadastro, formulários e operação profissional

Documento único de planejamento prévio de vinte entregas propostas: dez originais e dez complementares.

- Data: 25/11/2026.
- Estado: execução controlada autorizada pelo proprietário em 25/11/2026; decisões específicas abaixo prevalecem sobre recomendações históricas.
- Repositório: `octanutri-clin/octaclin`.
- Público: proprietário, engenharia, QA, segurança e revisores de experiência.
- Este documento é o planejamento; a execução e suas evidências ficam em [execucao-ciclo2.md](execucao-ciclo2.md). Correções de PRs existentes são tarefas separadas.
- Modelo recomendado: Sol médio para documentação e interface delimitada; Sol alto para contratos, autorização, concorrência, persistência e regras condicionais. Não há troca automática de modelo.

## 1. Como usar este planejamento

### Decisões vigentes e limites

O proprietário autorizou desenvolver as implementações do segundo ciclo, em PRs
funcionais separadas, sem merge automático, deploy ou migrations externas.
Ratificou explicitamente F08 (blocos pessoais primeiro, cópias independentes),
F09 (conteúdo oculto preservado no rascunho autorizado e excluído do envio efetivo;
histórico “Não aplicável”) e F20 (ICS para profissional e paciente autorizados,
título genérico/data/horário, sem dados clínicos/nome/sincronização).

As menções a propostas e decisões pendentes abaixo preservam o planejamento
anterior. As três ratificações acima as substituem nos pontos correspondentes.
Novas decisões materiais não contempladas devem voltar ao proprietário. F01/F02
podem executar os detalhes reversíveis já previstos sem nova rodada de aprovação.

Base efetiva da execução: `0fd46a01`. #585–#592 foram mergeadas nas branches
predecessoras; não foram integradas à main nesse checkpoint. Fases consumidoras
exigem reconciliação explícita da cadeia. Não confundir MERGED com disponível.

Este documento reúne objetivos, contratos propostos, decisões pendentes, fases técnicas, commits previstos, testes e critérios de conclusão. As seções 1–21 preservam o pacote original; as seções 22–35 acrescentam dez propostas operacionais, sem iniciar sua implementação. Ele permite aprovar o ciclo inteiro ou somente fases específicas.

Não significa que todas as propostas sejam lacunas integralmente comprovadas. A inspeção anterior foi dirigida a componentes e documentos; não foi uma auditoria completa de autenticação, cadastro e formulários. Cada fase começa conferindo a base real e identificando exatamente o que falta.

As decisões marcadas como recomendação ainda não foram ratificadas. Detalhes de engenharia reversíveis podem ser resolvidos dentro do escopo posteriormente autorizado; mudança de comportamento de produto, acesso, dados sensíveis ou contrato incompatível deve voltar ao proprietário.

Os IDs C2-F01 a C2-F10 são identificadores deste planejamento, não números oficiais novos do roadmap pós-320. Os nomes de PRs e commits abaixo são propostos; não existem por causa deste documento.

## 2. Base consultada e limites da evidência

| Fonte | O que sustenta | Limitação |
| --- | --- | --- |
| `main` remoto `00810d9ddb71ae9654ef00b70596e63566a53b89`, conferido em 25/11 | Identificação da base de integração consultada | Revalidar antes de começar cada fase |
| `octaclin-web/components/auth/login-form.tsx` | Login, MFA, configuração manual e ações de copiar já existem; não há feedback explícito de sucesso/falha dessas cópias nesse componente | Não é auditoria de todos os serviços de autenticação |
| `octaclin-web/components/auth/esqueci-senha-form.tsx` | Recuperação já existe; há estados de solicitação e formulário de email | Reenvio, validade de tokens e limites precisam de confronto com backend |
| `octaclin-web/components/auth/recuperar-senha-form.tsx` e `lib/classificar-falha-token` | Há infraestrutura para lidar com falhas de token | Não propor novamente como se nada existisse |
| `octaclin-web/components/conta/sessoes-ativas.tsx` | Gestão de sessões já existe | Não criar painel concorrente |
| `octaclin-web/components/pacientes/perfil-cadastro-paciente.tsx` | Cadastro por seções, qualidade, possíveis duplicidades e acesso por convite já existem | Proteção completa de navegação e erro por campo exigem auditoria dirigida |
| `octaclin-web/lib/perfil-cadastro-paciente-api.ts` | Ciclo de convite e estados de acesso já possuem contrato | Não presumir cadastro público ou conta nova irrestrita |
| `tasks/plan-questionarios-10-prs.md`, código `99859abc05b05c728b907a0662ecfaacd5dabf27` | Dez entregas anteriores; comparação de retornos, paginação e limites já planejados/implementados em branches próprias | PR aberta não equivale a merge ou disponibilidade em produção |
| `tasks/questionarios-melhorias-referencias-2026-11-21.md` | Biblioteca, modelos, prévia, seções e referências de UX existentes | Histórico de propostas; não é estado atual integral |

Referência da entrega anterior: PR #592, comparação de dois retornos; PR #591, controle de recorrências. Este ciclo não deve acrescentar escopo a essas PRs.

As referências a arquivos nas próximas seções são alvos de investigação. Um arquivo novo só deve ser criado após verificar se um módulo equivalente já atende à necessidade.

## 3. O que será preservado

1. Autenticação existente, MFA, recuperação, sessões e convites.
2. Isolamento de clínicas, papéis, permissões, carteira e RLS.
3. Cookies HttpOnly e wrappers existentes de sessão/BFF.
4. Autorização antes de carregar conteúdo ou decifrar dados.
5. Rascunhos, versões, snapshots e envios históricos.
6. Validações clínicas e de cadastro existentes no servidor.
7. Fluxos de pacientes, anexos, autosave, reenvio e confirmação já aprovados.
8. Trabalho paralelo do Claude, especialmente FOOD06.
9. PRs abertas: sem merge, cherry-pick, rebase ou mudança de base implícitos.
10. Segurança operacional: sem deploy, migrations externas, mudanças de infraestrutura, cobrança ou escrita em produção.

Não haverá novo cadastro público, login social, autenticação sem senha, novos canais de comunicação, IA clínica, importação de bases ou integração externa por este plano.

## 4. Visão geral e ordem recomendada

| Ordem/ID | Entrega | Resultado principal | Evidência inicial | Porte | PRs previstas |
| --- | --- | --- | --- | --- | --- |
| 1 — C2-F01 | Login claro e acessível | Reutilizar Caps Lock e completar erro/foco compreensíveis | Lacuna localizada no frontend | Pequeno | 1 |
| 2 — C2-F02 | Feedback das cópias no MFA | Confirmação real de cópia e recuperação de falha | Lacuna localizada no frontend | Pequeno | 1 |
| 3 — C2-F03 | Recuperação de senha orientada | Próximo passo e nova tentativa compatíveis com limites reais | Oportunidade identificada; contrato a conferir | Pequeno | 1 |
| 4 — C2-F04 | Proteção de edições do cadastro | Navegar sem perda silenciosa de alterações | Lacuna ponta a ponta a confirmar | Pequeno/moderado | 1 |
| 5 — C2-F05 | Erros de cadastro por campo | Corrigir o campo certo sem refazer o cadastro | Lacuna ponta a ponta a confirmar | Moderado | 1 |
| 6 — C2-F06 | Busca em todo o histórico | Pesquisa autorizada além da página atual | Busca atual deste escopo é da página | Moderado/maior | 2 |
| 7 — C2-F07 | Comparação de versões do formulário | Conferir mudanças da estrutura original | Recurso específico a auditar | Moderado | 1 |
| 8 — C2-F08 | Blocos reutilizáveis | Reutilizar conjuntos de perguntas independentes | Complemento à biblioteca individual, a auditar | Moderado | 2 |
| 9 — C2-F09 | Perguntas condicionais | Mostrar complementos conforme respostas | Novo escopo fora do ciclo anterior | Maior | 3 |
| 10 — C2-F10 | Organização avançada da biblioteca | Encontrar e reutilizar recursos com menos esforço | Implementar somente lacunas comprovadas | Pequeno/moderado | 1 |

Previsão: 14 PRs de implementação para dez fases, caso todas as lacunas e os contratos se confirmem. Não é obrigação criar 14 PRs se um recurso já estiver atendido. Também não é autorização para retirar parte de uma fase para reduzir a contagem.

Fases 1–5 podem avançar em branches isoladas sem depender do merge dos questionários, desde que não disputem arquivos com outro agente. Fases 6–10 precisam de base explicitamente reconciliada com as entregas anteriores que reutilizarão.

A ordem é uma preferência de execução, não uma cadeia obrigatória de branches. Fases independentes devem partir da base aprovada e adequada, evitando empilhar todos os trabalhos desnecessariamente.

## 5. Método comum de execução

### 5.1. Antes de escrever código

- Ler `AGENTS.md`, `docs/agents/REGRAS.md` e instruções do pacote afetado.
- Confirmar branch, SHA, worktrees, alterações locais e dono de cada trabalho.
- Conferir PRs abertas que toquem a mesma superfície.
- Produzir um inventário pequeno: já existe / falta / não comprovado.
- Congelar o escopo autorizado e registrar decisões pendentes aplicáveis.
- Consultar os papéis e relatórios de UX relevantes.
- Conferir Next.js e ferramentas realmente instaladas; usar Node 22 conforme engines, sem mudar engines ou dependências para contornar setup.

### 5.2. TDD e commits

Cada comportamento novo deve ter RED funcional, implementação mínima e GREEN. Erro de instalação, fixture, compilação ou infraestrutura não é RED funcional.

Os commits C1/C2/C3 previstos abaixo representam unidades de trabalho. Um commit pode conter os testes RED demonstrados e a implementação GREEN correspondente; não enviar uma etapa deliberadamente quebrada apenas para materializar o RED no remoto.

- Fazer commits pequenos e intencionais, com testes aplicáveis verdes.
- Enviar somente a branch autorizada, após revisão do diff e scanner de segredos.
- Priorizar checkpoints úteis; evitar pushes cosméticos que reiniciem um CI longo.
- Cada PR deve conter implementação real, não apenas promessa ou documentação.
- Quando houver PRs dependentes, declarar base, ordem e dependência; não integrar implicitamente outra entrega.
- Não abrir PR paralela para substituir trabalho existente sem motivo e autorização aplicáveis.

### 5.3. Validações proporcionais

| Mudança | Evidência mínima planejada |
| --- | --- |
| UI sem contrato novo | Teste do comportamento, regressão afetada, typecheck/lint, linguagem, desktop/mobile, teclado/foco e acessibilidade proporcional |
| BFF/autorização | Teste específico, suíte `test:authz`, limites, origem, sessão, allowlist, cache e erros seguros |
| Leitura/gravação clínica | Integração real com PostgreSQL descartável, role runtime, RLS e negativas de autorização |
| Concorrência | Barreiras controladas, revisões/CAS, respostas tardias e rollback/idempotência conforme aplicável |
| Novo formato histórico | Leitores/escritores, versões legadas, restauração, exportação e rollback compatível |
| Migration necessária | Decisão arquitetural e ensaio apenas descartável; nenhuma execução externa por este plano |

Não repetir uma suíte onerosa sem mudança relevante ou lacuna de prova. Reutilizar evidência somente com commit, escopo e equivalência do código identificados.

PASS, FAIL, SKIPPED e NA devem ter motivo e escopo. Trabalho ainda não executado permanece PENDENTE/NOT RUN; não converter mera espera em SKIPPED. Abrir Draft com limitações não significa prontidão para merge.

### 5.4. UX e revisão

Aplicar o procedimento A/B/C/D de `docs/agents/ux/PROCEDIMENTO.md`:

- A: revisar proposta antes de implementar.
- B: revisar a primeira interface utilizável com evidência real.
- C: revisão final após testes técnicos.
- D: registrar aprendizados para a fase seguinte.

Papéis: `octaclin-nutricionista-ux` e `octaclin-paciente-ux`. Paciente N/A exige justificativa concreta. Login e recuperação podem afetar pacientes, portanto não presumir N/A.

Personas recebem apenas brief sintético e evidências sanitizadas, sem ferramentas ou dados reais. Não enviar senhas, chaves MFA, códigos de recuperação ou links reais de acesso. Parecer estático não equivale a navegação, teste humano ou R4.

Auth, autorização, tenancy, persistência clínica e migrations têm piso R4 conforme as regras do projeto. Mesmo uma UI pequena de login exige avaliação cuidadosa, sem tratar porte pequeno como ausência de risco.

## 6. C2-F01 — Login claro e acessível

### Objetivo e jornada

A pessoa informa email e senha, entende o estado da solicitação e consegue corrigir uma falha sem tentar adivinhar o problema. Um aviso discreto informa Caps Lock quando essa condição é realmente detectada.

### Escopo proposto

- Reutilizar a detecção de Caps Lock existente em CampoSenha e compor sua descrição com o erro, sem segunda implementação.
- Não exibir aviso constante em dispositivos sem informação confiável.
- Associar o erro ao formulário/campo apropriado com recursos acessíveis.
- Direcionar o foco ao aviso após falha de envio, sem roubá-lo a cada tecla.
- Preservar compatibilidade com preenchimento automático e gerenciadores de senha.
- Impedir reenvio acidental enquanto a solicitação está pendente.
- Diferenciar orientação de entrada inválida de falha temporária, com mensagens públicas seguras.
- Preservar o contrato existente de limpeza/preservação da senha; não escolher uma política nova silenciosamente.
- Manter sanitização do destino interno e a transição MFA existentes.

Não alterar requisitos de senha, política de bloqueio, MFA, criação de sessão ou permissões. Não aparar espaços nem transformar a senha; normalização de email somente se compatível com o contrato já existente.

### Reutilização e arquivos candidatos

`components/auth/login-form.tsx`, `components/auth/campo-senha`, `AuthShell`, `lib/auth-api`, mensagens e componentes de feedback existentes. Conferir wrappers BFF e testes atuais sem reescrever autenticação.

### Etapas e commits previstos — PR C2-01

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F01-C1 | Regressão do aviso Caps Lock existente e RED/GREEN de sua associação conjunta ao erro | Estado real de teclado; não aparece sem evidência |
| F01-C2 | RED/GREEN do foco, erro e submissão pendente | Falha recuperável, sem redirecionamento indevido ou duplo envio |
| F01-C3 | Regressões login/MFA/autofill, UX B/C, acessibilidade e evidências | Contrato de autenticação intacto e resultados registrados |

### Testes e aceite

Cobrir credenciais inválidas, falha de rede, resposta tardia, cliques repetidos, Caps Lock ligado/desligado/indisponível, desktop/mobile, teclado, autofill e redirecionamento seguro. Não distinguir conta inexistente de senha incorreta na mensagem pública. Não inserir credenciais em storage, logs ou URL.

Aceite: orientação observável e acessível, nenhum login aprovado pela interface sem confirmação do backend e nenhuma regressão de MFA ou destino. Rollback: somente UI, preservando sessão e política do servidor.

D01: escopo UX ratificado pela autorização do segundo ciclo; preservar a política atual de senha. Mudança dessa política exige decisão separada.

## 7. C2-F02 — Feedback das ações de copiar no MFA

### Objetivo e jornada

Ao copiar a chave de configuração ou códigos de recuperação, a pessoa sabe se a operação terminou e o que fazer se o navegador negar acesso à área de transferência.

### Escopo proposto

- Aguardar o resultado real de `clipboard.writeText`.
- Mostrar sucesso somente após resolução da operação.
- Tratar API ausente, contexto não compatível e permissão negada.
- Apresentar orientação para copiar manualmente o conteúdo já autorizado e visível.
- Informar o resultado por texto/status acessível sem reproduzir o segredo na mensagem.
- Manter o foco e evitar mensagens antigas após troca de etapa, desmontagem ou sessão.
- Preservar ações explícitas: não copiar automaticamente, repetir em segundo plano ou enviar dados a terceiros.

Não criar QR code, novo provedor, novo método de MFA ou persistência de códigos. Não tornar uma nova confirmação requisito de login sem decisão do proprietário.

### Reutilização e arquivos candidatos

`components/auth/login-form.tsx`, `components/conta/mfa-conta` e helper de clipboard existente, caso haja. Conferir ações equivalentes antes de criar helper compartilhado; não refatorar todas as cópias do sistema por conveniência.

### Etapas e commits previstos — PR C2-02

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F02-C1 | RED/GREEN de sucesso e rejeição da cópia nos dois tipos de conteúdo | Nunca anunciar sucesso antes da confirmação |
| F02-C2 | Estados acessíveis, indisponibilidade e proteção contra resposta tardia | Avisos não expõem conteúdo nem reaparecem em etapa diferente |
| F02-C3 | Regressões MFA, clipboard simulado, desktop/mobile e revisão | Nenhuma alteração em backend, credenciais ou política de recuperação |

### Testes e aceite

Cobrir clipboard disponível/ausente/negado, operação lenta, repetição deliberada, troca de etapa e continuidade do fluxo de login. Usar exclusivamente conteúdo sintético. Não alegar que uma simulação de clipboard comprova todos os navegadores reais.

Aceite: pessoa consegue distinguir sucesso de falha, há alternativa manual compreensível e nenhum segredo aparece em toast/log/storage adicional. Rollback: remoção do feedback sem mudar códigos ou sessões.

D02 ratificada no escopo autorizado do ciclo: feedback e fallback manual conforme proposto; nenhum método de MFA novo está incluído.

## 8. C2-F03 — Recuperação de senha com orientação e nova tentativa

### Objetivo e jornada

Depois de solicitar recuperação, a pessoa entende o próximo passo, pode corrigir o email e sabe quando uma nova tentativa é permitida, sem descobrir a existência de contas de terceiros.

### Escopo proposto

- Reutilizar solicitação e redefinição existentes.
- Explicar de forma neutra que, quando aplicável, as instruções serão enviadas pelo canal existente.
- Orientar conferência do endereço informado e da pasta de spam, sem prometer entrega efetiva.
- Mostrar nova tentativa compatível com os limites reais do servidor.
- Se houver `Retry-After` ou prazo equivalente autorizado, representar esse prazo corretamente.
- Se não houver prazo disponível, não inventar contagem regressiva nem prazo de liberação.
- Preservar distinção entre sintaxe inválida de email e resposta genérica de elegibilidade.
- Conferir mensagens e ações já existentes para token inválido, expirado, usado ou revogado; completar somente lacunas.
- Guardar o email somente no estado permitido da página, sem nova persistência.

### Dependências e decisões

Auditar serviço/BFF de recuperação, validade e reenvio antes de modificar a UI. Não presumir que um novo envio mantém todos os links anteriores válidos. Regras de validade, invalidação, limite de frequência ou canal novo não estão aprovadas por este planejamento.

### Etapas e commits previstos — PR C2-03

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F03-C1 | Inventário do contrato e RED/GREEN dos estados de solicitação | Mensagens públicas seguras e estados distinguíveis |
| F03-C2 | Próximo passo, correção de email e nova tentativa conforme contrato | Sem bloqueio fictício ou bypass do limite real |
| F03-C3 | Regressões de recuperação/redefinição e revisão de privacidade/UX | Sem enumeração de contas nem alteração silenciosa dos tokens |

### Testes e aceite

Cobrir email válido/inválido, respostas indistinguíveis para contas elegíveis/não elegíveis, 429, falha temporária, retry, duplo clique e respostas tardias. Testes de serviço devem utilizar entrega sintética, nunca email real.

Aceite: instruções claras e consistentes com o backend; tentativa adicional não emite requisições automáticas ilimitadas. Nenhum prazo, link real ou existência de conta é divulgado indevidamente. Rollback: UI, sem modificar solicitações/tokens emitidos.

Decisão D03: confirmar política já existente de reenvio e quais ações a interface pode oferecer; qualquer mudança dessa política deve ser explicitamente aprovada.

## 9. C2-F04 — Proteção de edições não salvas no cadastro

### Objetivo e jornada

O profissional edita identificação, contato, operação ou dados fiscais e recebe orientação antes de sair com alterações ainda não confirmadas.

### Auditoria obrigatória

Verificar proteção na página, nos componentes de seção e nos wrappers de navegação. Ausência de hook em um componente isolado não prova ausência do recurso completo. Se já houver proteção suficiente, corrigir apenas a lacuna demonstrada.

### Escopo proposto

- Identificar alterações por seção e por paciente.
- Reutilizar `usar-protecao-alteracoes-nao-salvas` e modais existentes, se aplicáveis.
- Mostrar quais seções possuem alterações, sem criar outro mecanismo de autosave.
- Propor “Continuar editando” e “Sair sem salvar”, com confirmação explícita do descarte.
- Oferecer “Salvar e sair” somente se o contrato permitir garantir o resultado de todas as seções envolvidas; não prometer atomicidade que não existe.
- Ao falhar um save, manter os dados ainda autorizados e não marcar sucesso.
- Desconsiderar ACK antigo após troca de paciente/versão ou nova edição.
- Encerramento de sessão não deve criar rascunho clínico novo em armazenamento local.

A proteção de navegação não será apresentada como solução de concorrência entre profissionais. Se o contrato de cadastro não tiver revisão/CAS, registrar essa limitação e uma proposta separada, sem introduzir sobrescrita forçada.

### Etapas e commits previstos — PR C2-04

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F04-C1 | RED/GREEN dos estados limpo/alterado por seção | Alteração real distingue-se de hidratação inicial |
| F04-C2 | Integração da proteção nas saídas suportadas | Continuar preserva dados; descarte é explícito |
| F04-C3 | Save/erro/ACK e troca de contexto | Nenhum retorno antigo limpa alterações mais recentes |
| F04-C4 | Browser, UX, regressões e evidências | Sem storage novo ou alteração nos contratos do cadastro |

### Testes e aceite

Cobrir navegação interna, troca de paciente, fechar/recarregar quando o navegador suportar, modal cancelado, salvamento parcial existente e falha. Documentar limites nativos de `beforeunload`; não afirmar bloqueio de toda saída do navegador.

Aceite: nenhuma perda silenciosa nas saídas suportadas, seção correta identificada e foco devolvido à ação original. Rollback: somente proteção visual, mantendo o modelo de persistência anterior.

Decisão D04: ratificar opções do modal e comportamento em múltiplas seções; não incluir autosave ou gravação em lote implicitamente.

## 10. C2-F05 — Erros de cadastro associados aos campos

### Objetivo e jornada

O profissional tenta salvar uma seção e consegue ir diretamente ao campo que precisa de correção, sem perder o que já preencheu.

### Escopo proposto

- Mapear erros estruturados existentes de identificação, contato, operação e fiscal.
- Apresentar resumo navegável quando houver vários erros e mensagem junto ao campo.
- Reutilizar nomes, IDs DOM e padrões de acessibilidade do editor/questionários.
- Manter a validação backend autoritativa, com projeção pública por allowlist.
- Não mostrar detalhes internos do validador, caminhos ORM ou dados de outros pacientes.
- Distinguir campo inválido de conflito de edição, falta de permissão e falha temporária.
- Preservar alerta existente de possível duplicidade; não transformá-lo em fusão automática ou bloqueio novo de cadastro.
- Ajustar `inputMode`/autocomplete somente quando compatível com o dado e com o contrato.

Não criar regra nova para CPF, email, telefone, CEP ou obrigatoriedade sem justificativa e aprovação necessárias. Endereços e contatos não serão enviados a serviços externos de validação.

### Etapas e commits previstos — PR C2-05

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F05-C1 | RED/GREEN do mapeamento público dos erros existentes | Campos reconhecidos; desconhecidos viram erro geral seguro |
| F05-C2 | Resumo, vínculos, foco e mensagens próximas aos campos | Corrigir um campo não remove os demais valores |
| F05-C3 | Integração BFF/backend se necessária, sem mudar validações | Mesmos erros de domínio, sem entidades cruas |
| F05-C4 | Regressões de cadastro, autorização e UX | Erros/falhas/conflitos possuem tratamento consistente |

### Testes e aceite

Cobrir vários campos inválidos, campos aninhados, erro geral, 403/409/429/5xx, mensagem inesperada, foco por teclado e múltiplas seções. Se houver nova projeção de conteúdo no backend, incluir prova real de isolamento pertinente.

Aceite: cada erro conhecido leva ao campo correto, dados autorizados são preservados e as regras do servidor não foram enfraquecidas. Rollback: mensagens/projeção aditiva, sem reescrever cadastros.

Decisão D05: ratificar o fluxo de correção; novos critérios de validade ou proibição de duplicidade ficam fora desta fase.

## 11. C2-F06 — Busca em todo o histórico autorizado de respostas

### Objetivo e jornada

O profissional pesquisa um termo em envios históricos do questionário sem depender de carregar e procurar uma página de cada vez.

### Dependência e risco material

O ciclo anterior implementou paginação e busca da página; isso não equivale a busca global. Esta fase só começa com a base funcional apropriada de leitura/autorização estabilizada.

Auditar onde enunciados e respostas ficam armazenados e cifrados. Não criar `ILIKE` sobre ciphertext, índice público de conteúdo clínico ou decifragem ilimitada de todos os históricos. Se o mecanismo atual não permitir busca global com limites seguros, apresentar alternativas técnicas antes de implementar. Não anunciar resultado global completo quando apenas uma janela foi examinada.

### Escopo proposto

- Definir explicitamente o alcance: questionário atual e pacientes atualmente autorizados; filtro de paciente quando selecionado.
- Busca textual previsível, inicialmente sem regex arbitrária, interpretação clínica ou busca semântica.
- Consulta clínica enviada em corpo protegido, sem novo termo sensível em URL, histórico, logs ou telemetria.
- Paginação no servidor, ordenação estável, limites e timeout existentes.
- Cursor vinculado ao contexto/filtros e sem autoridade própria; reautorizar cada consulta.
- Retornar projeção mínima e motivo seguro de limite/indisponibilidade.
- Integrar resultados à leitura individual e seleção de comparação existentes.
- Preservar alcance explícito das exportações; não prometer automaticamente exportar todos os resultados de uma nova busca.

### PR C2-06A — Serviço de pesquisa autorizado

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F06A-C1 | Contrato e RED/GREEN da seleção limitada e semântica textual | Alcance, ordenação e completude não ambíguos |
| F06A-C2 | Leitura/pesquisa server-side reutilizando autorização e projeções | Sem consulta integral insegura ou índice clínico não aprovado |
| F06A-C3 | PostgreSQL/RLS, revogação, limites e concorrência | Nenhum resultado/contagem de paciente sem acesso |
| F06A-C4 | HTTP/BFF, revisão R4 e documentação | Contrato utilizável e privado, mesmo sem nova UI |

### PR C2-06B — Pesquisa no console

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F06B-C1 | RED/GREEN do alcance e busca por ação explícita | Distinguir “Nesta página” de “No histórico” |
| F06B-C2 | Resultados, limpar, navegação e paginação | Filtros aplicados visíveis e nenhum retorno antigo no contexto novo |
| F06B-C3 | Browser/UX, volume, erro e regressões CSV/comparação | Dados corretos e nenhuma promessa de exportação não implementada |

### Testes e aceite

Cobrir acentos/Unicode, termo literal, resultado vazio, mais de uma página, limites, tenant/paciente/carteira, revogação entre páginas e mudança de contexto. O modelo de custo deve ser comprovado em dados sintéticos, não presumido pelo número de registros da fixture.

Aceite: alcance global realmente suportado pelo contrato, nenhum carregamento completo no navegador e nenhuma busca indevidamente autorizada. Rollback: remover o novo caminho sem remover leitores antigos; nova indexação/persistência, se necessária, exige plano próprio antes de ser criada.

Decisão D06: aprovar alcance textual, relação com exportação e eventual solução de pesquisa sobre conteúdo cifrado. Nenhuma arquitetura nova de índice está autorizada.

## 12. C2-F07 — Comparação de versões do formulário

### Objetivo e jornada

Antes de publicar ou reutilizar um formulário, o profissional compara duas versões salvas e entende o que mudou na estrutura. Não é a comparação de duas respostas da PR #592.

### Escopo proposto

- Selecionar duas versões autorizadas do mesmo questionário.
- Identificar perguntas adicionadas/removidas por ID estável, sem pareamento por nome.
- Mostrar mudanças de enunciado, tipo, obrigatoriedade, opções, unidade, escala e seção.
- Distinguir alteração de organização/apresentação de alteração estrutural, sem julgamento clínico.
- Usar os snapshots reais; estrutura ausente permanece indisponível.
- Comparação somente de leitura, sem restaurar ou publicar automaticamente.
- Reutilizar contratos históricos e partes da canonização da comparação anterior, se semanticamente adequados; não duplicar motor de identidade.
- Manter versões e autores apenas no alcance já permitido.

Não incluir comparação de rascunho não salvo com versão publicada sem contrato e decisão específicos. Não tornar esse passo obrigatório para publicar implicitamente.

### Etapas e commits previstos — PR C2-07

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F07-C1 | RED/GREEN do diff estrutural e identidades | Adição/remoção/mudança corretas, sem pares inventados |
| F07-C2 | Leitor/API/BFF mínimos reutilizados | Versões exatas e autorizadas antes do conteúdo |
| F07-C3 | Interface de conferência, filtros por tipo de mudança e causas | Leitura compreensível, cancelável e sem gravação |
| F07-C4 | Legado, snapshots, isolamento, UX/R4 e regressões | Passado preservado e escopo de comparação explícito |

### Testes e aceite

Cobrir opções reordenadas, novas identidades com nomes iguais, objetos/arrays diferentes, estruturas incompletas, versões repetidas, acesso revogado, tenant cruzado e nenhuma escrita clínica.

Aceite: diferenças reproduzíveis com as versões escolhidas, sem preencher lacunas com a definição atual. Rollback: remover leitura/interface, mantendo os históricos.

Decisão D07: ratificar duas versões salvas como primeira entrega e definir se a comparação será apenas ação manual — recomendação deste plano.

## 13. C2-F08 — Blocos reutilizáveis de perguntas

### Objetivo e jornada

O profissional salva e reutiliza um conjunto de perguntas, como “Rotina de sono”, sem montar todo o conjunto novamente e sem alterar perguntas/modelos que já foram usados.

### Escopo proposto

- Bloco com nome, descrição opcional, ordem e perguntas/configurações compatíveis.
- Auditar se modelos ou biblioteca atuais já conseguem representar isso sem sobreposição.
- Proposta inicial: blocos pessoais; compartilhamento com clínica depende da decisão D08 e das permissões existentes.
- Criar, editar, duplicar e arquivar, preservando autoria e revisões pertinentes.
- Aplicar em rascunho salvo com prévia e confirmação.
- Gerar identidades novas e ordem consistente; não herdar chave clínica de comparação nem publicação individual na biblioteca automaticamente.
- Manter a aplicação independente do bloco de origem; nada de sincronização automática de envios ou formulários já publicados.
- Operação de inserção atômica, com revisão/CAS e idempotência existentes ou adaptação mínima aprovada.
- Não copiar respostas de pacientes nem referências clínicas para formar blocos compartilháveis.

Se o modelo atual não comportar blocos corretamente, apresentar esquema e migration proposta antes do desenvolvimento persistente. Não sobrecarregar modelos existentes apenas para afirmar que não houve migration.

### PR C2-08A — Biblioteca de blocos

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F08A-C1 | RED/GREEN do contrato, propriedade e validação | Tipos/configurações/quantidades válidos e escopo explícito |
| F08A-C2 | Persistência/serviços reaproveitados e CRUD autorizado | Cópias independentes e arquivamento não destrutivo |
| F08A-C3 | Interface de gerenciamento, testes RLS/HTTP e UX/R4 | Biblioteca utilizável sem aplicação automática |

### PR C2-08B — Aplicação no editor

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F08B-C1 | RED/GREEN do remapeamento de IDs e inserção ordenada | Original independente e sem herança clínica indevida |
| F08B-C2 | Comando atômico, CAS/idempotência e prévia | Retry não duplica; falha não insere meio bloco |
| F08B-C3 | Integração editor, cancelamento, versões e regressões | Uso real sem modificar envios históricos |
| F08B-C4 | UX/R4 e fechamento de critérios da fase | Escopo pessoal/compartilhado exatamente conforme aprovado |

### Testes e aceite

Cobrir nomes iguais, opções e mídias autorizadas, tags/seções compatíveis, rascunho alterado, bloco arquivado, permissão revogada, tenant cruzado, falha intermediária e reenvio do mesmo comando.

Aceite: conjunto reutilizável e aplicação independente/atômica; nenhum histórico ou biblioteca original alterado pela personalização. Rollback: preservar instâncias aplicadas e registros históricos; mudança de schema exige ensaio específico.

Decisão D08: pessoal apenas ou pessoal/clínica, matriz de edição/arquivamento e identificação clínica nas cópias. Não presumir permissão administrativa genérica.

## 14. C2-F09 — Perguntas condicionais simples

### Objetivo e jornada

Uma pergunta complementar aparece quando a resposta anterior torna essa pergunta aplicável. Exemplo sintético: “Deseja informar sua rotina de atividade física?” → “Sim” abre uma pergunta de texto complementar. A regra organiza o formulário; não toma decisão clínica.

### Escopo inicial recomendado, ainda sujeito a decisão

- Condições explícitas entre perguntas do mesmo formulário, por IDs estáveis.
- Começar por sim/não e escolha única com comparação de igualdade.
- Não incluir linguagem de programação, scripts, regex, IA, cálculos clínicos ou combinações AND/OR arbitrárias inicialmente.
- Rejeitar ciclos, referências inexistentes e opções incompatíveis.
- Diferenciar condição verdadeira, falsa e indeterminada.
- Não tratar pergunta não aplicável como resposta vazia, zero, falso ou recusa.
- Não apagar silenciosamente uma resposta quando a condição muda.
- Não enviar valores de campos ocultos como se fossem respostas efetivas sem decisão explícita sobre esse contrato.
- Preservar rascunhos e anexos somente pelos mecanismos autorizados existentes.
- Backend reavalia condições e obrigatoriedade no envio; frontend não é fonte de autoridade.
- Congelar regras e versão de avaliação no envio/snapshot para reproduzir histórico.
- Compatibilidade explícita com completude, comparação, CSV, prévia e biblioteca/blocos.

### Decisões obrigatórias antes da implementação

D09 precisa definir: operadores suportados; dependências entre condições; resposta do pai ausente; obrigatoriedade de pais e filhos; destino da resposta já digitada quando o campo deixa de ser aplicável; comportamento de uploads; apresentação e exportação de “não aplicável”; leitores antigos e mudança de regras em novos envios.

Recomendação: limitar a primeira versão a condições simples, evitar pai opcional governando filho obrigatório sem regra explícita e preservar valores anteriores apenas no rascunho autorizado para eventual reabertura. Essa recomendação não está aprovada nem deve ser codificada por inferência.

### Arquitetura a comprovar

Definir um contrato canônico de avaliação, com autoridade no backend. Reutilizar domínio compartilhado se já existir; caso contrário, comparar a opção de prévia server-side com compartilhamento de lógica pura compatível com os builds. Não criar dois motores divergentes por conveniência.

Uma nova enumeração de estados ou formato histórico pode ser incompatível com leitores/BFFs estritos. Versionar ou negociar a projeção quando necessário; não ignorar campos/estados novos para aparentar compatibilidade. Antes de migrations, apresentar desenho, leitores/escritores e rollback.

### PR C2-09A — Contrato, editor e regras versionadas

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F09A-C1 | RED/GREEN de regras simples, grafo e casos indeterminados | Sem ciclos ou referências inválidas; política aprovada identificada |
| F09A-C2 | Validação, persistência/versão e compatibilidade histórica | Estrutura congelada reproduzível, legado preservado |
| F09A-C3 | Configuração e prévia no editor com autorização | Profissional consegue conferir regra sem alterar respostas |
| F09A-C4 | Testes/R4 do contrato e preparação segura da ativação | Sem ativação clínica parcial ou mudança em produção |

### PR C2-09B — Preenchimento, rascunho e envio

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F09B-C1 | RED/GREEN de visibilidade, foco e obrigatoriedade | Apenas perguntas aplicáveis conforme contrato aprovado |
| F09B-C2 | Rascunho/anexos e mudança de resposta do pai | Sem perda silenciosa ou exposição de resposta oculta |
| F09B-C3 | Validação server-side e ACK/idempotência | Payload adulterado não contorna regras |
| F09B-C4 | Mobile/teclado/assistividade, offline e cancelamentos | Jornada coerente antes de considerar disponibilização |

### PR C2-09C — Histórico, análise e integrações

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F09C-C1 | RED/GREEN de completude e estados históricos | Denominadores corretos; indeterminado não vira completo |
| F09C-C2 | CSV, comparação de retornos/versões e projeções legadas | Não aplicável explícito; nenhuma interpretação falsa de delta |
| F09C-C3 | Blocos/modelos e remapeamento de regras | Identidades independentes e referências corretas |
| F09C-C4 | Regressões completas afetadas, UX/R4 e gate de fase | Todas as partes obrigatórias comprovadas; não concluir com integração pendente |

### Testes e aceite

Cobrir pai ausente/alterado, filho preenchido/oculto/reaberto, regras removidas, ciclo, exclusão de pergunta referenciada, ID forjado, versões antigas, uploads pendentes, autosave, retries, offline, mudança entre abas, snapshots e exports. Usar PostgreSQL/RLS para as fronteiras persistentes.

Aceite: comportamento aplicável reproduzível e autorizado, histórico fiel, nenhuma perda silenciosa e todos os consumidores compatíveis. A fase inteira não está concluída com apenas o editor ou apenas a renderização.

Rollback: pode exigir negociação de leitores e contenção de novas gravações condicionais. Não prometer reversão somente de código após gerar snapshots novos. Proposta operacional própria antes de qualquer ativação externa.

## 15. C2-F10 — Organização avançada da biblioteca

### Objetivo e jornada

O profissional encontra rapidamente uma pergunta, modelo ou bloco sem repetir montagem nem percorrer listas longas.

### Auditoria e escopo proposto

- Inventariar busca, categorias, tipo, escopo, estado, favoritos e paginação já existentes.
- Selecionar apenas lacunas reais; não substituir a biblioteca atual.
- Complementar filtros e ordenação determinística onde faltarem.
- Propor favoritos por profissional se ainda inexistentes, usando preferência autorizada no servidor.
- Preservar rótulos de pessoal/clínica e de autoria já permitidos.
- Não usar localStorage para introduzir listas clínicas ou referências protegidas.
- Exibir resultado vazio útil e ação de limpar filtros sem perder contexto desnecessariamente.
- Não vazar nomes/categorias de itens que a pessoa não pode consultar.
- Reutilizar blocos da F08 quando disponíveis, sem tornar a biblioteca inteira dependente deles.

### Etapas e commits previstos — PR C2-10

| Commit | Trabalho | Encerramento |
| --- | --- | --- |
| F10-C1 | Inventário e RED/GREEN das lacunas selecionadas | Recurso existente não vira implementação duplicada |
| F10-C2 | Filtros/ordenação/paginação e preferência autorizada, se necessária | Alcance real no servidor, sem favorito compartilhado por engano |
| F10-C3 | Interface integrada, vazio/erro/limpar e teclado | Menos esforço sem mudar acesso ou cópias existentes |
| F10-C4 | Regressões de biblioteca/modelos/blocos, UX e revisão | Somente lacunas autorizadas concluídas |

### Testes e aceite

Cobrir favoritos de dois profissionais, isolamento entre clínicas, item arquivado/revogado, paginação, combinações de filtros, atualização e navegação por teclado.

Aceite: localizar e reutilizar recursos autorizados com resultados consistentes. Se a auditoria provar atendimento integral, registrar JÁ ATENDIDO e não abrir PR vazia ou inventar novo requisito para completar uma contagem.

Decisão D10: quais lacunas priorizar, alcance dos favoritos e filtros novos; novo armazenamento exige justificativa e compatibilidade.

## 16. Decisões de produto para aprovação

Esta tabela reúne as perguntas; não exige respondê-las todas antes das fases independentes.

| ID | Momento | Decisão necessária | Recomendação inicial, não aprovada |
| --- | --- | --- | --- |
| D01 | Antes F01 | Escopo UX do login e preservação da política de senha | Melhorar orientação/foco sem alterar autenticação ou limpeza de senha |
| D02 | Antes F02 | Feedback e alternativa quando a cópia falhar | Sucesso após resolução real; orientação manual, sem copiar automaticamente |
| D03 | Antes F03 | Fluxo de nova tentativa e semântica de reenvio | Reutilizar integralmente política e prazos reais do servidor |
| D04 | Antes F04 | Opções de saída e múltiplas seções alteradas | Continuar editando/sair sem salvar; salvar e sair só com garantia contratual |
| D05 | Antes F05 | Alcance da correção e duplicidades | Erros existentes por campo; sem nova regra de proibição/fusão |
| D06 | Antes F06 | Alcance global, busca cifrada e exportação | Questionário atual, pacientes autorizados; pesquisa literal, sem nova indexação não aprovada |
| D07 | Antes F07 | Versões comparáveis e relação com publicação | Duas versões salvas; comparação manual e somente leitura |
| D08 | Antes F08 | Propriedade, compartilhamento, edição e chaves clínicas | Pessoal primeiro; compartilhamento e matriz específicos se aprovados |
| D09 | Antes F09 | Condições, obrigatoriedade, ocultação, histórico e rollback | Primeira versão simples; aprovar política detalhada antes do contrato |
| D10 | Após inventário F10 | Lacunas reais e preferências de organização | Priorizar localização/reutilização; não duplicar o existente |

A aprovação futura pode ratificar em conjunto as recomendações bem delimitadas de F01/F02. F06/F08/F09 não devem ser tratadas como simples ajustes de tela: possuem decisões de arquitetura/dados e, em F09, consequências sobre o significado do preenchimento.

## 17. Dependências compartilhadas e condições de interrupção

| ID | Dependência/risco | Fases afetadas | Critério para resolver |
| --- | --- | --- | --- |
| DEP-01 | Base adequada e arquivos sem disputa com outro agente | Todas | Branch/SHA/diff/dono conferidos antes de escrever |
| DEP-02 | Contratos reais de auth, sessão, erro e limites | F01–F03 | Fluxos/backend/BFF e testes atuais mapeados; sem pressuposto inseguro |
| DEP-03 | Proteção de navegação e estado por seção | F04–F05 | Reutilização definida e ausência de perda silenciosa demonstrada |
| DEP-04 | Integração das leituras históricas e versões anteriores | F06–F09 | Base explícita e regressões pertinentes comprovadas |
| DEP-05 | Pesquisa de conteúdo cifrado com limites seguros | F06 | Solução aprovada sem índice clínico exposto ou varredura ilimitada |
| DEP-06 | Modelo versionado para biblioteca/blocos | F08–F10 | Modelo reaproveitável comprovado ou mudança de esquema aprovada |
| DEP-07 | Aplicabilidade, snapshots e consumidores compatíveis | F09 | Política ratificada e matriz completa de leitores/escritores/rollback |
| DEP-08 | Revisões UX/R4, CI e evidência do HEAD exato | Todas | Gates reais registrados, sem PASS por analogia |
| DEP-09 | Liberação operacional | Eventual disponibilização de todas | Autorização separada, estado real de serviços/schema e plano operacional |

Interromper somente a parte afetada quando houver: acesso não autorizado, necessidade de descarte de trabalho paralelo, contrato incompatível, nova regra clínica/legal, persistência de conteúdo sensível não prevista, fonte/licença não autorizada, migration não planejada ou necessidade de operação externa.

Continuar itens independentes quando for seguro; documentar fato, impacto e alternativa. Não contornar o bloqueio por UI, mock, permissão ampliada, timeout maior ou supressão de validação.

## 18. Matriz transversal de testes

| Grupo | Casos obrigatórios pertinentes |
| --- | --- |
| Entrada e formato | Vazio, zero, falso, Unicode, unidades, objetos/arrays, campos desconhecidos e limites |
| Identidade | Mesmo tenant/paciente/questionário; identificadores exatos; sessão expirada/revogada; profissional e carteira atuais |
| Estado da interface | Pendente, sucesso confirmado, erro recuperável, negar acesso, cancelar, desmontar e A→B→A |
| Concorrência | Alteração entre prévia e confirmação, revisão stale, retries/idempotência, rollback quando há escrita |
| Histórico | Snapshot original, versão ausente, nova configuração sem reescrever passado, restauração/exportação compatíveis |
| Acessibilidade | Nome visível no nome acessível, foco, teclado, texto200%, desktop/mobile, axe; manual assistivo separado |
| Privacidade | Sem conteúdo clínico em logs/URL/cache/telemetria; allowlist; clipboard apenas por ação explícita |
| Regressão | Login/MFA/recuperação; cadastro; biblioteca; preenchimento/rascunho/anexos/envio; leitura/CSV/comparações conforme impacto |
| Operação | Teste local não prova produção; migrations somente descartáveis; CI do HEAD, scanner e rollback documentado |

Os casos aplicáveis devem estar ligados a testes e commits. NA precisa de motivo. Teste iniciado/interrompido não comprova comportamento; SKIPPED não é aprovação.

## 19. Prontidão de cada fase e acompanhamento

Registrar três dimensões separadas:

1. Implementação: não iniciada / em implementação / implementada com lacunas / implementada.
2. Validação: não executada / parcial / validada no escopo / aceite integral.
3. Dependências: resolvidas / pendentes com IDs e responsáveis.

Todas as vinte fases estão, neste documento, com implementação NÃO INICIADA e validação NOT RUN. Não atribuir percentual fictício de conclusão ao planejamento. O esforço estimado não representa progresso.

Uma fase poderá ser recomendada para revisão quando:

- Escopo e decisões aplicáveis estiverem ratificados.
- Lacunas obrigatórias estiverem implementadas sem duplicação indevida.
- RED/GREEN e regressões pertinentes estiverem documentados por commit.
- UX e revisão independente aplicáveis tiverem resultado e limites registrados.
- CI/scanners do HEAD exato tiverem sido verificados.
- Toda pendência estiver classificada sem transformar ausência de prova em PASS.
- Não houver problema bloqueante aberto no escopo.

PR Draft pode ser aberta antes do aceite integral, com gates claramente pendentes. Retirar Draft, merge e operação em produção são decisões distintas. Não executar automaticamente nenhuma delas.

## 20. Entregável e handoff de cada implementação

Não criar dez relatórios repetindo este documento. Na fase executada, registrar somente:

- ID, objetivo, decisão de aprovação e escopo fechado.
- Branch/PR/base e SHA do código.
- Contratos/componentes reaproveitados e arquivos realmente alterados.
- RED funcional, GREEN e regressões com comandos/resultados.
- PostgreSQL/RLS e provas de concorrência quando aplicáveis.
- UX A/B/C/D e R4, com identidade do revisor e natureza estática/interativa.
- CI/scanners por HEAD; PASS/FAIL/SKIPPED/NA e justificativas.
- Lacunas, riscos, rollback e próxima ação exata.

Um requisito já atendido deve receber referência da evidência existente, não uma implementação artificial nova.

## 21. Próximo passo recomendado

Aprovar primeiro o escopo de C2-F01/C2-F02 e executar a auditoria dirigida desses fluxos, com UX A e baseline de testes. Depois iniciar F01 em branch própria; F02 pode partir de base independente ou da F01 somente se houver dependência real declarada.

Antes de executar F04–F10, confirmar as decisões correspondentes e a base que já contém os recursos necessários. F09 precisa de ratificação detalhada antes de qualquer novo contrato de aplicabilidade.

Este documento encerra o planejamento prévio solicitado. Não inicia implementação, não concede acesso novo, não autoriza merge/deploy/migrations e não muda FOOD06 ou as PRs anteriores.

## 22. Complemento — dez implementações operacionais de alto valor

Adicionado em 25/11/2026 a pedido do proprietário. Planejamento autorizado; nenhuma das novas implementações começou por esta atualização. As regras comuns de segurança, Git, TDD, UX e evidência das seções 3–5 continuam aplicáveis.

A investigação dirigida usou os componentes abaixo, equivalentes à `main` consultada `00810d9` nessas superfícies. Ausência na interface inspecionada não é auditoria completa de todo o produto; reconfirmar PRs e código antes de implementar. A integração posterior da PR #583 não prova ou altera o estado produtivo destas propostas.

Não reimplementar duplicação de consultas, filtros de categoria de anexos, preparação da próxima consulta, gestão de sessões ou preferências de notificações: esses recursos já existem.

| ID | Implementação | Lacuna específica observada | Porte | PRs previstas |
| --- | --- | --- | --- | --- |
| C2-F11 | Notas internas protegidas por conversa | Texto da nota em estado único, seleção de conversa independente | Pequeno/moderado | 1 |
| C2-F12 | Mostrar/ocultar valores financeiros | Valores de consulta e pacote renderizados diretamente | Pequeno | 1 |
| C2-F13 | Marcar notificação individual como lida | API aceita IDs, mas sino comum oferece somente ação coletiva | Pequeno | 1 |
| C2-F14 | Prévia de recibos e declarações | Prévia completa está no fluxo de encaminhamento, demais tipos emitem diretamente | Moderado | 1 |
| C2-F15 | Nome amigável de anexo | Lista abre/exclui, sem edição de título de apresentação | Moderado | 1 |
| C2-F16 | Buscar/ordenar anexos exibidos | Categoria existe, mas não os controles de nome/período/ordem propostos | Pequeno/moderado | 1 |
| C2-F17 | Abrir recurso exato da notificação | Destino é genérico por tipo apesar de haver referência ao recurso | Moderado | 1 |
| C2-F18 | Histórico paginado de notificações | Sino limitado e página de preferências não equivalem à central histórica | Moderado | 1 |
| C2-F19 | Consultas por paciente, período e status | Listagem consultada limitada a200 e a partir dos30dias anteriores | Moderado | 2 |
| C2-F20 | Consulta em arquivo de calendário `.ics` | Não localizada geração iCalendar nos módulos pesquisados | Pequeno/moderado | 1 |

São onze PRs adicionais previstas, totalizando vinte fases e aproximadamente25PRs com o pacote original. É estimativa condicional à auditoria e decisões: não criar PR vazia para atingir uma contagem.

Ordem recomendada dentro do complemento: F11 → F12 → F13 → F14 → F15/F16 → F17/F18 → F19 → F20. Fases independentes não precisam compartilhar a mesma branch ou esperar toda a sequência.

## 23. C2-F11 — Notas internas vinculadas à conversa

### Objetivo e escopo

Ao redigir uma nota interna, o profissional deve poder alternar conversas sem perder o texto ou reaproveitá-lo silenciosamente no contexto errado. Não se trata de criar um novo canal de mensagens.

Fonte: `octaclin-web/components/comunicacoes/painel-comunicacoes.tsx`, estados `textoNotaWhatsapp`/conversa selecionada e ação `registrarNotaConversaWhatsapp`. A observação de estado compartilhado é evidência estática; eventual associação incorreta precisa de reprodução antes de ser classificada como defeito funcional.

Proposta:

- Vincular texto e estado de atendimento da nota à identidade da conversa e ao contexto autorizado.
- Manter rascunho somente em memória durante o uso da página; não criar armazenamento clínico local ou persistência server-side implicitamente.
- Indicar a conversa de destino e oferecer confirmação ao abandonar alterações, conforme decisão D11.
- Troca de conversa não transforma automaticamente uma nota de A em nota de B.
- Save só confirmado após ACK; sucesso/erro antigo não pode limpar ou sobrescrever o texto de outra conversa.
- Revalidar contexto e autorização antes de registrar; não alterar regras de associação de paciente/contato por conveniência.
- Limpar dados segundo o encerramento de sessão e política vigente, sem prometer recuperação após logout/recarregamento.

### PR e commits — C2-11

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F11-C1 | RED/GREEN de texto/status por conversa e troca de contexto | Sem reutilização silenciosa do conteúdo de A em B |
| F11-C2 | Confirmação de saída e ACK protegido por geração | Cancelar preserva; ACK antigo não apaga edição atual |
| F11-C3 | Browser desktop/mobile, negativas e regressões de notas | Sem novo envio externo, storage ou ampliação de acesso |

Testar A→B→A, associação de paciente alterada, nota lenta, erro, duplo clique, acesso revogado e logout. Aceite final: conteúdo e destinatário/contexto inequívocos, texto preservado nas saídas suportadas e nenhum falso sucesso. Rollback somente da UI não altera notas já registradas.

D11: aprovar se a troca pede confirmação, mantém rascunho por conversa ou oferece descarte explícito. Recomendação: rascunho em memória por conversa e proteção contra saída da página; sem autosave clínico novo.

## 24. C2-F12 — Mostrar/ocultar valores financeiros

### Objetivo e escopo

Permitir atendimento ou compartilhamento de tela sem apresentar honorários e valores de pacotes em cartões de leitura.

Fontes: `components/agenda/painel-agenda.tsx`, `components/agenda/pacotes-sessao.tsx` e proposta OPS03 em `tasks/melhorias-profissionais-paralelas-food06.md`. Auditar superfícies antes de afirmar cobertura de todo o console.

- Primeira entrega proposta: textos de leitura na agenda e pacotes, com um controle identificável.
- Recomendação: preferência visual da sessão, inicialmente sem alterar o comportamento atual até o usuário ativar.
- Renderizar indicação “Valor oculto”, sem deixar o valor como texto oculto acessível por leitor de tela, tooltip ou seleção/cópia da apresentação mascarada.
- A informação pode continuar em memória/rede para a pessoa autorizada: isto não é controle de acesso nem proteção contra inspeção técnica.
- Não alterar permissões, cálculos, campos de edição, documentos, PDF, exportações ou visualização do paciente.
- Não guardar valores ou identificadores clínicos na preferência.

### PR e commits — C2-12

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F12-C1 | Inventário de superfícies e RED/GREEN do estado visual | Controles e valores autorizados mapeados |
| F12-C2 | Controle compartilhado mínimo para os cartões definidos | Apresentação mascarada sem valor no nome acessível |
| F12-C3 | Teclado, mobile, alternância e regressões financeiras | Cálculos, edição e exportação anteriores intactos |

Aceite: valores ocultos nas superfícies declaradas, controle acessível e nenhum mascaramento apresentado como autorização. Rollback remove a preferência visual, sem mudar dados financeiros.

D12: aprovar alcance e duração da preferência; persistência por profissional ou outras telas exigem definição específica.

## 25. C2-F13 — Leitura individual de notificações

### Objetivo e escopo

O profissional marca somente o aviso já tratado, mantendo os demais como pendentes.

Fontes: `components/app/sino-notificacoes.tsx`, `lib/notificacoes-api.ts` e módulo backend de notificações. Reutilizar `marcarNotificacoesLidas(ids)`; o serviço já aceita IDs específicos. O complemento necessário é a ação individual no sino e seu tratamento consistente.

- Botão explícito por notificação não lida, acessível e separado do link de navegação.
- Não marcar todas nem remover o aviso ao tratar um item.
- Confirmar estado após resposta atual do backend; evitar contador negativo ou redução duplicada ao repetir a ação.
- Conciliar atualização periódica com ACKs; resposta antiga não recompõe pendência indevidamente.
- Não adicionar “marcar como não lida”, exclusão ou retenção nova nesta entrega.
- A ação afeta somente a própria caixa; não concede acesso ao recurso clínico apontado.

### PR e commits — C2-13

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F13-C1 | RED/GREEN de envio de um único ID e preservação dos demais | Sem chamada coletiva involuntária |
| F13-C2 | Feedback/ACK e reconciliação do sino | Repetição não altera indevidamente contagem ou resumo |
| F13-C3 | Teclado/mobile/erro e regressões da caixa | Permissões próprias e comportamento coletivo preservados |

Testar dois avisos, repetição, polling concorrente, erro, sessão expirada e IDs de outra caixa. Não ampliar o contrato existente se a API já satisfizer. D13: ratificar ação individual explícita, sem leitura automática por abertura.

## 26. C2-F14 — Prévia de recibos e declarações

### Objetivo e escopo

Conferir conteúdo, consulta, paciente e valores autorizados antes de emitir um documento definitivo, reaproveitando o padrão de prévia já existente para encaminhamento.

Fonte: `components/pacientes/aba-documentos.tsx`, serviço de documentos clínicos e geração/assinatura já existentes. Não construir um segundo gerador de documentos.

- Primeira entrega: declaração de comparecimento e recibo de consulta.
- Prévia deve representar o conteúdo efetivo da emissão, não um exemplo genérico do modelo.
- Não emitir documento, reservar numeração definitiva ou enviar email simplesmente ao abrir a prévia, salvo contrato existente expressamente aprovado em contrário.
- Confirmar emissão explicitamente; se consulta, pagamento, modelo ou dados relevantes mudarem, exigir nova conferência.
- Reutilizar fingerprint/revisão e idempotência, quando adequados ao tipo de documento.
- Preservar documentos emitidos, suas fontes e autorizações; prévia não reescreve versões anteriores.
- Não criar URLs públicas ou armazenamento persistente de PDFs temporários por conveniência.

### PR e commits — C2-14

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F14-C1 | Contrato e RED/GREEN da prévia dos dois tipos | Nenhuma emissão/envio ou alteração financeira pela prévia |
| F14-C2 | Conferência e confirmação ligadas à revisão correta | Mudança relevante invalida prévia anterior |
| F14-C3 | Persistência/idempotência, autorização e PDF real | Retry não emite duplicado; conteúdo confirmado é o emitido |
| F14-C4 | Interface/UX e regressão de encaminhamento/emissão | Fluxos antigos e documentos históricos preservados |

Testar prévia cancelada, valor alterado, pagamento revogado, modelo revisado, paciente/tenant incorretos e falha entre confirmação/persistência. Acessibilidade da prévia e do documento exige evidências próprias.

D14: aprovar tipos, necessidade de confirmação e regras de numeração conforme contrato jurídico/operacional vigente. Incompatibilidade legal ou assinatura nova não deve ser resolvida silenciosamente nesta fase.

## 27. C2-F15 — Nome amigável de anexo

### Objetivo e escopo

Permitir identificar “Exames — novembro” sem depender apenas de `scan_0042.pdf`.

Fonte: seção de anexos em `components/pacientes/prontuario-paciente.tsx` e módulo de mídia. A lista inspecionada oferece abrir/excluir, sem editar título de apresentação.

- Acrescentar ou reaproveitar título de apresentação autorizado, preservando nome original quando necessário à rastreabilidade.
- Não renomear o objeto de armazenamento, alterar bytes, checksum, documento assinado ou snapshots históricos.
- Não modificar o alcance de visualização no portal implicitamente.
- Entrada tratada como texto, com limites e validação no servidor; sem HTML livre ou interpolação de caminhos.
- Aplicar política de classificação/cifragem: um título pode conter dado clínico. Não presumir que pode ser persistido em texto aberto.
- Autorização, revisão/CAS e auditoria pertinentes devem preceder atualização.

### PR e commits — C2-15

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F15-C1 | Inventário de metadados e RED/GREEN do alias | Arquivo e identidade original permanecem intactos |
| F15-C2 | Serviço/BFF de atualização mínima autorizada | Sem entidades cruas, alteração de caminho ou permissão |
| F15-C3 | Edição, cancelar/confirmar, conflitos e regressões | Novo nome apenas após ACK atual |
| F15-C4 | RLS/segurança/UX e compatibilidade histórica | Acesso a arquivo continua independente do título |

Testar nome vazio/longo, caracteres especiais, atualização concorrente, arquivo revogado/excluído e outro paciente/tenant. Se o modelo exigir coluna nova ou mudança de cifragem, apresentar desenho antes de migration.

D15: aprovar alcance profissional/portal, limite do campo e tratamento do nome original. Recomendação: começar na apresentação profissional, sem alteração automática do conteúdo entregue ao paciente.

## 28. C2-F16 — Pesquisa e ordenação dos anexos exibidos

### Objetivo e escopo

Localizar anexos pelo nome e período e organizar a leitura por data, complementando a categoria já existente.

- Primeira entrega proposta: operar somente no conjunto autorizado já carregado, indicando “anexos exibidos”.
- Pesquisar texto literal do nome/título disponível, sem OCR ou leitura de conteúdo dos arquivos.
- Combinar categoria, nome e período; fornecer ação clara de limpar.
- Ordenação determinística por data e desempate estável; datas desconhecidas explícitas.
- Não fingir busca em todo o histórico se o leitor estiver limitado ou paginado.
- Caso a necessidade real exija busca global, planejar API/paginação própria antes de prometer alcance completo.
- Filtros em memória, sem conteúdo clínico em URL, storage ou telemetria.
- Alias da F15 é opcional; usar nome disponível quando essa fase não estiver integrada.

### PR e commits — C2-16

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F16-C1 | RED/GREEN de combinação de filtros e ordenação | Alcance e datas ausentes corretos |
| F16-C2 | Interface, contagens e limpar/foco | Categoria existente preservada, sem leitura extra de arquivo |
| F16-C3 | Browser/UX, busca vazia e contexto novo | Nenhum filtro ou resultado de outro paciente reaparece |

Testar nomes semelhantes, Unicode, data ausente, empate, alteração de paciente e lista parcialmente carregada. Aceite: resultados coerentes com o alcance declarado; abrir/excluir/autorizar arquivos não muda.

D16: confirmar primeira entrega restrita aos exibidos e comportamento dos anexos sem data ao aplicar período.

## 29. C2-F17 — Navegação ao recurso exato da notificação

### Objetivo e escopo

Ao selecionar um aviso, abrir o envio ou conversa correspondente, sem precisar procurar novamente dentro do módulo.

Fonte: `destinoNotificacao(tipo)` em `lib/notificacoes-api.ts`; a função atual retorna módulo genérico, embora o contrato possua `recursoTipo` e `recursoId`.

- Resolver destinos por allowlist de tipos suportados; não aceitar URL arbitrária da notificação.
- Reutilizar rotas e leitores existentes para o recurso exato.
- Reautorizar o recurso no destino; a notificação não funciona como capability nem comprova acesso atual.
- Acesso revogado, item inexistente ou tipo não suportado apresentam mensagem segura e retorno à caixa.
- Preservar proteção de edições não salvas ao navegar.
- Não transportar conteúdo clínico, texto livre ou tokens em query string.
- Não marcar o aviso como lido automaticamente sem uma decisão explícita; F13 permanece independente.

### PR e commits — C2-17

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F17-C1 | RED/GREEN do mapeamento seguro e resolução do alvo | Mesmo tipo pode apontar para recursos diferentes corretamente |
| F17-C2 | Integração da seleção no módulo de destino | Não abrir item de paciente/tenant sem acesso |
| F17-C3 | Contexto/erros/edições pendentes, browser e revisão | Nenhum redirecionamento externo nem exibição tardia indevida |

Testar tipos conhecidos/desconhecidos, ID adulterado, carteira transferida, recurso arquivado e retorno ao sino. Identificar quais tipos exigem mudança de navegação em módulos já em desenvolvimento e pausar somente esses itens.

D17: aprovar tipos iniciais e momento de leitura. Recomendação: iniciar por formulários respondidos e mensagens, mantendo os demais explicitamente fora do alcance até sua integração.

## 30. C2-F18 — Central de notificações com histórico paginado

### Objetivo e escopo

Consultar avisos antigos e filtrar por tipo, período e estado de leitura, sem depender do pequeno conjunto do sino.

Fontes: `sino-notificacoes.tsx`, rota de preferências e `ControladorNotificacoes`. O endpoint inspecionado recebe limite; não equivale ao contrato de histórico paginado proposto.

- Reutilizar a própria caixa, serviço e políticas de acesso; não criar uma segunda fonte de notificações.
- Paginação/ordenação no servidor e filtros aplicados visíveis.
- Contagens apenas da própria caixa e do alcance efetivo autorizado.
- Reaproveitar ação individual da F13 e navegação da F17 quando disponíveis; nenhuma dependência obriga integrar outra PR implicitamente.
- Preservar resumos e preferências; não reinterpretar contagem de resumo como notificações individuais adicionais.
- Mostrar apenas histórico realmente retido, sem prometer recuperar avisos já descartados.
- Não alterar retenção, excluir em massa, exportar ou habilitar email adicional nesta fase.

### PR e commits — C2-18

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F18-C1 | RED/GREEN de página/filtros da caixa atual | Ordenação estável, limite e escopo corretos |
| F18-C2 | API/BFF e projeção autorizada | Nenhum aviso/nome de outra caixa ou recurso não autorizado |
| F18-C3 | Central integrada, vazio/erro e navegação | Filtros/ACKs corretos e sino preservado |
| F18-C4 | Banco/segurança/browser/UX e revisão | Histórico factual, sem retenção nova implícita |

Testar empate de datas, paginação durante novos avisos, marcação concorrente, resumo lido, sessão expirada e tentativa de consultar outra caixa. D18: aprovar filtros, tratamento dos resumos e indicação do período realmente disponível.

## 31. C2-F19 — Consultas por paciente, período e status

### Objetivo e escopo

Encontrar consultas antigas ou específicas sem percorrer manualmente a agenda e sem tratar a lista limitada como todo o histórico.

Fontes: `listarConsultasAgenda` em `lib/agenda-api.ts` e `ServicoAgenda.listarConsultas`; o caminho inspecionado lê até200 a partir dos30dias anteriores.

- Definir novo contrato de consulta paginada por paciente, período e status permitidos.
- Manter leitores antigos compatíveis enquanto houver consumidores dependentes.
- Autorizar profissional/equipe e carteira antes de devolver metadados.
- Fuso clínico servidor, fim inclusivo definido e ordenação estável.
- Não incluir compromissos privados do Google como consultas pesquisáveis.
- Não criar índice de conteúdo clínico em texto aberto; pesquisa estruturada não é busca semântica.
- Preservar criação, remarcação, duplicação, pacotes e conflitos de horário existentes.
- Exportação continua com seu alcance declarado; não prometer que o CSV antigo reflete novos filtros sem implementação correspondente.

### PR C2-19A — Consulta paginada

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F19A-C1 | Contrato e RED/GREEN de período/paciente/status | Limites e ordenação conhecidos, sem query arbitrária |
| F19A-C2 | Serviço/API/BFF com autorização e cursor seguro | Nenhum dado de outra carteira/tenant |
| F19A-C3 | PostgreSQL/RLS, fronteiras temporais e desempenho | Mais de200 registros sintéticos sem falsa completude |

### PR C2-19B — Pesquisa no console

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F19B-C1 | RED/GREEN de filtros/página e alcance visível | Distinção clara entre calendário e pesquisa histórica |
| F19B-C2 | Detalhe da consulta, limpar e proteção de edição | Resposta antiga não substitui o contexto atual |
| F19B-C3 | Regressões agenda/pacotes/CSV, UX e R4 | Pesquisa pronta sem alterar regras de agendamento |

Testar horário de verão/fusos, período vazio, status inválido, empate, exclusão/revogação entre páginas e edição aberta. D19: ratificar filtros, tamanho padrão e relação com exportação. Mudança de índice/migration, se necessária, exige justificativa e ensaio descartável.

## 32. C2-F20 — Adicionar consulta ao calendário por arquivo `.ics`

### Objetivo e escopo

Baixar um arquivo da consulta autorizada e importá-lo voluntariamente no calendário do dispositivo, sem configurar nova integração paga.

A pesquisa não localizou geração iCalendar nos módulos consultados. Reconfirmar nomenclaturas e PRs antes de criar novo exportador; integração Google existente não é substituída.

- Ação explícita de download, sem criar compromisso por API externa ou mandar convite automático.
- Recomendação de conteúdo mínimo: título genérico, início/fim/fuso e local/link somente quando já autorizados e aprovados para esse uso.
- Não incluir nome do paciente, prontuário, condição clínica, tokens ou descrições livres por padrão.
- Arquivo representa o horário conferido no momento do download; não prometer sincronização de mudanças posteriores.
- Formato válido, escapes/linhas/fusos corretos e identificador estável não sensível.
- Exportação autorizada no backend e sem URL pública persistente.
- Definir política de consulta cancelada; não enviar cancelamento a calendários externos implicitamente.
- Compatibilidade real de importação em Apple/Outlook/Google deve ser testada separadamente quando houver ambiente, não presumida pela extensão.

### PR e commits — C2-20

| Commit | Trabalho | Aceite do incremento |
| --- | --- | --- |
| F20-C1 | RED/GREEN do formato determinístico e campos mínimos | Datas/fuso/escapes válidos, sem dados clínicos adicionais |
| F20-C2 | Download privado autorizado e tratamento do status | Sem exportar consulta de outro usuário/paciente |
| F20-C3 | Ação de interface, contexto e aviso sobre sincronização | Download apenas por ação explícita |
| F20-C4 | Segurança, browser e importação disponível | Evidências reais por cliente; demais SKIPPED com motivo |

D20: aprovar público inicial (profissional/paciente), campos, tratamento de canceladas e exportação para dispositivo pessoal. É novo uso de dados: não considerar implicitamente autorizado só por existir agenda interna.

## 33. Decisões complementares e critérios compartilhados

| Decisão | Assunto | Proposta inicial, ainda não aprovada |
| --- | --- | --- |
| D11 | Texto não salvo entre conversas | Rascunho em memória por conversa, proteção na saída |
| D12 | Alcance/duração da ocultação financeira | Agenda/pacotes de leitura, preferência da sessão |
| D13 | Leitura individual | Ação explícita sem leitura automática ao abrir |
| D14 | Prévia de documentos e numeração | Declaração/recibo, confirmação e contrato vigente preservados |
| D15 | Alias de anexo e portal | Apresentação profissional primeiro, original preservado |
| D16 | Alcance da busca de anexos | Inicialmente anexos exibidos, datas desconhecidas explícitas |
| D17 | Tipos de destino de notificação | Formulário respondido/mensagem primeiro; reautorizar no alvo |
| D18 | Histórico e resumos | Caixa própria paginada; sem mudar retenção |
| D19 | Filtros e exportação de consultas | Pesquisa estruturada, alcance do CSV independente e explícito |
| D20 | Calendário do dispositivo | Download privado e mínimo, sem sincronização automática |

As aprovações de regras de autenticação do pacote original não autorizam mudanças nos documentos, finanças, mídia ou calendário. Nenhuma referência de decisão D11–D20 substitui políticas anteriores D01–D20 de outros módulos; o namespace deste documento é C2.

## 34. Dependências e prioridades do complemento

| Dependência | Fases | Condição de liberação |
| --- | --- | --- |
| DEP-10 — conversa e ACK atuais | F11 | Identidade da conversa/contato/paciente e notas anteriores preservadas |
| DEP-11 — superfícies financeiras | F12/F14 | Permissões e finalidade da apresentação/exportação comprovadas |
| DEP-12 — caixa e recurso autorizado | F13/F17/F18 | Dono da caixa e acesso ao alvo tratados como verificações distintas |
| DEP-13 — emissão fiel ao modelo | F14 | Preview/confirmar/persistir na revisão correta e sem duplicação |
| DEP-14 — metadados e acesso a mídia | F15/F16 | Alias/filtro não alteram arquivo, autorização ou snapshot |
| DEP-15 — consulta histórica paginada | F19 | Contrato real substitui a impressão de completude do limite200 |
| DEP-16 — exportação para calendário | F20 | Aprovação do uso/campos, privacidade e teste do formato |

F11/F12/F13 são a primeira recomendação deste complemento; isso não autoriza implementá-las. Superfícies no contêiner do prontuário exigem reserva de arquivos e verificação do trabalho do Claude antes de qualquer edição.

Prioridade pode mudar diante de defeito reproduzido de integridade/segurança; não classificar hipótese de associação errada como incidente comprovado sem reprodução. Preferências estéticas não são bloqueios críticos.

## 35. Estado consolidado e próxima aprovação

O planejamento original contém 20 fases: C2-F01–C2-F10 originais e C2-F11–C2-F20 complementares, com previsão condicional de25PRs. Este era o estado no planejamento original. O estado vigente de execução está em execucao-ciclo2.md; criação do planejamento não comprova implementação ou testes.

Para execução futura, usar uma PR Draft por incremento real, com escopo, base e evidência próprios. Não misturar este novo planejamento com correções das PRs #584–#592 nem adicionar funcionalidades a elas.

Próxima decisão recomendada: escolher o primeiro pacote delimitado entre F01/F02 (login/MFA) e F11/F12/F13 (notas/privacidade visual/notificações). Contratos de maior impacto ficam sujeitos às decisões detalhadas de cada fase. Nenhuma alteração de main, deploy, migration externa ou configuração de produção está autorizada por esta documentação.
