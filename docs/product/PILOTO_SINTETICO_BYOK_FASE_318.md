# Fase 318 — piloto BYOK sintético e alternativas ChatGPT

## Autorizações e estado observável — 2026-10-13

Base inspecionada: main4aeb529707416142f839a18374e349a2eed39384, merge408.
O proprietário informa migration1071 validada em staging e produção. Verificação
independente por leitura de migrations/pg_catalog confirmou registro1071, quatro
colunas de geração, três tabelas com ENABLE/FORCE RLS e NULLIF em USING/WITH CHECK
nos dois alvos previamente identificados. Nenhuma linha clínica consultada.
A consulta usou role administrativa; existência de roles runtime sem BYPASSRLS
não prova qual role a conexão do backend efetivamente usa. Essa configuração
continua exigindo evidência operacional, sem expor connection strings/secrets.

O proprietário autorizou revisão no sistema exclusivamente com dados sintéticos,
cadastro independente de chave própria e escolha de modelo. Optou por manter
BYOK na318 e estudar ChatGPT/MCP separadamente. A identidade do profissional foi
indicada; o vínculo operacional deve usar IDs de usuário/profissional/tenant
verificados, sem versionar dados pessoais. Não inferir homônimo pelo nome.

O campo de chave já existe em Integrações. O código integrado ainda tem catálogo
clínico vazio e direitos BYOK false. Cadastro/geração continuam bloqueados.
Esta revisão não os transforma em aprovação contratual nem habilita o sistema.
Nenhuma chave criada, chamada paga, configuração alterada ou deploy executado.

## Contrato mínimo do piloto — requisito para implementação

1. Área explícita de revisão sintética para profissional autorizado, com sessão,
   perfil ativo, tenant e acesso ao piloto revalidados no backend em toda ação.
2. Fontes exclusivamente de corpus sintético versionado no servidor. Receber ID
   de caso conhecido, modalidade, modelo permitido e nonce; não aceitar pacienteId,
   prontuário, upload, contexto clínico arbitrário ou texto livre como entrada.
   Um checkbox “sintético” ou o nome do paciente não prova essa condição.
3. Nenhum acesso aos repositórios clínicos para preparar fontes do piloto. Não
   registrar a saída de teste no prontuário nem reutilizar confirmação clínica.
   Resultados e revisão ficam efêmeros; evidências compartilhadas são sintéticas.
4. Reutilizar adapter fixo, validação local de saída, scopes de cifra, guards,
   auditoria mínima e controles de sessão existentes. Não ligar globalmente os
   direitos/catálogo clínicos para permitir um usuário de teste.
5. Credencial cadastrada pelo titular na UI, enviada por HTTPS e cifrada no
   backend. Nunca em URL, leitura API, telemetria ou app de terceiros desta conversa.
   Chave de projeto separada recomendada. Remoção local não revoga o fornecedor.
6. Escolha independente dentro de catálogo compatível e verificado, com modelo/
   versão, preço datado, limites e capacidades. Não aceitar URL/modelId arbitrário
   ou assumir que todo modelo listado pela conta suporta o contrato da318.
7. Nonce, quota, concorrência, cancelamento e cobrança incerta precisam de prova
   própria no modo sintético. Ledger clínico318 exige pacienteId: não criar paciente
   fictício em produção só para contornar essa FK nem tornar a coluna nullable sem
   revisão de contrato/migration. Avaliar controles operacionais existentes antes
   de adicionar schema; nenhuma alteração ad hoc autorizada por este documento.
8. UI informa API cobrada pela OpenAI, revisão pendente, referência das fontes e
   limitações; não produz diagnósticos/prescrições. Sem retries pagos automáticos.
9. Cadastro da chave para piloto exige termos específicos de custódia, finalidade,
   revogação, retenção e tratamento de incidentes. Permissão de produto não prova
   direitos de uso/compliance. Revisão factual pode fundamentar o aceite humano;
   o agente não ratifica requisitos jurídicos inexistentes.
10. Liberação operacional só para o alvo comprovado, após testes negativos,
    regressões, CI, termos/condições do fornecedor e autorização correspondentes.
    G01 clínico segue pendente da revisão efetiva dos30casos; dados reais bloqueados.

## Validações necessárias com Sol6.1 médio

- Confirmar runtime sem BYPASSRLS, grants1071, sessão/carteira/transferência A→B→A.
- TDD: negar outro tenant/profissional/SID, acesso revogado, IDs de pacientes reais,
  payload extra/texto livre, modelos/URLs arbitrários, replay e quota/concorrrência.
- Verificar custódia/rotação e exclusão de secrets em erros/logs/respostas/cache.
- Confirmar que piloto não altera gates clínicos, portal, prontuário ou outros usuários.
- Corpus executável30casos com fatos, negação, unidades, omissões e rubrica para
  revisão humana. O corpus atual de descrições não equivale a oráculo clínico pronto.
- Tarifas/capacidades oficiais por modelo, custo/limites visíveis e consentimento
  antes da geração. Budget de fornecedor não é presumido como bloqueio rígido.
- PostgreSQL/Redis descartáveis conforme mecanismo escolhido, BFF, UI/axe, CI e
  revisão R4 declarando autoria. Nenhum teste clínico real executado nesta etapa.

Luna alto poderá cuidar de UI/fixtures quando os contratos estiverem fechados.
Avisar e pausar para troca manual; não delegar engenharia de auth/crypto/replay ao
Luna como forma de substituir revisão. Nenhuma troca ocorreu nesta revisão.

## ChatGPT sem chamadas do OctaClin à API OpenAI

A documentação oficial descreve conexão de MCP server/ferramentas à interface
ChatGPT e autenticação OAuth2.1 com tokens/audience/scopes. Nesse desenho o
profissional conversa no ChatGPT; o OctaClin autoriza ferramentas e dados mínimos.
O server não precisa chamar o modelo por API se a geração ocorrer no ChatGPT.
Isso não torna a assinatura ChatGPT um crédito da API e não cria inferência
invisível/automática dentro do console. Plano, disponibilidade, limites, contratos
ChatGPT e hospedagem do MCP continuam requisitos próprios.

Seria uma integração distinta, com delegação, PKCE, consentimento, tenant/carteira,
revalidação, minimização de dados e confirmação humana. Não substituir nem habilitar
BYOK nesta rodada. Nenhuma sessão/cookie ChatGPT será usada como credencial backend.
Não implementar MCP ou transferir dados reais sem escopo/revisão próprios.

## Fontes públicas verificadas nesta rodada

- https://developers.openai.com/apps-sdk/quickstart.md — HTTP/status 200; SHA256 resposta `35cedb792932175d568af4d57fa5b5ca5b7b5383ab6bfdd5ee3d1d60b877264e`.
- https://developers.openai.com/apps-sdk/build/auth.md — HTTP/status 200; SHA256 resposta `d6c994c0f628f73eacfbe2d7bd59e1df590f8263a36d62e3df823e76bd4fe345`.
- https://openai.com/policies/services-agreement/ — HTTP/status 200; SHA256 resposta `8c3ff4a28d944dc78ac80dab78ec7487b456cfe237bea61d353c7541ed4d0330`.
- https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api — HTTP/status 200; SHA256 resposta `f586252f21fbea8037ff16564bbc3fabdb084134679c2af6c6e7d7570455711a`.

## Continuidade após merge409

O proprietário informou o merge409 e forneceu os três IDs do alvo por canal da
sessão. Não versionar nem publicar esses IDs. O backend verificará o vínculo
atual, papel/permissões e SID contra o banco, sem inferir identidade pelo nome.
A entrega técnica inclui corpus executável30casos, prévia/composição factual,
comparação OpenAI isolada, cadastro do titular no piloto e revisão efêmera.
Grant específico e flag sintética desativados por padrão; nenhum foi aplicado.
Direitos clínicos e sintéticos continuam false. Catálogo clínico continua vazio.
Os dois candidatos técnicos sintéticos não são aprovação assistencial.

Quota sintética usa metadados limitados na tabela tenant_configuracoes, separados
por tenant/ator e pelo advisory lock já usado no contexto318. Somente nonce e
instante/cooldown; nenhuma chave, saída, nota ou pacienteId. Prova15min e nonce
retido24h impedem repetição paga;5chamadas/15min/cooldown2min. Entradas antigas são
expurgadas no próximo uso; o último registro operacional permanece até a limpeza
administrativa, sem prometer TTL físico da tabela. Isso não substitui a auditoria.
Não há nova migration nem mudança na FK do ledger clínico1071.

[Termo proposto e gates separados](TERMO_PILOTO_SINTETICO_BYOK_FASE_318.md).
[Execução, evidências e rollback](../history/phases/reviews/fase-318/PILOTO_SINTETICO_EXECUCAO.md).
