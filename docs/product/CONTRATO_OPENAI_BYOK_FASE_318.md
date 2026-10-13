# Fase318 — contrato técnico proposto de OpenAI com chave individual

Status: planejamento consolidado, não API implementada. D01–07 confirmadas
pelo proprietário; qualidade clínica, condições contratuais e operação ainda
não aprovadas. Endpoint, schema e numeração devem ser reconferidos antes do RED.
Este documento não habilita chamadas reais nem altera o contrato de IA legado.

## 1. Produto e fronteiras

- Pré-consulta e rascunho de evolução; fontes mínimas selecionadas pelo próprio
  responsável atual, sem envio de cadastro identificável desnecessário.
- Chave OpenAI individual; consumo na conta do profissional; habilitação pela
  clínica. Gestor habilita a função, não acessa chave/conteúdo e não age em nome
  do paciente/profissional. SuperAdmin não usa a chave em impersonação.
- Modelo escolhido em catálogo permitido, padrão econômico; preço/modelo/versão
  verificados antes de inclusão. Escolha não prova adequação clínica de cada modelo.
- Rascunho somente em memória da tela; sair, logout, troca de paciente e resposta
  obsoleta limpam o contexto. Sem localStorage, sessionStorage, IndexedDB,
  service worker, cache persistente, banco de rascunhos ou reabertura posterior.
- Somente a evolução conferida/confirmada entra no histórico privado/cifrado.
  Confirmar não é assinatura digital nem envio ao portal.

## 2. Rotas propostas e autorização no serviço

| Método/rota backend | Entrada | Saída allowlist / regra |
| --- | --- | --- |
| GET `/ia/credencial-openai` | sessão | `{estado,versao}`; não chave, ciphertext, prefixo, hash ou entidadeORM |
| PUT `/ia/credencial-openai` | `{chave,versaoEsperada}` | `{estado,versao}`; cadastro/substituição atômicos, sem teste pago implícito |
| DELETE `/ia/credencial-openai` | `{versaoEsperada}` | remover segredo local/incrementar versão; não revoga automaticamente na OpenAI |
| GET `/ia/modelos-clinicos` | sessão | IDs permitidos, padrão, limites e referência datada de preço; sem chave/conta/saldo |
| POST `/ia/pacientes/:id/sintese-pre-consulta` | `{chaveComando,modeloId,selecoes}` | prévia `{modalidade,itens,limitacoes,cobertura,modeloId,versaoModelo,provaRevisao,expiraEm}` |
| POST `/ia/pacientes/:id/rascunho-evolucao` | `{chaveComando,modeloId,selecoes,textoProfissional}` | mesmo envelope com texto editável, sempre revisão pendente |
| POST `/ia/pacientes/:id/rascunho-evolucao/confirmacao` | `{chaveComando,provaRevisao,titulo,conteudo,tipo,consultaId?,confirmado:true}` | DTO privado de evolução existente; atomicidade/replay definidos abaixo |

Professional + `ia.executar`; acesso ao contexto/confirmar também exige
`pacientes.gerenciar`, perfil ativo e responsabilidade atual. Identidade e tenant
vêm da sessão; não receber tenantId/profissionalId/URL/baseURL/chave no pedido de
geração. As seleções são IDs dos tipos permitidos e o backend busca/autoriza cada
fonte do mesmo paciente. TextoProfissional é texto escrito/selecionado pelo
profissional, não prontuário enviado cru pelo navegador.

Configuração da clínica: reusar `tenant_configuracoes` e o padrão administrativo
existente, com chave318 própria/versionada. Client só própria clínica com
`cliente.configuracoes.gerenciar`; SuperAdmin configura pelo escopo operacional
existente, sem leitura clínica. CAS na configuração; default false. Gate
operacional318 literal aprovado separadamente. A configuração318 não modifica
`ia.clinica`, mobile ou gamificação, e o gate legado não libera318.
Gestão/revogação da chave deve continuar disponível com geração desabilitada.

BFF replica apenas esses DTOs, wrappers de sessão/origem e `private,no-store`
inclusive erros. Nenhuma credencial em ClientComponent fora do campo transitório
necessário ao cadastro HTTPS; limpar campo após envio/cancelamento. Não retornar
Bearer, token de sessão, erro de fornecedor ou segredo em validação de DTO.

## 3. Dados e migration mínima candidata

Não criar tabela de rascunhos. Uma credencial cifrada por tenant/profissional,
com versão monotônica e timestamps estritamente necessários, requer storage
privado próprio: não gravar segredo em JSON de configuração da clínica.
Usar criptografia existente, contexto autenticado no payload e rotação aprovada;
segredo apenas descriptografado no backend durante requisição autorizada.

Migration aditiva somente na implementação autorizada, com número disponível
verificado. Candidatos: credencial318, ledger de comando318, provenance confirmada
e versão monotônica do vínculo clínico (caso não exista mecanismo canônico).
Conferir cada necessidade; não criar todas por automatismo, não editar1070.
Ledger de geração guarda estado técnico/custo conhecido, não prompt/rascunho em
claro nem histórico completo; resultado textual não deve se tornar draft persistido.
Nonce de geração repetido não faz nova chamada: retorna estado técnico ou
conflito sanitizado; não recupera texto perdido por recarregar/sair, pois não há
rascunho persistido. Nova geração exige nova ação explícita/novo nonce e informa
possível cobrança anterior. Definir expiração de dados operacionais sem apagar
controle necessário contra replay; não confundir tombstone mínimo com draft.
Ledger de confirmação guarda referência da evolução e fingerprint cifrado.

`ExecutorTenant` atual configura `app.tenant_id`, não `app.usuario_id`.
FORCE RLS prova isolamento de tenant; escopo do profissional exige autorização
explícita no serviço/queries e teste negativo. Não declarar RLS por profissional
se a policy não o implementar. DTOs mínimos devem ser comparados com JSON real.

Provenance aceita deve registrar modelo/versão, política/prompt, fonte/data e
limitação de cobertura; registros sensíveis cifrados e sem recálculo histórico.
Definir com a equipe o snapshot mínimo necessário: não duplicar prontuário inteiro
nem prometer regeneração idêntica de modelo remoto. Rascunho descartado não ganha
retenção90dias por analogia com a comunidade.

## 4. Geração, inferência e resposta obsoleta

1. Transação curta: autorizar sessão/ator/perfil/paciente/gates, ler chave/modelo
   permitidos, selecionar fontes e reivindicar nonce/quota. Capturar versões de
   vínculo, chave, configuração, fontes, prompt/modelo; encerrar transação.
2. Adaptador Nest chama exclusivamente `https://api.openai.com/v1/responses` com
   Bearer individual. Nunca repassar segredo ao FastAPI legado. Sem redirects,
   URL variável, tools, browsing, files, conversation/previous_response_id,
   background ou armazenamento de estado deliberado; propor `store:false`.
   Conferir suporte do endpoint/modelo escolhido, não simular compatibilidade.
3. Schema de saída fechado/estrito; limite de bytes durante leitura512KiB,
   entrada12.000caracteres/20fontes e texto6000. `max_output_tokens` explícito por
   catálogo, incluindo overhead/raciocínio quando aplicável; rejeitar incomplete,
   refusal como geração clínica e referências inexistentes. Validar localmente
   mesmo com Structured Outputs; formato correto não prova fidelidade clínica.
4. Timeout de geração proposto30s, máximo60s pelo contrato existente de IA;
   mudança não altera timeout do legado. Abort/timeout não garante estorno ou
   cancelamento do processamento remoto. Marcar resultado incerto sem retry pago
   automático; usuário recebe mensagem sanitizada e preserva edição manual.
5. Nova transação curta revalida todos os estados e versões. Não retornar texto
   após revogação, transferência, arquivamento, troca de chave/gate/sessão/fontes.
   A→B→A deve mudar geração mesmo quando o ID atual volta a ser igual. Não usar
   somente comparação de valor final ou cron para autorizar retorno.
6. Emissão de provaRevisao selada, com vínculo ao ator/tenant/paciente/fontes/
   versões/resultado e TTL proposto15min. Prova não é credencial de autenticação;
   cada uso exige sessão e autorização vigentes. Só no body/memória, nunca URL/log.
   Definir fingerprint/contexto formal antes da implementação e testar alterações.

## 5. Confirmação e idempotência

Pré-consulta é leitura auxiliar e não é salva como evolução automaticamente.
Evolução: profissional pode editar título/conteúdo, confere e confirma, usando
nonce diferente da geração. Validar TTL/prova/contexto/ator e campos existentes
(título180, conteúdo3–6000, tipo permitido, privada, consulta do mesmo paciente).
Não exigir que texto final seja idêntico ao gerado: editar é parte da revisão.

Construção clínica e ledger de confirmação na mesma transação; extrair/reusar
helper transacional do fluxo manual, sem chamar serviço que abre segunda transação.
Unique de nonce escopado, fingerprint cifrado e ponteiro garantem uma evolução
para confirmações concorrentes. Retry idêntico só devolve resultado depois de
revalidar a autorização/contexto; pedido diferente409. Se a primeira confirmação
já persistiu, expiração da prévia não duplica o registro: revalidar o ator e
retornar referência autorizada conforme política de replay, não recriar conteúdo.
Não usar tratamento de23505 dentro de transação abortada sem desenho correto.

PUT da chave usa CAS e substituição, não leitura de volta do segredo. Remoção
local limpa ciphertext operacional; backups/rotação seguem política aprovada.
A chave externa continua válida até o titular revogar no fornecedor. Mostrar essa
distinção na gestão, sem pedir privilégios administrativos da conta OpenAI.

## 6. Consumo, erros e revisão

Catálogo versionado define modelo, limite de tokens, preço datado e parâmetros
suportados. Não aceitar modelo arbitrário, organização/baseURL/limites do browser.
Quotas propostas: até5gerações/15min por profissional e1em andamento, ajustáveis
pela clínica dentro dos limites técnicos. Reservar quota antes da chamada, reconciliar
uso conhecido; chamada incerta mantém reserva até resolução/política definida.
Preço estimado não é fatura do fornecedor; nenhum gasto real autorizado nesta etapa.

Classificar401,403,429 quota/saldo/rate limit, timeout,5xx,refusal,incomplete e
schema inválido em erros sanitizados. Não expor corpo/chave/conta/prompt/texto ou
stack. API usage e dados financeiros não entram em logs/auditoria identificável;
telemetria somente agregada/minimizada conforme política vigente.

Revisão humana dos30casos pelo proprietário/equipe foi assumida, não executada.
CorpusREV0 em CORPUS_REVISAO_FASE_318.md. G01 valor e G02 direitos/privacidade/
qualidade continuamBLOCKED; permissões de produto não os marcamPASS.

## 8. Contrato técnico concretizado em2026-10-13

Endpoints e limites efetivos: seção10 do PLANO_FASE_318.md. Prova cifrada inclui
ator/tenant/paciente/sessão/gerações, fonte/data/hash, modelo/política e digest da
saída. Não é autenticação. Proveniência não duplica as fontes ou o rascunho bruto:
registra os digests e versões, junto da evolução humana aceita cifrada. Permite
rastrear a operação; não promete regenerar texto idêntico de um modelo remoto.

Retenção da proveniência segue o prontuário; trigger bloqueia escrita/remoção
pela role runtime. Rollback com dados é recusado. Revogação da credencial remove
somente a cópia ativa no OctaClin; backups/WAL e revogação no fornecedor exigem a
política operacional aprovada. Nenhum prazo jurídico é presumido para o ledger.
Termos, retenção, custódia BYOK e política de expurgo continuam requisitos G02/G05
antes do piloto. Não herdar90dias da comunidade ou consentimentos de outra fase.

Correlações de sessão: modelos retorna `contextoSessao`, digest de
ator/tenant/sessão verificados. Cadastro e remoção enviam esse marcador e CAS;
marcador não autentica ninguém. A tela revalida antes/depois da geração e ao
recuperar foco; troca de sessão descarta texto/fontes. Cifra da chave também se
vincula ao usuário. Corpo do BFF limitado durante o streaming (128KiB,2KiB em
operações administrativas), sem confiar somente em Content-Length.

Operação futura: desligar a configuração versionada de cada clínica antes de
retirar a variável operacional/reiniciar processos. Reativação usa novo CAS;
variável de processo isolada não substitui revogação transacional na base.
Status/ciclo de vida/encerramento da clínica também invalidam previews por geração
monotônica. ProvasPG e revisão do HEAD permanecem requisitos independentes.

### Correções da revisão de sessão

A geração, a captura de fontes (POST com corpo, sem correlação em URL), a
configuração Client/SuperAdmin e as mutações de credencial exigem
`contextoSessao` correspondente ao ator/tenant/SID verificado no backend.
A comparação precede leitura de fontes, reserva de nonce/quota e envio externo.
O precheck da UI é auxiliar: não substitui essa comparação transacional.
GET de configuração devolve o marcador; mudança de sessão ao recuperar foco
invalida a tela. A confirmação permanece vinculada à sessão pela prova selada.
