# API e handoff de interface — Fase 317

Contrato observado no backend desta branch, não autorização de piloto.
Fontes executáveis: `controladores-piloto.ts`, `controlador-configuracao-piloto.ts`,
`dtos-piloto.ts` e serviços do módulo existente. Reconferir esses arquivos ao
implementar BFF. Não usar rotas legadas para recursos do modelo317.

## Invariantes para BFF e interface

- Tenant/identidade vêm da sessão verificada; Patient nunca envia pacienteId,
  autor, tenant, estado de publicação ou consentimento em nome de outra pessoa.
- Console profissional: Professional + gamificacao.gerenciar + pacientes.gerenciar,
  profissional atual da carteira. Client/SuperAdmin configuram, não atuam como
  profissionais. Portal: Patient próprio, adulto, vínculo/aceite atuais.
- Só `GAMIFICACAO_PILOTO_OPERACAO_APROVADA=true` permite habilitar flags317.
  Todas são false inicialmente. Flag legada não habilita o piloto.
- Toda mutação clínica/comunitária recebe `chave` UUID e `versaoEsperada` inteiro.
  Versão inicial0. Retry idêntico mantém chave/corpo; alteração inicia outra chave.
  Registro expirado continua como tombstone e rejeita replay. Não guardar conteúdo,
  IDs clínicos ou nomes em localStorage, sessionStorage, service worker ou analytics.
- Configuração administrativa usa CAS de versão; retry com versão antiga409, sem
  segundo efeito. É a exceção ao ledger clínico, não confirmação de consentimento.
- Respostas paginadas `{itens,temMais,proximoCursor?}`:20 itens, cursor opaco e
  vinculado ao contexto. Nunca criar paginação por offset ou interpretar cursor.
- Usar no-store tanto na requisição backend quanto na resposta BFF. Aplicar
  allowlist real de saída; tipos TS não removem propriedades. Sanitizar erros.
- Texto puro, escapado; sem HTML, SVG vindo do usuário, Markdown, autolink, foto,
  anexos, DM, ranking, pontos, lista geral de membros ou conquistas de terceiros.
- Nomes de quem curtiu são visíveis por decisão D10, somente aos autorizados.
  Feed/lista de curtidas nunca inclui pacienteId/usuarioId ou cadastro clínico.
- Datas HTTP são ISO; não usar relógio do navegador como autoridade de elegibilidade.
-403 não é ausência de progresso.409 pede atualização/conferência;429 pede aguardar.
 401 segue o fluxo atual de sessão. Não repetir automaticamente uma mutação com nova chave.

## Console profissional — prefixo `gamificacao/piloto`

| Método / caminho | Entrada e versão | Saída principal |
| --- | --- | --- |
| GET pacientes/:pacienteId/conquistas | cursor opcional | snapshots privados paginados |
| POST pacientes/:pacienteId/conquistas | comando; título120, descrição1000 opcional, ícone interno; versão0 | id, versão1, compartilhadofalse |
| PATCH pacientes/:pacienteId/conquistas/:conquistaId/compartilhamento | comando; compartilhado boolean; versão da concessão | id, versão, geração, compartilhado |
| GET circulos | cursor | id/nome/objetivo/estado/versão; sem roster |
| POST circulos | comando; nome/objetivo1–160; versão0 | id/versão1/estadoativo |
| GET circulos/:circuloId/convites/:pacienteId | paciente selecionado da própria carteira | estado/versão/geração/expiraEm; versão0 se ausente |
| POST circulos/:circuloId/convites/:pacienteId | comando; versão **da participação**, não do círculo | geração/versão/expiraEm; convite7dias |
| POST circulos/:circuloId/convites/:pacienteId/revogacao | comando; versão da participação | estado revogado; conteúdo ocultado |
| POST circulos/:circuloId/encerramento | comando; versão do círculo | estado encerrado |
| GET circulos/:circuloId/publicacoes | cursor | feed permitido |
| GET circulos/:circuloId/publicacoes/:postId/comentarios | cursor | comentários permitidos |
| GET circulos/:circuloId/publicacoes/:postId/curtidas | cursor | nomes de exibição apenas |
| GET circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/curtidas | cursor | nomes de exibição apenas |
| POST circulos/:circuloId/publicacoes/:postId/retirada | comando; versão do post | retirada; filhos ocultados |
| POST circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/retirada | comando; versão do comentário | retirada |
| GET circulos/:circuloId/denuncias | cursor | evidência privada, estado/versão/prazo; apenas carteira atual |
| POST circulos/:circuloId/denuncias/:denunciaId/decisao | comando; retirar boolean, justificativa1–1000; versão da denúncia | estado/versão; decisão cifrada |

Não há publicação do profissional em nome do paciente. Selecionar pacientes
pelos mecanismos existentes autorizados; consulta individual de convite fornece
versão atual sem introduzir roster público. Confirmação explícita antes de
compartilhar, reinvitar/revogar ou encerrar. Ícones: award, heart, book, calendar, check.

## Portal — prefixo `portal/paciente/gamificacao-piloto`

| Método / caminho | Entrada e versão | Saída principal |
| --- | --- | --- |
| GET conquistas | cursor | compartilhamentos atuais; sem título/descrição antes do aceite |
| POST conquistas/:conquistaId/consentimento | comando; aceitar, geração>=1, termoVersao317-conquistas-v1; versão do consentimento,0 se ausente | id/aceito/geração/consentimentoVersao |
| GET circulos | cursor | próprios convites válidos/participações; metadados e versão da participação |
| POST circulos/:circuloId/aceite | comando; geração, termoVersao317-comunidade-v1, nomeExibicao1–80; versão da participação | estado ativo/versão/geração |
| POST circulos/:circuloId/saida | comando; versão da participação | saída; publicações/interações ocultadas |
| GET privacidade/conquistas | cursor | IDs/gerações/versões/estado dos próprios aceites; nunca texto |
| GET privacidade/circulos | cursor | IDs/gerações/versões/estado das próprias participações; nunca nomes |
| GET circulos/:circuloId/publicacoes | cursor | id/texto/autor confirmado/data/versão/próprio/reacoes{total,curti} |
| POST circulos/:circuloId/publicacoes | comando; texto1–2000; versão0 | id/versão1/publicado imediatamente |
| PATCH circulos/:circuloId/publicacoes/:postId | comando; texto; versão do post | edição com nova revisão |
| POST circulos/:circuloId/publicacoes/:postId/retirada | comando; versão do post | retirada do próprio conteúdo |
| GET circulos/:circuloId/publicacoes/:postId/comentarios | cursor | projeção equivalente ao post |
| POST circulos/:circuloId/publicacoes/:postId/comentarios | comando; texto1–500; versão0 | id/versão1/publicado |
| PATCH circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId | comando; texto1–500; versão do comentário | edição do próprio comentário |
| POST circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/retirada | comando; versão do comentário | retirada |
| POST .../:postId/curtidas ou .../:postId/comentarios/:comentarioId/curtidas | comando; curti boolean; versão **do conteúdo alvo** | definição explícita, nunca toggle |
| GET .../:postId/curtidas ou .../:postId/comentarios/:comentarioId/curtidas | cursor | lista paginada de nomes confirmados |
| POST .../:postId/denuncias ou .../:postId/comentarios/:comentarioId/denuncias | comando; motivo1–1000; versão do alvo | protocolo privado sem evidência na resposta |

Consentimento específico, nome confirmado e advertência de identificação antes
DO aceite. Mostrar o texto proposto do contrato, sujeito ao gate operacional de
revisão. Denúncia não retira automaticamente por contagem; profissional revisa.
Privacidade/revogação funciona com flags desligadas e mudança de DOB/vínculo,
respeitando a autenticação/tenant existentes. Não esconder o painel de revogação
junto com o feed. Consentimentos de gerações anteriores também podem ser revogados.
Quotas por usuário/minuto:10 criações/edições de conteúdo,30 reações,5 denúncias.
Saída/revogação não usa essas quotas. Nova adesão não republica conteúdo anterior.

## Configuração administrativa

- Client próprio: GET/PATCH `cliente/configuracoes/gamificacao-piloto`.
- Portal do Client: `/cliente/gamificacao-piloto`, acessível apenas dentro da
  área administrativa da conta. Lista GET
  `cliente/configuracoes/gamificacao-piloto/denuncias-retencao` é exclusiva do
  Client da própria clínica, paginada por cursor cifrado e vinculado ao tenant,
  `no-store`, e projeta somente id/versão/prazo ordinário/data do hold registrado; nunca
  evidência, texto, autor ou justificativa.
- SuperAdmin: GET/PATCH `operacoes/tenants/:tenantId/gamificacao-piloto`.
- PATCH: conquistas/comunidade booleans e versaoEsperada. Resposta:
  conquistas/comunidade/versao/operacaoAprovada. Operação não aprovada impede
  habilitar; desabilitar permanece possível. Não prometer ativação nesta entrega.
- Somente Client da própria clínica: POST
  `cliente/configuracoes/gamificacao-piloto/denuncias/:denunciaId/excecao-retencao`.
  Comando + holdAteISO, justificativa1–1000, confirmacaoLegaltrue. Prazo futuro de
  até90dias a partir do registro, maior que prazo ordinário; renovação explícita.
  Apenas registro ainda dentro do prazo ordinário/hold vigente. Não recupera
  evidência já vencida/apagada nem concede leitura clínica ao gestor.
  Resposta mínima id/versão/holdAte. Necessidade legal deve ser humana e documentada.

## Execução para Luna alto

1. Reconferir branch/status, plano e resultados locais. Não alterar migration,
   criptografia, RLS ou autorização do núcleo sem evidência de incompatibilidade.
2. T13: BFFs específicos, reusando `lib/server/sessao-bff.ts` e padrões das rotas
   de receitas/avaliações. Testar origens/CSRF, papéis, entrada/saída, no-store,
   erros/UUIDs/cursor. Nenhum proxy livre/catch-all aceitando caminho do cliente.
3. T07/T14: conquistas no console/portal e comunidade privada, incluindo
   administração, convite, aceite, revogação sempre acessível, feed/comentários,
   likes com nomes, denúncia privada e moderação. Preservar demo/legado e307–315.
4. T15: dados sintéticos, desktop/mobile, teclado/axe, Playwright, demo local,
   lint/typecheck/build web e regressões. Não habilitar ambiente externo.
5. T16: atualizar docs/gates; retornar a Sol6.1 para revisão final R4/integração
   se necessário, avisando e pausando para troca manual. Uma única PR da317
   quando a entrega estiver reviewable; não mergear nem ativar piloto.

Bloqueios de liberação: termo/moderação operacional, revisão independente R4,
CI do HEAD final, preflight/migration externa autorizada e autorização de piloto.
A316 continua em stand-by. Não há novos módulos clínicos ou notificações externas.
