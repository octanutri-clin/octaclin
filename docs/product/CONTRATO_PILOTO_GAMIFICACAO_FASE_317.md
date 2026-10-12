# Contrato proposto do piloto — Fase 317

**DRAFT de planejamento**, sem runtime autorizado. Decisões/contexto no
[plano](../history/phases/PLANO_FASE_317.md). D01–11 confirmadas; D12 técnica fechada. Não misturar conquistas privadas com autorização para leitura em grupo.

## Regras recebidas

Clínica habilitada por Client/SuperAdmin; profissional responsável conduz.
Participantes adultos>=18, círculo privado, nomes visíveis, posts/comentários
publicados imediatamente, curtidas, denúncias e retirada; saída oculta conteúdo
e exige novo aceite para retornar. Conquistas individuais só para o próprio
paciente, concedidas manualmente e compartilhadas explicitamente pelo profissional.
Sem autorização de prontuário, perfil/foto, ranking clínico ou notificações externas.

Nome de exibição confirmado pelo paciente (D09); lista de quem curtiu também
mostra esse nome (D10). Conteúdo oculto/retirado e denúncias relacionados têm
retenção restrita por até90 dias (D11), com exceção legal explícita.
Contrato técnico mínimo mantém texto sem anexos, DM, URL clicável ou respostas aninhadas.
Habilitar comentários/curtidas não introduz descobrimento público de círculos.

## Matriz de atores

| Ação | Client | SuperAdmin | Professional responsável | Patient elegível |
| --- | --- | --- | --- | --- |
| Habilitar piloto do próprio tenant | Sim, permissão de configuração | Sim, alvo autorizado e auditado | Não por herança da flag antiga | Não |
| Ver conquistas individuais clínicas | Não | Não pela habilitação do piloto | Apenas carteira atual | Apenas próprias, liberadas/aceitas |
| Conceder/compartilhar/retirar conquista | Não | Não em nome de outro profissional | Sim, sessão/vínculo próprios | Revogar aceite, não conceder |
| Criar círculo/convidar/encerrar | Não | Não em nome de outro profissional | Sim, próprio escopo | Aceitar/sair dos próprios convites |
| Postar/comentar/curtir/denunciar | Não | Não pela configuração administrativa | Anúncio com autoria profissional própria, se previsto | Sim, no círculo autorizado |
| Revisar denúncia/retirar publicação | Não | Não automaticamente | Somente próprio círculo/carteira | Pode retirar conteúdo próprio |

Collaborator não ganha privilégio clínico. Papéis tenant-wide antigos não são
replicados nas novas ações profissionais. Se necessário suporte excepcional,
exige escopo separado aprovado; não há bypass implícito pelo papel SuperAdmin.

## Rotas candidatas e DTOs

Contratos novos sob módulo existente; preservar rotas legadas do console.
Não criar proxy de caminhos arbitrários. Prefixos/nomes finais confirmados em T01.

| Prefixo/ação candidata | Segurança/retorno mínimo |
| --- | --- |
| `cliente/configuracoes/gamificacao-piloto` GET/PATCH | Flags/versão, Client e permissão de configuração; não retorna pacientes/conteúdo |
| Operação equivalente SuperAdmin | Tenant identificado/autorizado na operação existente; nunca tenant livre na rota Patient |
| `gamificacao/piloto/pacientes/:pacienteId/conquistas` | Professional com vínculo/paciente atual; listagem/concessão/snapshot |
| Compartilhar/retirar conquista | Chave, versão esperada; nova geração não autoriza aceite antigo |
| `gamificacao/piloto/circulos` e convites | Proprietário profissional, versão e convite; sem Patient gerenciando carteira |
| `gamificacao/piloto/circulos/:id/denuncias` | Lista paginada/decisões somente do moderador autorizado |
| `portal/paciente/gamificacao/conquistas` | Próprio paciente da sessão; consentimento separado; projeção privada |
| `portal/paciente/gamificacao/circulos` | Só próprios convites/participações, sem descobrimento/roster |
| Aceitar/sair/consentimento do círculo | Versão do termo/convite/geração; patientId não entra no DTO |
| Feed/post/comment/reaction/report | Círculo/recurso atual, idempotência, revalidação do consentimento em cada página/ação |

Request UUIDs identificam recursos, nunca concedem acesso. Propostas técnicas:
texto de post até2000 caracteres; comentário até500; nome de exibição até80;
denúncia até1000. Paginação20 por página/max50, cursor data+id contextual,
sem contagem total que revele membros. Limites técnicos escolhidos para controlar tamanho/custo, não requisitos
clínicos; não introduzir JSON de regras arbitrárias no novo piloto. Reusar rate limiting existente com limites por ator/ação;
medir/testar 429 e proteção contra spam sem bloquear saída/revogação por cota.

Curtida: `PUT {curti: true|false, versaoEsperada, chave}`; não implementar toggle.
Uma relação por paciente/recurso; recurso discriminado post/comment com constraints
que impedem target de outro tenant/círculo. Contadores só dos atores elegíveis;
D10 inclui GET paginado de quem curtiu para membros elegíveis do círculo; nomes
de exibição apenas, sem IDs clínicos/links de perfil. Quem sai/revoga/é transferido
não aparece nem contribui ao contador. Recurso oculto não permite consulta.

## DTO de feed (allowlist proposta)

Recurso id/cursor, conteúdo **texto** publicado, nome do autor autorizado D09,
tipo de autor, instante/revisão, contador/minha reação, acesso à lista paginada de quem curtiu e possibilidade
de editar/retirar próprio item. Sem patientId/usuarioId/chave de storage/ciphertext,
lista de membros, consentimentos de terceiros, denúncia, justificativa interna,
prontuário ou conquistas privadas. Timestamp não inclui DOB ou demais atributos.

Escapar conteúdo em texto; Markdown/SVG/HTML livre não são renderizados. Todos os
GETs autenticados `private,no-store`; nenhuma fila/cache persistente da comunidade
no PWA. Receber retorno como TypeScript não substitui filtro explícito no backend.

## Estados, retirada e linearização

- Convite: pendente/aceito/retirado/expirado. Membro: ativo/saiu/revogado.
- Post/comentário: publicado/oculto/retirado/excluído pelo autor; revisão append-only.
- Denúncia: aberta/em revisão/encerrada, com responsável/decisão/cifra.
- Saída/transferência/encerramento/revogação são gates na leitura, não apenas jobs.
  Remover visibilidade de todos os posts/comments e contribuição de reações do
  membro antes de responder sucesso da saída. Conteúdo oculto não volta ao entrar.
- Remover post oculta seus comentários/reactions/contadores; não mostrar órfãos.
  Remover um comentário não apaga post alheio. Autor precisa de autorização atual.
- Lock/versão impedem publicação ou reaction commitado após a revogação com sucesso.
  Operação anterior ao lock pode ser válida historicamente, mas desaparece na
  próxima projeção. Feed já entregue não pode ser apagado de outra pessoa;
  explicar isso no termo, sem prometer retroatividade impossível.
- Moderador não marca post como aprovado clinicamente. Uma denúncia não decide
  sozinha que há dano; classificação/retirada pertence à revisão humana.
- Moderador inativo/círculo sem responsável impede novas participações/publicações;
  não habilitar comunidade sem capacidade de receber e tratar denúncias.

## Legado: decisão técnica D12

Novo piloto tem versão/modelo explícito. Dados/flags/termos antigos não criam
participação/aceite. Rotas antigas do console conservam histórico/contrato, mas
não escrevem em círculos/concessões modelo317 nem expõem legacy records no portal.
Nenhuma migration ativa clínicas, converte posts em consentidos ou passa `pontos`
para novo ranking. Não zerar/escrever colunas históricas por conveniência.

Teste de compatibilidade precisa verificar UI/demo/clients e chamadas legadas
apontadas a recurso novo. Se houver divergência no consumidor real, parar essa
transição e fechar política explícita em T01; não normalizar bypass por compatibilidade.

## Retenção e operação

D11 é independente da política de prontuário. Regra técnica de prazo:

- Conteúdo/identidade retirado ou ocultado: `retirarEm +90dias`; não prorrogar por
  nova edição, leitura ou novo convite. Filho herda o prazo mais curto do pai.
- Denúncia anterior relacionada segue o prazo do conteúdo; denúncia posterior
  pode reter **apenas** a evidência mínima necessária até90dias de sua criação.
  Não prolonga automaticamente a conservação de toda a thread/círculo.
- Identidade/consentimento residual deve ser minimizado, sob prazo compatível com
  evidência, sem nome em audit log para contornar eliminação. Reter prova mínima
  de consentimento além disso exige base/política específica revisada pela equipe.
- Exceção legal: hold registrado por profissional/usuário operacional autorizado
  conforme processo LGPD existente, com finalidade/autor/prazo ou revisão obrigatória.
  Não tratar campo booleano sem prazo como licença para retenção infinita.
- Ao expirar sem hold: reivindicação/lock, exclusão efetiva de textos/snapshots,
  nomes/denúncias/filhos que vencem; só eventos técnicos mínimos sem conteúdo
  podem permanecer. Testar worker ausente, corrida com denúncia/hold e resume.
- Conteúdo ativo pode continuar enquanto o círculo/participação estiverem ativos.
  Encerrar o círculo inicia ocultação/prazo; saída oculta todos os registros do
  autor. Não apagar post alheio por saída de quem só comentou, mas ocultar seus
  comentários/reactions. Conteúdo de autor que sai oculta replies dependentes,
  mesmo se de terceiros; não republicar órfãos nem dados ao voltar.

Escolha de90 dias foi confirmada pelo proprietário, mas adequação legal/termo
continua requisito operacional humano antes do piloto. Não eliminar prontuários
ou badge clínico autorizado pela política da comunidade. Revogar aceite não
abre conteúdo residual ao gestor; separação do papel de hold não concede leitura.

Prova operacional separada: responsáveis por denúncias, procedimento de retirada,
termo versionado/revisado, PostgreSQL/alvo/migration e rollout opt-in autorizados.
CI/merge não aplicam migrations nem aprovam uso real. Sem provedor externo/IA
na moderação desta proposta. Análise de eficácia clínica permanece humana.

## Datas, capacidade e controle do piloto

Idade calculada em data civil ISO `YYYY-MM-DD`, sem conversão da DOB para um
instante UTC. Usar data atual civil do fuso da clínica validado pelo servidor;
se não houver configuração de fuso aplicável, padrão explícito `America/Sao_Paulo`
para este piloto brasileiro. Não aceitar timezone/dataAtual fornecidos pelo cliente.
Aniversário29/02 atinge idade em01/03 em ano não bissexto nesta convenção técnica;
documentar/testar, não apresentar como definição jurídica universal. DOB ausente,
futura/inválida ou paciente não ACTIVE bloqueia. Confirmar idade na entrada e em
cada ação/leitura, inclusive quando DOB/cadastro muda; conteúdo/nomes/reactions
cujo autor deixa de ser elegível não continuam visíveis a terceiros por cache.

Capacidade proposta: até50 membros ativos por círculo e5 círculos ativos por
profissional, com contagem transacional; sem inscrição pública ou envio em lote.
Limites de texto/paginação já definidos e devem ser informados antes do envio.
Reusar rate limit server-side por usuário: proposta10 mutações de conteúdo/minuto,
30 reações/minuto e5 denúncias/minuto, com quota própria; saída/revogação não entram
nesses limites. Autorização sempre antecede conteúdo. Limites técnicos não garantem
capacidade humana de moderação: ativação requer profissional ativo e disponibilidade
para tratar denúncias; encerramento suspende publicação e oculta feed com prazoD11.

Nome confirmado: até80 caracteres, texto escapado, sem e-mail/telefone/URLs como
campo de perfil; não demonstrar detecção automática completa de dados pessoais.
Sem avatar/biografia/localização ou link para perfil clínico. Trocar nome exige
confirmação, afeta projeção das versões visíveis e preserva trilha restrita/cifrada
sob políticaD11; não replica nome antigo nos logs nem expõe histórico de aliases.
Lista de quem curtiu é paginada, revalida todos os gates e expõe só nome confirmado;
nomes iguais não são resolvidos exibindo ID clínico. Não criar ranking de popularidade.

Declaração de piloto: termos devem dizer nomes visíveis, possibilidade de leitura
antes de moderação e limite de ocultação retroativa (não elimina cópias já vistas).
Benefício/capacidade de moderação serão avaliados pela equipe; testes técnicos
não atestam eficácia de gamificação. Questões legais/operacionais não impedem
codificação isolada após autorização expressa, mas impedem ativação do piloto.

## Texto de aceite proposto para revisão operacional

Finalidades independentes, com botões aceitar/recusar/revogar e versão gravada.
Não marcar aceite automaticamente nem obrigar participar para continuar o cuidado.
Rascunhos abaixo não são revisão jurídica concluída:

**Conquistas — `317-conquistas-v1`:** “A participação é opcional. Autorizo a
exibição, no meu portal, das conquistas que o profissional compartilhar comigo.
Elas reconhecem marcos registrados e não são diagnóstico, avaliação de saúde ou
comparação com outros pacientes. Outros participantes da comunidade não verão
minhas conquistas. Posso revogar esta autorização; isso oculta a exibição no portal
e não apaga o histórico profissional que tenha retenção aplicável.”

**Comunidade — `317-comunidade-v1`:** “Quero participar deste círculo privado.
Outros participantes verão meu nome de exibição confirmado, minhas publicações,
comentários e as curtidas que eu fizer. Minha participação pode me identificar
como paciente da clínica. O conteúdo é publicado imediatamente, antes de revisão
humana, e pode ser retirado pelo profissional após denúncia. Não publique dados
pessoais ou de saúde de outras pessoas. Este espaço não substitui atendimento
individual. Posso denunciar conteúdo e sair a qualquer momento. Ao sair ou revogar
este aceite, meu conteúdo e minhas interações serão ocultados; isso não elimina
cópias já vistas por outras pessoas. Conteúdo retirado e denúncias podem permanecer
restritos à moderação por até90 dias, ou pela necessidade legal específica
registrada. Para retornar, precisarei de novo convite e aceite.”

O aceite deve exibir círculo/clínica/profissional destinatários antes de confirmar,
sem lista de participantes. Mudança material do termo incrementa versão e pede
nova conferência; geração de convite/compartilhamento não reaproveita aceite antigo.
Nome trocado é confirmado pelo titular; revisão de termo não concede privilégios.

## Procedimento mínimo de moderação

Profissional responsável recebe fila privada paginada de denúncias no console,
com disponibilidade assumida antes da ativação. Uma denúncia não derruba conteúdo
automaticamente e não revela denunciante aos participantes. Revisão pode manter
ou retirar post/comentário, registrando decisão/autor/versionamento cifrados.
Não usar filtro de palavras como veredito, percentual de risco clínico ou evidência
de ausência de dano. Profissional pode retirar conteúdo mesmo sem denúncia.

Encerrar círculo/retirar autorização profissional bloqueia novas submissões e
participação de imediato; não deixar espaço ativo sem moderador. Revisar casos
abertos dentro do prazoD11; conservar além dele somente mediante hold explícito
com processo LGPD, sem mensagens externas novas neste escopo. Procedimento de
resposta/capacidade deve ser aceito pela equipe antes da liberação do piloto.
