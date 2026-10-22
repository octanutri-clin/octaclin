# FOOD04 — grupos reutilizáveis de substituições

## Estado e escopo

Planejamento em 2026-10-22, base `origin/main` `9e1984a2` (merge #440).
Branch `docs/pos320-food04-planning`; worktree dedicada. O checkout principal,
incluindo sua alteração preexistente em `octaclin-web/next-env.d.ts`, foi preservado.
Autorização desta etapa: planejamento e análise de gaps em Sol médio.
Implementação não iniciada. Uma única PR reunirá planejamento e implementação.

Objetivo: biblioteca independente de grupos de alternativas, reutilizáveis em
itens diferentes de planos alimentares. Aplicação explícita ao rascunho; manter
publicação, histórico, preferências, ativação e escolhas do paciente existentes.
Não implementar equivalência automática (FOOD05), modelos de refeições (PA08),
novas fontes nutricionais, TBCA, serviço externo ou dependência nova.

## Referências específicas e evidências

- `docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md`, seção FOOD04: origem
  pessoal/clínica, múltiplos destinos e snapshot sem alteração retrospectiva.
- `docs/pos-320/01_Catalogo_GitHub_OctaClin`, tabela FOOD04, e matriz itens
  17/49: **sem biblioteca recomendada; usar primitives/código atual**.
  Não existe repositório externo específico a consultar para esta entrega.
- Fases 298/304 e PA02–PA07 são baseline; FOOD01/02/03 fornecem identidade,
  medidas, alimentos personalizados, permissões e preferências privadas.
- As evidências abaixo vêm do código da base acima, não de consultas a bancos
  externos. Merge/migration/deploy FOOD03 têm seu registro histórico próprio.

| Contrato observado | Arquivo / evidência | Consequência |
| --- | --- | --- |
| Alternativas pertencem ao item; sem biblioteca de grupos | `dominio/plano-alimentar.ts`, `infraestrutura/plano-alimentar-substituicao.orm.ts` no módulo planos-alimentares | Biblioteca nova; reutilizar materialização dos planos |
| Máximo de 20 alternativas por item | `dominio/plano-alimentar.ts`, `dominio/edicao-plano.ts`, `aplicacao/dtos.ts` | Não truncar nem elevar o teto silenciosamente |
| Documento editorial schema1 usa allowlist, chaves únicas e teto 96 KiB | `dominio/edicao-plano.ts` | Extensão opcional e retrocompatível; validar bytes após expansão no servidor |
| Save com revisão, locks de paciente/plano/rascunho e ExecutorTenant | `aplicacao/servico-planos-alimentares.ts`, `salvarEdicaoRascunho` | Aplicação validada no mesmo commit; não criar outro escritor do plano |
| Custom usa identidade/revisão/nonce e snapshot cifrado autoritativo | `dominio/aplicacao-alimentos-personalizados.ts` | Não aceitar composição custom do navegador como autoridade |
| Biblioteca resolve profissional ativo e permissões no servidor | `aplicacao/identidade-biblioteca-alimentos.ts` | Reutilizar identidade; testar autorização adicional de cada grupo/fonte |
| Nova versão clona filhos publicados; não copia indiscriminadamente documento editorial | `aplicacao/servico-planos-alimentares.ts`, `criarNovaVersao` | Preservar alternativas materializadas sem exigir grupo ainda ativo |
| Autosave/coordenador e posse PA07 já existem | `octaclin-web/lib/coordenador-edicao-plano.ts`, editor profissional | Reutilizar exclusão de operações; não manter segundo timer |
| 1077 é a maior migration versionada na base | `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001077-FavoritosAlimentosProfissional.ts` | Reservar provisoriamente 1078; reconferir main antes de criar |

Os caminhos backend sem prefixo na tabela são relativos a
`octaclin-backend/src/modulos/planos-alimentares/`.

## Decisões de produto — aguardando respostas

As três perguntas foram enviadas nesta sessão. As recomendações abaixo são
propostas, não aceites já recebidos. Registrar a resposta antes de implementar
o comportamento dependente.

| ID | Proposta preferencial | Estado |
| --- | --- | --- |
| D01 | Grupo pessoal ou da clínica; pessoal por padrão; só criador edita/desativa; profissionais autorizados reutilizam grupos da clínica | PENDENTE |
| D02 | Alimentos com porções explícitas em gramas; aplicação conserva essas porções e exige conferência; sem equivalência automática | PENDENTE |
| D03 | Acrescentar sem apagar; novas alternativas sem liberação ao paciente/sem preferência; alterações da biblioteca não atualizam cópias nem rascunhos já salvos | PENDENTE |

## Contratos técnicos propostos

### Biblioteca e composição

- Grupo com nome obrigatório (até 180 caracteres), 1–20 entradas ordenadas,
  identidade UUID, criador, tenant, escopo, revisão positiva, estado ativo e
  idempotência de criação. Cada entrada tem identidade própria e referência
  discriminada `catalogo` ou `custom`, quantidade/unidade/peso explícitos.
- Grupo pessoal pode usar catálogo autorizado e custom visível ao criador.
  Grupo da clínica **não pode conter custom pessoal**, nem nomes/composição
  copiados dele; conferir esse invariante em criar, editar, detalhar e aplicar.
  Não tornar alimento pessoal público por pertencer a um grupo compartilhado.
- Inicialmente só alimentos com identidade durável e composição autoritativa;
  texto livre legado continua no plano, mas não vira grupo automaticamente.
  Oferecer criação pela biblioteca com o seletor existente; evitar exportar
  conteúdo de um prontuário para uma biblioteca compartilhada.
- Salvar referências, composição e porções conferidas em conteúdo cifrado
  versionado. Nome e conteúdo não vão para logs/índices em claro; pesquisa pelo
  índice HMAC existente, com tenant. Não inventar zeros para dados ausentes.
- Custom alterado/desativado exige atualização explícita do grupo antes de
  nova aplicação. Mostrar indisponibilidade na prévia; não substituir silenciosamente
  a composição por uma revisão mais recente. Catálogo conserva fonte/versão
  verificadas, sem habilitar fonte bloqueada.
- Não colocar dados de pacientes, nome de paciente, prontuário ou ID de paciente
  no grupo, na criação idempotente ou em metadata de auditoria. Campo livre de
  nome recebe orientação de uso genérico, sem prometer prevenção semântica total.

### Aplicação, autosave e preservação

1. Abrir grupo autorizado e conferir conteúdo/porções. Escolher um ou mais
   itens no mesmo rascunho aberto (até 20 destinos por ação); pode reutilizá-lo
   posteriormente em outros planos/pacientes autorizados. Não fazer escrita
   em lote de vários planos nesta entrega.
2. Antes de inserir: revalidar posse PA07, contexto paciente/plano, capacidade
   em cada destino e bytes do documento. Operação integral: se qualquer destino
   exceder 20 alternativas ou o documento exceder o teto, não inserir parcialmente.
   Duplicatas já existentes não são removidas por nome; o profissional as confere.
3. Gerar chaves editoriais novas e UUID de aplicação por ação/destino; repetir
   resposta/retry da mesma aplicação não duplica. Uma nova aplicação explícita
   pode repetir alternativas e deve ser distinguível de replay.
4. Acrescentar ao formulário e marcar alterado; usar autosave existente de 60s
   ou salvar manualmente. Prévia não é save. Aguardar envio atual antes de
   alterar a estrutura; suspender timer durante operação, restaurando o estado
   de composição/posse no finally. Resposta atrasada após troca de paciente,
   plano, revisão ou posse é descartada; não restaurar edição perdida.
5. Na primeira persistência, sob o mesmo `ExecutorTenant` e locks já usados,
   revalidar grupo/revisão, identidade, fontes, destino e revisão do rascunho.
   Canonicalizar entradas no servidor antes dos resolvers custom/medidas e da
   materialização clínica. Conflito 409 mantém alterações locais e pede conferência;
   não sobrescrever silenciosamente, nem converter falha de autorização em rascunho salvo.
6. Guardar proveniência mínima opcional no **documento editorial cifrado já
   existente**: grupo/revisão/entrada/aplicação por alternativa. Comparar contra
   o documento anterior lido do banco, nunca contra marca de confiança enviada
   pelo cliente. Uma cópia já persistida usa sua composição preservada; não
   consulta novamente grupo desativado a cada autosave. Novas chaves/aplicações
   exigem autorização atual; não aceitar proveniência transplantada de outro plano.
7. Essa extensão não exige coluna clínica extra inicialmente. Custom continua
   usando seu mapa autoritativo FOOD02; não duplicar cálculo, criptografia ou
   normalização. Campos desconhecidos continuam proibidos. Se prova técnica
   demonstrar necessidade de coluna extra, documentar e adicionar na migration
   nova, sem alterar migrations integradas.
8. Publicação materializa alternativas existentes. Portal/impressão recebem
   somente a projeção do plano, sem IDs da biblioteca, criador, escopo ou dados
   internos. `liberadaParaPaciente` e `preferida` seguem D03; favoritos FOOD03
   não são herdados como preferência da prescrição.
9. Clonar versão publicada, duplicar/copy PA02 e reutilizar modelos existentes
   devem preservar a composição aplicada, sem transformar cópia histórica em
   nova dependência de grupo. Reusar caminhos existentes de snapshot; testar
   explicitamente grupo/fonte desativados depois da aplicação.

### API e persistência

Prefixo sugerido: `planos-alimentares/grupos-substituicoes`, sem colidir com
rotas UUID. GET lista/detalhe; POST cria com chave de idempotência; PATCH altera
ou desativa com revisão esperada. Busca textual no body de endpoint de busca,
como FOOD02, sem conteúdo livre em URL. Paginação25, limite100, página com teto
existente. Retornar somente DTO explícito e `private, no-store`.

Preview autorizado pode usar detalhe; não criar endpoint que salve plano à
margem de `salvarEdicaoRascunho`. A intenção optional na alternativa editorial
deve ser tipada/validada no backend, BFF e Web; revisão/UUID/chave/limites são
validados em todas as fronteiras. O BFF reutiliza sessão/guardas oficiais.

Tabela aditiva proposta `grupos_substituicoes`: tenant, criador, escopo, ativo,
revisão, timestamps, chave de criação, conteúdo e pedido original cifrados,
índice HMAC. FK composta tenant/criador, unique tenant/criador/idempotência,
checks de escopo/revisão e índices de listagem. ENABLE + FORCE RLS com policy
tenant fail-closed; RLS não substitui privacidade pessoal no serviço. Escopo é
fixado na criação: não converter pessoal em clínica por PATCH. Registrar
entidade/provider/controller e migration em `opcoes-typeorm.ts`. Não criar
tabela de vínculo a paciente nem cascata que apague snapshots de planos.

Criação concorrente usa lock transacional/idempotência com comparação canônica
do pedido; revisão CAS para edição/desativação. Ordenar aquisição de locks
grupos/fontes por UUID ao resolver múltiplas referências, compatível com ordem
paciente → plano → versão do save. Não criar caminho CRUD que faça lock inverso
em paciente. Repetir chave com conteúdo diferente retorna409.

Rollback operacional: remover controles de novos grupos/aplicações e manter
schema/dados/materialização; proibir downgrade que não leia a extensão editorial
sem um leitor compatível. Não executar down destrutivo para reverter código.
Migration externa é uma etapa própria após revisão/merge e preflight dos alvos;
nenhum banco externo foi consultado ou alterado no planejamento.

## Gaps e cobertura exigida

| ID | Lacuna | Fechamento/teste obrigatório |
| --- | --- | --- |
| G01 | Sem biblioteca/CRUD/RLS | Migration aditiva; Postgres real com role não-owner/NOBYPASSRLS; cruzar tenants/profissionais |
| G02 | Compartilhamento pode vazar custom pessoal | Rejeitar grupo clínica com custom pessoal; acesso revogado/fonte oculta não revela conteúdo |
| G03 | Aplicação poderia depender eternamente da biblioteca | Novo save revalida; cópia persistida sobrevive a edição/desativação; portal não consulta biblioteca |
| G04 | Confusão entre favorito, preferida e liberação | Três estados separados; novo grupo não autoriza paciente automaticamente |
| G05 | Replay/CAS e ordem de locks | Retry sem duplicar; edição/desativação concorrente; troca de carteira; duas abas; sem deadlock |
| G06 | Limites/duplicatas/dados incompletos | 20 alternativas/destino, 20 destinos/ação, 96KiB; nenhum truncamento; ausente continua ausente |
| G07 | Cópias/nova versão podem perder composição | Regressões custom/manual/catálogo/medidas; cópia sem nova autorização da biblioteca histórica |
| G08 | UI assíncrona pode aplicar no contexto errado | Abort + token de contexto; autosave pendente; perda de posse; erro acessível e preservação local |

## Execução e modelos

Checklist detalhado: [todo-pos-320-food04.md](todo-pos-320-food04.md).
Sol médio fecha D01–D03 e contratos/handoff; Luna alto pode implementar tarefas
delimitadas com TDD seguindo esses contratos. Antes da troca, avisar e pausar.
Se aparecer nova divergência de auth/snapshot/locks, escalar o item à revisão em
Sol médio, continuando partes independentes. Não iniciar runtime nesta etapa.

## Verificações desta etapa

PASS: fetch e confirmação do merge #440 em main; inspeção de branch/status/diff,
roadmap/catálogo/matriz específicos FOOD04, contratos e código descritos acima.
PASS: `git diff --check`, scanner local de secrets, matriz documental
(40 referências críticas) e conferência de links
relativos dos documentos FOOD04. Preflight oficial `pnpm validate:docs` BLOCKED:
executável `powershell` ausente neste ambiente. A conferência de links não
substitui esse gate. Node observado v24.19.0; projeto exige22.x; pnpm observado11.19.0, declarado11.25.0. Antes da
implementação, selecionar Node22 e pnpm da versão declarada, sem mudar engines.
SKIPPED: testes de implementação, Postgres, builds, Playwright e CI FOOD04,
pois não há implementação. Nenhum PASS de FOOD03 valida FOOD04.

## Próxima ação

Incorporar respostas D01–D03, verificar documentos e preparar a troca para Luna
alto. Uma PR funcional única será aberta quando houver implementação verificável;
nenhum merge, migration externa, deploy ou ativação decorre deste planejamento.
