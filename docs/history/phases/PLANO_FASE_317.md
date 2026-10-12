# Fase 317 — conquistas individuais e comunidade para adultos

## Autorização, base e estado

Planejamento/análise de gaps autorizados em 2026-10-12. Implementação técnica autorizada em2026-10-12 após consolidação do plano;
testes novos, regressões, banco descartável e gates autorizados pelo proprietário.
Ativação, merge, deploy e migrations externas permanecem não autorizados. `origin/main` conferida por fetch: `a84921fb`,
merge da Fase315/PR395. Worktree `docs-fase-317-planejamento`, branch
`feature/fase-317-gamificacao`, criada diretamente dessa base, sem carregar commits
experimentais da316. Checkout principal e seus arquivos preexistentes preservados.
A316 permanece em stand-by por decisão do proprietário; não retomar automaticamente.

Risco documental R0; implementação envolve R4: consentimento, exposição entre
pacientes, escopo profissional, RLS, cifragem e histórico. Não usar pacientes reais.
Fonte de código congelada em [inventário](reviews/fase-317/source-inventory.json).
Não foi consultado banco externo, CI, uso real ou estado das flags por clínica.

## Decisões recebidas e pendências

| ID | Regra | Estado |
| --- | --- | --- |
| D01 | Conquistas individuais **e comunidade** nesta fase | CONFIRMADA pelo proprietário |
| D02 | Console e portal; profissional concede manualmente; compartilhamento e aceite específico revogável; sem avisos externos nesta primeira entrega | CONFIRMADA na resposta à proposta completa |
| D03 | Piloto apenas com pacientes de18 anos completos ou mais | CONFIRMADA |
| D04 | Círculos privados com nomes visíveis aos participantes | CONFIRMADA; nome exato em D09, sem concessão de acesso clínico |
| D05 | Publicação imediata; profissional modera após denúncia | CONFIRMADA; filtros não equivalem a aprovação humana |
| D06 | Incluir comentários e curtidas nesta fase, além de publicações em texto e denúncias; sem anexos/DM/avisos externos no escopo proposto | CONFIRMADA para comentários/curtidas; proposta de limites detalhada abaixo |
| D07 | Gestor Client ou SuperAdmin habilitam; profissional responsável conduz | CONFIRMADA; permissão de ativação separada de acesso clínico |
| D08 | Saída/revogação oculta publicações anteriores e impede novas; registro restrito conforme retenção; novo convite exige novo aceite | CONFIRMADA |
| D09 | Nome de exibição confirmado pelo paciente; não copiar cadastro clínico automaticamente | CONFIRMADA |
| D10 | Mostrar quem curtiu, usando nome de exibição autorizado no círculo | CONFIRMADA; sem perfil clínico/IDs de paciente |
| D11 | Até90 dias para conteúdo oculto/retirado e denúncias; exceção legal específica registrada | CONFIRMADA; independente de prontuário |
| D12 | Piloto versionado; dados/aceites/rotas legadas não publicam nem escrevem em recursos novos; histórico preservado | DECISÃO técnica documentada, sem alteração de runtime |

As respostas repetidas de D01–03 foram deduplicadas; D04–11 adicionais registradas. Nenhuma autorização de
implementação ou ativação foi inferida. Roadmap anterior excluía exposição entre pacientes. D04 altera esse limite para
**identificação deliberada dentro de círculo privado com aceite específico**,
sem autorizar exposição pública, prontuário ou conquistas individuais. Registrar
a mudança de produto e confirmar termos; autorização da clínica não é consentimento
do paciente. Ranking clínico permanece excluído e propósito precisa ser documentado. Novo piloto não deve premiar peso, IMC,
exames, restrição alimentar ou inferir adesão. Pontuação/desafios automáticos não
fazem parte da proposta preferencial. Não ativar ranking legado por consequência.

## Objetivo e limite de valor

Conquistas privadas reconhecem marcos escolhidos pelo profissional, preservando
controle do paciente. Comunidade oferece espaço consentido, identificado e com moderação posterior
à publicação. Pode haver exposição antes de uma denúncia; explicar essa condição
no aceite e não prometer revisão preventiva ou anonimato.
Nenhum badge representa diagnóstico, selo de saúde ou avaliação comparativa.
Não acrescentar IA, OCR, notificações externas, arquivos ou módulos da316.

Antes de ativar: equipe valida propósito, texto do consentimento, responsáveis
pela moderação e capacidade de atender denúncias. Aceite técnico não prova benefício
clínico. Piloto pode encerrar por ausência de benefício ou capacidade operacional.
Avaliar voluntariamente clareza/benefício percebido, saídas e denúncias, sem usar
peso, check-ins ou permanência como medida de sucesso automático. Não adicionar
telemetria identificável; plano de medição agregado depende do desenho final.

## Inventário e divergências reais

| Gap | Código/evidência | Tratamento proposto |
| --- | --- | --- |
| G317-01 Opt-in é por tenant | `ServicoGamificacao.obterConfiguracaoNoGerenciador/exigirRecurso`; flags default false, sem decisão individual | Opt-in clínica + convite/liberação + aceite atual; termos separados conquistas/comunidade, com nomes e publicação imediata explícitos |
| G317-02 Portal ausente no módulo consultado | Controller só console, sem papel Patient; busca nas rotas atuais do portal não localizou gamificação | API Patient dedicada, resolve paciente pela sessão e vínculo ativo; não reutilizar controller de console para paciente |
| G317-03 Carteira histórica | `ranking` valida desafio e retorna participações sem JOIN na carteira atual dos participantes | Novo piloto sem ranking clínico/popularidade; leituras/revisões revalidam paciente atual e transferência; revisão negativa do legado relevante |
| G317-04 Dados livres sem cifragem neste módulo | ORM de post `conteudo text`, regras/desafios JSON/text sem transformação de cifra observada | Novos snapshots/textos sensíveis cifrados com serviço vigente; legado não é publicado nem copiado automaticamente |
| G317-05 Snapshot/retirada ausentes | `paciente_badges` guarda referência badge/data, sem conteúdo congelado ou autor/revogação | Snapshot imutável da concessão, autor verificado, estado de compartilhamento/retirada separado; não recalcular/alterar história |
| G317-06 Replay parcial | SQL tem UNIQUE concessão/membro/participação; `save(create())` pode falhar no duplo envio; progresso usa read/save sem versão | Chave idempotente + fingerprint protegido + locks/versão +409 em divergência; UNIQUE sozinho não é sucesso de replay |
| G317-07 Moderação insuficiente | `moderarConteudo` procura quatro palavras; status bloqueado é salvo como pendente pelo serviço | Publicação imediata D05, denúncia privada e retirada humana; filtro só auxiliar, sem selo de aprovação ou garantia de ocultar PHI |
| G317-08 Atribuição de autoria | Console cria post com `pacienteId` recebido | Nova submissão Patient usa autor da sessão; anúncio profissional tem autoria própria; profissional não se passa por paciente |
| G317-09 Campos e datas amplos | DTOs JSON livres, texto/SVG sem todos os limites; datas ISO sem garantia de ordem | DTOs allowlist e limites, ícones internos, intervalos válidos; escape de texto, nunca SVG/HTML livre no portal |
| G317-10 Permissões de ativação | PATCH configuração tenant-wide disponível a Professional/SuperAdmin; Client não tem `gamificacao.gerenciar`; Collaborator citado no controller mas sem permissão padrão | Decidir D07; não conceder acesso clínico ao Client para habilitar piloto, separar operação da clínica de ações clínicas |
| G317-11 Paginação superficial | listagens `take:100` sem cursor/hasMore; painel usa primeira página de pacientes/bootstrap | Cursor estável/data+id, limites visíveis, seleção explícita do paciente; não interpretar truncamento como ausência |
| G317-12 RLS não é carteira | Fundação ENABLE/FORCE + política tenant e FKs simples; ExecutorTenant seta contexto transacional | Reusar infra, FKs compostas nas novas relações; autorização da carteira na aplicação; testar com role real sem BYPASSRLS |
| G317-13 UI/testes dependem do legado | Painel monolítico ~centenas de linhas; smoke/a11y criam post/ranking e badge em cadeia | Componentes pequenos e fixtures alinhadas; preservar rota e validar impacto em demo/global, não só testes novos |
| G317-14 Revogação concorrente | Modelo específico não tem geração de convite/aceite nem revisão | Geração/token de versão; lock para saída/moderação/publicação; replay antigo não restabelece participação |

Essas são conclusões estáticas do código, não incidentes comprovados ou testes de
exploração. Banco externo/migrations aplicadas não foram inferidos do merge.

## Arquitetura e decisões técnicas de implementação

### Reutilizar e delimitar

Reusar ModuloGamificacao, ExecutorTenant, guards, escopo profissional, cifra,
auditoria mínima, wrappers BFF e componentes UI existentes. Padrões de
compartilhamento/geração/consentimento da313 e marcos privados da307 orientam o
contrato, sem usar consentimento gestacional para outra finalidade. Não duplicar
portal/prontuário nem aumentar `ServicoPortalPaciente` com comunidade inteira.

Estender entidades existentes com campos aditivos/versionados quando isso
preservar compatibilidade. Entidades próprias apenas para consentimento/revisão,
snapshot e denúncia que não têm contrato equivalente. Número da migration será
escolhido na implementação após reconferir main (última registrada consultada1069;
316 também possui proposta1070 ainda não implementada). Não editar migrations antigas.

### Condições de acesso

- Toda ação usa tenant da sessão; não aceitar tenant arbitrário no DTO.
- Concessão/compartilhamento/moderação: profissional autenticado, vínculo ativo,
  paciente atual na carteira. SuperAdmin/administrativo não atuam em nome dele.
- Patient: próprio paciente ativo, DOB válida e idade completa>=18 na ação,
  convite/liberação vigente, aceite da finalidade/geração, clínica/círculo ativos.
- DOB ausente/inválida, arquivamento, sessão/vínculo revogado, transferência ou
  consentimento revogado bloqueiam participação; nunca deduzir idade por perfil.
- Conferir idade por data civil sem converter aniversário via fuso indevido;
  escolher utilitário existente e fechar regra de calendário no contrato final.
- Conquistas nunca aparecem para outros pacientes. Nome autorizado para autores e quem curtiu
  conteúdo/interações conforme D09/D10; não copiar perfil clínico, foto ou lista
  de membros por consequência. Nome visível pode revelar participação na clínica;
  o termo deve explicar essa identificação e leitura anterior à moderação.
- Revalidar todos os requisitos em leituras e mutações, não apenas na UI ou convite.

### Estados e concorrência

Conquista: registrada privada → compartilhada → retirada; conteúdo da concessão
é snapshot, e retirada não apaga histórico profissional. Aceite tem versão/geração
independente; reenvio/novo convite não reutiliza aceite revogado silenciosamente.

Círculo: rascunho/ativo/encerrado; convite e membro têm estados explícitos.
Post/comentário: publicado/oculto por saída/retirado pela moderação/excluído pelo
autor. Nova submissão elegível é publicada imediatamente; não inventar estado de
aprovação humana. Editar gera nova revisão publicada, sem sobrescrever a anterior.
Filtro de texto não confere validade clínica. Conteúdo inválido/XSS/rate limit é
recusado pela validação, sem classificar intenção/saúde do autor.
Comentário herda tenant/círculo e autorização do post; sem respostas aninhadas
na primeira proposta. Curtida liga autor/recurso com unicidade e operação
idempotente de definir curti/não curti (não toggle vulnerável a retry).
Denúncia é privada, com estado aberto/avaliado/encerrado e decisão auditada.
D08 oculta conteúdo do autor ao sair; comentários/curtidas não podem deixar
resposta órfã ou reidentificação sobre conteúdo oculto. Transferência/arquivamento
retira acesso e oculta participação antiga; eventual retorno requer convite/aceite
de nova geração, sem republicar automaticamente conteúdo anterior.

Cada transição tem versão esperada e idempotência. Fingerprint cifrado/vinculado
ao tenant/autor/recurso/ação; não usar hash isolado como autorização. PostgreSQL
com lock transacional/constraints impede publicação/interação após revogação/encerramento.
Nenhum worker necessário para publicar automaticamente; sem filas paralelas novas.

### Persistência, projeções e privacidade

Cifrar textos clínicos possíveis, snapshot de conquista, nome de exibição e motivos de
moderação/denúncia que possam identificar o paciente; IDs/estados/versões mínimos
consultáveis. Reusar envelope existente. Nome de exibição identificado é dado pessoal sensível pelo contexto, não anonimato.
Nenhum conteúdo em auditoria, URL,
analytics/cache persistente ou erro cru. IDs de relações permitidos somente nas
rotas profissionais autorizadas; portal de grupo não retorna pacienteId/usuarioId,
moderador, denúncia, nota interna ou texto ainda pendente de outro membro.
DTO explícito de saída, cursor opaco contextual, no-store/sem cache PWA.
Incluir nome de autor somente conforme D09 e aceite corrente. Comentários e
curtidas de recurso retirado não aparecem nem somam como atividade no feed.
Contadores calculados sob a mesma política; D10 inclui lista paginada de nomes de reatores atuais, sem patientId/usuarioId
  ou perfis. Acesso só a recurso visível no círculo da sessão; não há roster geral.
D11 exige job efetivo e prova de exclusão em até90 dias após ocultação/retirada;
soft-delete/cron escrito sozinho não comprova exclusão. Exceção legal deve ter
justificativa, acesso restrito, prazo/revisão e autor responsável, sem hold indefinido. A política de clocks/filhos/identidades está no contrato.

Para legado: registros antigos não ganham aceite, autoria comprovada ou snapshot
por suposição. Não migrar/copiar plaintext clínico para logs ou relatórios. Não
criar rotas públicas/membership descoberta. Não habilitar nem alterar flags de
clínicas em migrations; política D07 ainda precisa ser decidida.

### Compatibilidade e rollback

Não retirar API/flags legadas ou mudar dados históricos silenciosamente: inventariar
consumidores e fechar política explícita antes de introduzir gate. Nenhum ranking
novo no piloto. Down conservador sem DROP de histórico; rollback funcional desliga
piloto mantendo registros/consentimentos/revisões. Reversão de código não restaura
consentimento revogado nem acesso transferido. Rotas manuais de metas307 continuam
funcionando; autosserviço LGPD, portal/receitas/gestação e console preservados.

## Gates e verificações previstas

Gates desta seção pertencem exclusivamente à317; não alteram G01/G02 da314.

| Gate | Agora | Saída objetiva |
| --- | --- | --- |
| G00 Base/planejamento | PASS documental | Base/inventário/decisões e contrato proposto conferidos; não é autorização de runtime |
| G01 Produto/consentimento/moderação | BLOCKED | D01–11 confirmadas/D12 técnica; termo final e plano operacional de moderação ainda precisam de revisão para piloto |
| G02 Autorização/privacidade | SKIPPED | Projeções, cifra, carteira, revogação e revisão R4 independente |
| G03 Banco/concorrência | SKIPPED | PG descartável real, FORCE RLS/role/FKs/locks/replay testados |
| G04 UX/regressões/CI | SKIPPED | Backend/BFF/web, demo/global, Playwright/axe/builds e checks do HEAD |
| G05 Operação/piloto | BLOCKED | Migration/alvo, moderação/denúncias, plano de piloto e autorização de liberação |

Independência: não depende do OCR/scanner/provisão316 ou das referências científicas
bloqueadas314. Não declara prontidão dessas fases. Segurança da comunidade e idade
adulta são requisitos próprios, não validação clínica de curva/classificador.

Verificações nesta etapa: leitura/busca/fetch/hash/diff/links/segredos documentais.
Não adicionar/executar testes de implementação enquanto só planejamento estiver
solicitado. Testes futuros no checklist são **previstos**, não PASS existente.

## Handoff e modelos

[Handoff](../../../tasks/plan-fase-317.md), [tarefas](../../../tasks/todo-fase-317.md),
[contrato draft](../../product/CONTRATO_PILOTO_GAMIFICACAO_FASE_317.md).
Não substituir `tasks/plan.md`/`todo.md` históricos da313 nem worktree pausada316.

GPT‑6.1Sol médio para planejamento e arquitetura/permissões/concorrência/revisão.
Luna alto para slices de UI/DTO/BFF com contrato fechado e sem decidir regras de
consentimento/moderação. Com comunidade incluída, não prometer implementação
integral independente por Luna antes de fechar R4. Alertar e pausar na troca
manual; nenhuma troca ou implementação automática nesta etapa.
