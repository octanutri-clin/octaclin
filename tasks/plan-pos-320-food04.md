# FOOD04 — Biblioteca de Grupos de Substituições Alimentares

## Estado, autorização e rastreabilidade

Planejamento consolidado em 2026-10-22. Base auditada `origin/main` `9e1984a2`
(merge #440); branch `docs/pos320-food04-planning`, worktree dedicada. O checkout
principal e sua alteração preexistente `octaclin-web/next-env.d.ts` permanecem
preservados. Implementação técnica autorizada e iniciada após “Pode seguir”; nenhuma PR FOOD04 aberta.

O proprietário aprovou D01–D03 e ampliou o escopo em sua mensagem sobre a
Biblioteca de Grupos de Substituições Alimentares. Esta revisão incorpora os
12 itens daquela mensagem. A especificação anterior está no commit `059c6bd9`.
Especificação apresentada e desenvolvimento autorizado pelo proprietário em
“Pode seguir”. Não há autorização operacional para migration externa/deploy nesta fase.
Uma PR funcional principal reunirá documentos e implementação essencial.

| Decisão | Regra vigente aprovada | O que substitui |
| --- | --- | --- |
| D01 | Pessoal por padrão; compartilhados da clínica; criador e administradores com permissão específica administram compartilhados; arquivar/restaurar | Proposta de somente criador alterar qualquer grupo e desativação sem restauração |
| D02 | Porções manuais explícitas em gramas; prévia seletiva permite personalizar porções; nenhuma equivalência automática | Aplicação integral do grupo sem edição de porção na prévia |
| D03 | Acrescentar sem apagar; não repetir principal; detectar duplicatas/divergências; alternativas novas sem preferência/liberação; cópias independentes | Proposta de não tratar duplicatas além da conferência e de repetir grupo inteiro |
| D04 | Duplicação independente, pessoal por padrão, com origem interna e novo ID | Sem ação de duplicação |
| D05 | Nome/descrição, categoria e etiquetas flexíveis, filtros e favoritos individuais | Nome como única organização |
| D06 | Autoria, administração após saída do criador, origem/revisão/porções aplicadas, histórico e arquivo/restauração | Sem administração institucional e proveniência limitada ao rascunho |
| D07 | Avaliar avisos somente com infraestrutura estruturada validada; se inexistente, melhoria posterior | Não autoriza inferência clínica nem novo motor de alergias |
| D08 | Desfazer quando tecnicamente viável; reusar mecanismos existentes | Não autoriza reversão cega após novas edições/save |

## 1. Referências e componentes existentes a reutilizar

FOOD04 recomenda **primitives/código atual; sem biblioteca ou repositório externo
específico** em `docs/pos-320/01_Catalogo_GitHub_OctaClin`, tabela FOOD04, e na
matriz dos itens17/49. Não consultar todos os repositórios do catálogo nem
instalar dependências por disponibilidade. FOOD05, PA08, TBCA e novas fontes
nutricionais não fazem parte desta entrega.

Na tabela, caminhos backend relativos começam em
`octaclin-backend/src/modulos/planos-alimentares/`.

| Reuso observado na base | Caminho / contrato | Adaptação mínima FOOD04 |
| --- | --- | --- |
| Composição canônica e snapshots das alternativas | `aplicacao/servico-planos-alimentares.ts`, `dominio/plano-alimentar.ts` | Resolver identidade/fonte no servidor; usar materialização existente |
| Alimentos pessoais/clínica e resolução custom | `aplicacao/servico-alimentos-personalizados.ts`, `dominio/aplicacao-alimentos-personalizados.ts` | Preservar composição autoritativa/revisão/nonce; não compartilhar custom pessoal |
| Identidade profissional de biblioteca | `aplicacao/identidade-biblioteca-alimentos.ts` | Reusar nas ações profissionais; NÃO afrouxar para Client administrar |
| CRUD/modelos e snapshots genéricos | `aplicacao/servico-modelos-plano-alimentar.ts` | Usar padrões; não criar outro modelo de plano/refeição |
| Favoritos individuais FOOD03 | `aplicacao/servico-favoritos-alimentos.ts`, `infraestrutura/favorito-alimento.orm.ts` | Reusar padrão idempotente; tabela própria de favorito de grupo, sem sobrecarregar favorito de alimento |
| Editor schema1, allowlist, 96KiB e chaves únicas | `dominio/edicao-plano.ts` e equivalente Web | Campo opcional de intenção/proveniência; retrocompatível e limitado |
| CAS e locks de paciente/plano/rascunho | `aplicacao/servico-planos-alimentares.ts`, `salvarEdicaoRascunho` | Novo grupo validado dentro da transação do save; nenhum segundo escritor |
| Autosave60s/saída/posse entre abas | `octaclin-web/lib/coordenador-edicao-plano.ts`, `components/pacientes/plano-alimentar-profissional.tsx` | Reusar coordenador, suspensão e token de contexto |
| Biblioteca/selectores/medidas/UI acessível | `octaclin-web/components/pacientes/alimentos-personalizados.tsx`, `medidas-caseiras-alimento.tsx`, `modelos-plano-alimentar.tsx` | Extrair apenas o necessário; evitar ampliar o editor monolítico |
| Sessão/BFF/permissões | `octaclin-web/lib/server/sessao-bff.ts`, `permissoes-bff.ts`, `MAPA_ROTAS_PERMISSOES.md` | Mesmos wrappers; allowlist e no-store; papéis backend continuam autoritativos |
| Roles e permissões explícitas | `octaclin-backend/src/modulos/auth/dominio/permissoes.ts`, `octaclin-backend/src/modulos/auth/apresentacao/guarda-permissoes.ts` | Acrescentar capacidades específicas sem ampliar leitura de prontuário |
| Auditoria na transação e redação | `octaclin-backend/src/infraestrutura/auditoria/servico-auditoria.ts`, `redacao-auditoria.ts` | Eventos mínimos com ator/revisão/ação; sem texto, alimentos ou contexto clínico |
| Cifra/índice HMAC/RLS | `CriptografiaDadosSensiveis`, `ExecutorTenant`, migrations1075–1077 | Mesmo padrão de proteção; PostgreSQL não-owner prova isolamento |

**Evidências relevantes:** o limite real é20 alternativas/item, em três validadores
independentes (`dominio/plano-alimentar.ts`, `dominio/edicao-plano.ts`,
`aplicacao/dtos.ts`). A linha21 da matriz pós-320 ainda dizia50; corrigida para
refletir o código. Não elevar o limite nesta fase. A maior migration versionada
na base é1077; estado externo de bancos não foi consultado neste planejamento.

## 2. Modelo de dados e migration proposta

### Grupos

Tabela aditiva `grupos_substituicoes`:

- UUID, tenant, profissional criador e usuário criador; autoria original imutável.
- Escopo `pessoal|clinica`, estado `ativo|arquivado`, revisão inteira positiva,
  timestamps e última alteração/ator conforme padrões existentes.
- Conteúdo cifrado/schema1: nome obrigatório180, descrição opcional2000,
  categoria opcional80, até10 etiquetas de até40 caracteres; rótulos genéricos,
  sem dados identificáveis de pacientes. Uma categoria livre e várias etiquetas
  permitem organização sem atrelar grupo a refeição ou objetivo clínico.
- Até20 entradas ordenadas. Cada entrada tem UUID próprio, identidade
  discriminada `catalogo|custom`, referência de fonte/versão ou revisão custom,
  quantidade, unidade, peso em gramas e snapshot autoritativo de composição.
  Ausência de nutriente permanece ausência; nenhum cálculo de equivalência.
- Nome/categoria/etiquetas pesquisáveis por HMAC tenant-scoped com normalização
  existente. Categoria usa igualdade normalizada; busca/termos livres no body,
  sem nome clínico em URLs. Ordenação estável por favorito, data e UUID;
  não ordenar ciphertext como se fosse nome legível.
- Chave de criação idempotente e pedido canônico cifrado. Duplicação guarda
  origem interna `{grupoId,revisao}` no conteúdo cifrado, sem FK de cascata ou
  link de acesso. A origem não é uma capability nem é exposta no portal.
- FK composta tenant/criador; unique tenant/criador/chave de criação; checks,
  índices por tenant/escopo/estado e pesquisa; sem cascade destrutivo ao excluir
  usuário/profissional. Saída do criador não apaga nem entrega seus grupos pessoais.

Tabela aditiva `favoritos_grupos_substituicoes`: tenant, profissional, grupo,
timestamp; unique tenant/profissional/grupo e FKs tenant-aware. Preferência
pessoal, POST/DELETE idempotentes. Arquivamento esconde da seleção padrão,
mas preserva favorito para restauração; listar favoritos revalida visibilidade.
Favoritar não copia grupo nem altera plano.

Ambas exigem ENABLE + FORCE RLS, policy tenant fail-closed, role runtime sem
bypass, filtros explícitos e DTO mínimo. A privacidade pessoal também é
verificada no serviço; tenant RLS sozinho não a garante. Administradores não
recebem grupos pessoais nem mesmo via busca, favoritos, origem ou erros.

Migration provisória1078, reconferindo disponibilidade antes de criar. Registrar
em `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`; não alterar
1077 ou migrations integradas. Conteúdo/proveniência clínica reutilizam colunas
cifradas existentes; não adicionar nova coluna de versão sem necessidade provada.

### Composição e independência

Grupo pessoal aceita catálogo autorizado e custom acessível ao criador. Grupo
compartilhado aceita catálogo e custom da clínica; **nunca custom pessoal**,
nem sua cópia de descrição/composição disfarçada de entrada manual.
A mesma regra vale na duplicação/promoção para clínica e edição administrativa.

Custom/fonte alterado, desativado ou indisponível é sinalizado por entrada.
Permitir selecionar somente entradas válidas; não trocar composição por revisão
mais recente silenciosamente. Atualizar referência exige ação explícita no grupo.
Snapshots aplicados e cópias independentes continuam preservados. Duplicação de
entrada obsoleta pode conservar snapshot com estado indisponível, mas não habilitar
nova aplicação até atualização explícita. Nenhuma referência ganha acesso pelo grupo.

### Proveniência sem sistema paralelo

A primeira aplicação usa intenção tipada com grupo/revisão/entrada/UUID de ação.
O servidor valida/canonicaliza e persiste proveniência opcional no documento
editorial cifrado. Na materialização, estender de forma opcional o snapshot
cifrado de composição da alternativa com `origemGrupo` (schema,grupo,rev,entrada,
aplicação,porção aplicada). O código já copia esse buffer em `clonarFilhos`:
assim nova versão preserva proveniência sem consulta à biblioteca ou coluna extra.

Validar estrutura no runtime; o projetor atual é
`aplicacao/projecao-composicao.ts`. Adicionar testes a ele para que
esse campo interno não vaze no DTO clínico/paciente/PDF. Não confiar em tipos TS.
Após mudança manual da porção, conservar origem e registrar a porção atual no
snapshot daquela versão, sem reescrever a porção histórica da aplicação anterior.
Copy PA02/modelos devem transportar somente proveniência autorizada internamente,
nunca tratá-la como permissão atual ou requerer grupo ainda ativo. O resolver
compara com snapshot anterior persistido; novo nonce/chave/destino demanda
validação atual. Clone histórico não é nova aplicação de biblioteca.

## 3. Fluxos de interface e regras de aplicação

### Biblioteca e administração

1. Área profissional: pesquisa por nome; filtros categoria/etiqueta, escopo,
   estado e favorito; lista paginada25 (limite100, teto de página existente).
   Pessoal/compartilhado e arquivado têm rótulos claros. Arquivados só por filtro.
2. Criar/editar: nome, descrição, organização flexível e até20 alimentos com
   porções explícitas. Reordenar por botões acessíveis/teclado; sem DnD novo.
   Não presumir equivalência; mostrar aviso factual antes de salvar/aplicar.
3. Duplicar: prévia editável, novo nome/UUID/revisão1 e idempotência própria;
   alimentos/porções/ordem/organização copiados, favorito não copiado. Pessoal
   por padrão; compartilhamento exige autorização e confirmação explícita.
   A operação revalida acesso à origem e revisão; não atualiza a origem.
   Grupo arquivado acessível também pode ser duplicado: a nova cópia é ativa,
   sem reativar o original ou tornar válidas suas fontes indisponíveis.
4. Compartilhar: ação explícita do criador autorizado; valida todas as fontes,
   avisa que membros autorizados/administração verão o grupo e aplica CAS.
   Não inferir consentimento de cópia pessoal. Promoção pessoal→clínica é
   permitida; conversão clínica→pessoal não retira acesso aos demais: duplicar
   pessoal e arquivar o compartilhado conforme permissão.
5. Arquivar/restaurar com CAS e confirmação; sem DELETE destrutivo. Restaurar
   não revive alimento indisponível, aplicação anterior, liberação ao paciente
   ou vínculo revogado. Grupo clinic do criador que saiu permanece sob gestão
   Client/SuperAdmin do tenant, sem reassinar autoria automaticamente.
6. Administração: visão própria em configurações da clínica/console conforme
   papel; somente grupos compartilhados. Criador/administrador editam metadados,
   fontes e porções autorizadas, com mesmo validador/cifra/CAS/auditoria.
   Administrar grupo não concede licença para editar custom de outro criador.
   Extrair resolução/projeção mínima de fontes genéricas como helper interno
   reutilizável, com política explícita para catalogo e custom da clínica;
   não chamar o helper profissional com identidade falsa nem abrir lista pessoal
   para permitir que Client edite entradas compartilhadas.

### Aplicação seletiva

1. No alimento principal do editor, abrir grupo e prévia. Selecionar alternativas,
   editar individualmente porções válidas e conferir fonte. Cancelar não toca o
   formulário. Personalização não altera a biblioteca. Estado só em memória.
2. Comparar identidade `(origem,id)`; nunca nome como equivalência científica.
   Excluir o próprio principal independentemente da porção. Identidades de
   catálogo de versões diferentes não se unificam por descrição/código isolado.
3. Mesma identidade + mesma porção/unidade normalizadas: indicar existente e
   não inserir novamente, inclusive duplicatas dentro da seleção. Mesma
   identidade com porção distinta: decisão explícita, padrão manter a existente;
   pode acrescentar porção distinta deliberadamente, sem apagar/sobrescrever a
   anterior. Mostrar diferenças. Validar precisão/peso conforme contrato do plano;
   não comparar só texto nem aplicar arredondamento clínico silencioso.
4. Legado sem identidade estável: informar limite de detecção; eventual nome
   coincidente é apenas possível repetição para conferência, nunca deduplicação
   automática nem garantia de identidade. Não promover legado manual a catálogo.
5. Ao confirmar, acrescentar apenas selecionadas válidas e não repetidas; novas
   `preferida=false` e `liberadaParaPaciente=false`. Preservar principal,
   substituições atuais, flags, ordem e preferências de apresentação PA05.
   Aplicações podem ser repetidas a itens distintos; cada destino é revalidado.
6. Manter limite20 alternativas/item e96KiB do documento APÓS expansão.
   Operação integral; nenhuma truncagem. Biblioteca inicial aplica a um item
   por prévia; múltiplos destinos simultâneos ficam na melhoria FOOD04-C02.
   O mesmo grupo continua reutilizável em múltiplos itens/planos por ações
   explícitas sucessivas, atendendo o roadmap sem escrita multi-plano.
7. Reusar coordenador/posse PA07 e autosave60s. Aguardar save em voo, suspender
   durante confirmação e revalidar contexto atual antes de inserir; depois
   atualizar documento e retomar timer. Não fazer save paralelo nem perder campos
   editados enquanto prévia carregava. Cancelamento/abort/contexto diferente
   descarta resposta tardia. Prévia não equivale a persistência.
8. Save valida grupo ativo/revisão, fontes, paciente/carteira e rascunho na mesma
   transação; UUID da ação impede replay. Preservar cópia já salva após mudança
   do grupo. Autorização revogada/grupo arquivado antes do primeiro save gera
   conflito sem gravação parcial; alterações locais ficam disponíveis para corrigir.
9. Desfazer essencial: antes do primeiro envio que inclua a aplicação, remover
   somente chaves inseridas por aquela ação se ainda não foram editadas e a
   posse/contexto continuarem iguais. Assim que save iniciar/ACK ou houver edição
   dependente, desabilitar a ação e manter remoção manual normal. Nunca restaurar
   uma cópia inteira antiga do formulário. Undo persistente fica em FOOD04-C03.
10. Publicar/gerar nova versão, portal/PDF e macros seguem os contratos existentes.
    Alternativas não entram como consumo nem como soma dos itens principais.
    Grupo/favorito não autoriza exposição de alternativa ao paciente.

## 4. Matriz de permissões implementada no backend

O catálogo é primariamente estático por papel. Foram acrescentadas
`grupos_substituicoes.compartilhar` a Professional e
`grupos_substituicoes.administrar` a Client/SuperAdmin, com testes de segregação.
Não criar delegação genérica
por usuário nesta fase. Contexto de tenant é sempre verificado no servidor.

| Ator/condição | Pessoal | Compartilhado | Duplicar/favoritar/aplicar |
| --- | --- | --- | --- |
| Professional criador ativo + ler/gerenciar planos conforme operação | Ler/criar/editar/arquivar/restaurar próprio | Criar/editar/arquivar/restaurar próprio; compartilhar requer capacidade específica | Duplicar para pessoal; favorito próprio; aplicar só no paciente/rascunho autorizado |
| Outro Professional ativo da mesma clínica | Nenhuma leitura/escrita | Consultar/reutilizar; não editar/arquivar/restaurar alheio | Duplicar para pessoal/favoritar/aplicar com permissão; cópia clínica exige compartilhar |
| Client + administrar | Nenhum acesso | Ler/editar/arquivar/restaurar quaisquer da própria clínica, inclusive criador desligado | Sem aplicação clínica/favorito pessoal/duplicação em nome de profissional |
| SuperAdmin + administrar + tenant efetivo verificado | Nenhum acesso pessoal por este módulo | Mesmo limite de administração institucional | Não usar privilégio de grupos para obter carteira/agir em nome do criador |
| Collaborator, Patient, permissão/vínculo ausente ou outro tenant | Negado | Negado | Negado |

Leitura Professional exige `planos_alimentares.ler`, escrita própria
`planos_alimentares.gerenciar`; favorito e duplicação exigem identidade profissional
própria. O caminho administrativo tem controller/guardas próprios e autorização
por grupo compartilhado; não alargar `identidadeBiblioteca` nem conceder a Client
`planos_alimentares.gerenciar`. Atualizar matriz backend/Web/BFF, testes e
`MAPA_ROTAS_PERMISSOES.md`. Verificar sessão/refresh de claims sem confiar em
permissão antiga no navegador. Nenhuma rota aceita tenant/profissional arbitrário.

Eventos transacionais: criar, editar, duplicar, compartilhar, arquivar, restaurar,
e ação administrativa. Reusar infraestrutura de auditoria com ator e alvo;
metadata mínima de revisão/ação sem nomes, porções ou corpo clínico. Registro da
aplicação pertence ao save clínico e à proveniência cifrada, sem duplicar prontuário
no log. UUID interno de origem não pode virar endpoint que contorne autorização.

## 5. Plano de testes, riscos e rollout

Risco da futura implementação: **R4**, por authz/RLS e snapshots clínicos.
Checklist e dependências: [todo-pos-320-food04.md](todo-pos-320-food04.md).

| Risco / gap | Testes e critério objetivo |
| --- | --- |
| G01 privacidade/administração | Matriz completa incluindo Client sem permissão, outro tenant, outro profissional, vínculo arquivado, compartilhado órfão; pessoal sempre oculto ao admin |
| G02 custom pessoal/fonte oculta | Negar promoção/duplicação clínica com custom pessoal; fonte inacessível não vaza via listagem/detalhe/origem/favorito |
| G03 idempotência/CAS/RLS | PostgreSQL real não-owner/NOBYPASSRLS, FORCE RLS, tenant ausente/incorreto; corrida de criação/duplicação/arquivo/restauração/edição/save e revisão vencida |
| G04 duplicação independente | NovoID/porções/ordem/organização; origem interna; alterar/arquivar original não muda cópia; replay não duplica |
| G05 aplicação seletiva/dedup | Principal excluído; selecionadas apenas; porção personalizada; repetição exata não entra; divergência exige escolha; cancelamento intacto; flags novas falsas |
| G06 snapshot/proveniência | Editar/arquivar/restaurar biblioteca/fonte não recalcula cópia salva; nova versão/copy/modelos preservam composição; projected DTO não vaza metadados |
| G07 UI/concorrência | Autosave60s, save em voo, duas abas/posse, troca de paciente/plano, resposta tardia,96KiB/limite20, erro acessível; undo não reverte novas edições |
| G08 filtros/favoritos | Pesquisa HMAC, paginação estável/contagem autorizada, acentos/categoria/estado, favorito de outro usuário não acessível; restaurar não libera conteúdo |
| G09 regressões | PA02–PA07, FOOD01–03, manual/catálogo/custom, totais/micros/ausências, publicação/portal/PDF e escolhas append-only preservados |
| G10 auditoria | Eventos na mesma transação; erro rollback; redação sem nomes/conteúdo; ação administrativa identifica ator sem personificar criador |

TDD: testes positivos/negativos primeiro RED, código, GREEN e regressões. Provas
Postgres executam com dados sintéticos em instância descartável. O runner atual
`test-rls-testcontainers.mjs` enumera duas suites explicitamente: incluir suite/flag
FOOD04 ou step dedicado no CI; existir spec não prova execução. Ordem de locks
compatível paciente→plano→versão e depois grupo/fontes em ordem estável;
CRUD biblioteca não trava paciente em ordem inversa. Não converter falhas de
infra/segurança em save bem-sucedido.

Gates: backend unit/integral/typecheck/build; Postgres real; BFF/authz; Web
lint/typecheck/build; Playwright desktop/mobile/a11y; revisão R4 com autoria e
achados; governança/secrets e CI/scanners do HEAD final. Registrar PASS/FAIL/
BLOCKED/SKIPPED de fato. Revisão própria não é revisão independente.

Rollout posterior: migration aditiva antes do código que usa as novas tabelas;
alvo/branch/role e autorização específica a confirmar, ensaio quando aplicável,
verificação de registro/RLS/constraints. Rollback mantém tabelas, dados e snapshots;
retirar entrada de novas operações com leitor compatível. Não usar down destrutivo
nem downgrade que rejeite documento editorial FOOD04. Nenhum comando externo
operacional é autorizado por este plano.

## 6. Entrega essencial e complementares

**FOOD04 essencial, uma PR:** todos os requisitos obrigatórios aprovados: CRUD,
pessoal/compartilhado, administração específica e continuidade após saída do
criador, duplicação independente, descrição/categoria/etiquetas, pesquisa/filtros,
favoritos, ordem por teclado, arquivo/restauração, prévia seletiva/porções/dedup,
acréscimo não destrutivo, undo local seguro, proveniência/versionamento, auditoria,
RLS, permissões, autosave e testes/regressões. Nenhum destes é adiado por conveniência.

**Complementares propostos (sem implementação antecipada):**

| ID | Conteúdo | Justificativa/dependências |
| --- | --- | --- |
| FOOD04-C01 | Avisos de incompatibilidade alimentar | Busca no código encontrou pergunta livre em `questionarios/dominio/modelos-questionario.ts`, não cadastro estruturado + mapeamento alimento/alérgeno validado. Exige protocolo, dados/fontes e revisão clínica próprios; FOOD04 sem aviso não declara alimento seguro |
| FOOD04-C02 | Aplicar simultaneamente em vários destinos/planos | Reuso sucessivo já atende o requisito; lote amplia transação, conflitos e confirmação de porções por destino |
| FOOD04-C03 | Desfazer após save e histórico de edições da biblioteca navegável/diff completo | Auditoria e proveniência essenciais preservadas; undo persistente exige inversão transacional/CAS sem perda de edições; timeline completa não necessária ao CRUD seguro |

FOOD05 continua exclusivamente responsável por equivalência/ajuste automático
por nutriente. Os modelos de referências/porções podem ser reutilizados depois,
sem criar motor, migrations ou dependências antecipadas. Complementares são
possibilidades registradas; exigem escopo/autorização próprios.

## Verificações desta etapa e handoff

PASS anterior: fetch/main9e1984a2; inspeção de contratos e referências FOOD04;
diff/secrets, links locais e matriz documental40 referências. Nesta revisão:
inspeção adicional de permissões/guardas, auditoria, snapshots e alergias,
apenas código/documentação do projeto, sem dados reais. PASS nesta revisão:
`git diff --check`, `node scripts/scan-secrets.mjs`,
`node scripts/test-matriz-confiabilidade.mjs` (40 referências críticas),
verificação local Python (4 links FOOD04 válidos, nenhum marcador de decisão
pendente), e novo fetch confirmando main9e1984a2. `pnpm validate:docs` anteriormente
BLOCKED por `powershell` ausente; não inferir PASS. Ambiente observado
Node24.19.0/pnpm11.19.0 diverge do requerido22.x/11.25.0: ajustar antes do código.
Testes de implementação/Postgres/CI/builds/Playwright permanecem SKIPPED.

**Modelos:** escopo ampliado inclui administração/RLS e proveniência. Recomendação
atual: Sol6.1 médio para backend/contratos e integração crítica (T01–T10); Luna
alto para UI/helpers/testes delimitados (T11–T12); Sol médio para revisão R4 e
fechamento (T13–T14). Avisar e pausar antes de qualquer troca manual. Não trocar
modelo automaticamente; avisar e pausar antes da etapa de interface.

## Execução autorizada

Checkpoint e provas reais: [execucao-pos-320-food04.md](execucao-pos-320-food04.md).
Os estados SKIPPED da seção de planejamento descrevem a rodada documental;
o ledger distingue execução nova de gates finais ainda pendentes.

### Ajustes fundamentados nos contratos reais

- Nova versão do mesmo plano herda proveniência do snapshot cifrado autorizado,
  inclusive no primeiro save depois de arquivar a biblioteca/fonte. Essa origem
  nunca se transforma em capability pública ou acesso à biblioteca anterior.
- PA02 e modelos genéricos transportam fatos nutricionais selecionados, criam
  novas chaves editoriais e não têm capability para herdar autoridade interna de
  aplicação. Não copiar `origemGrupo` para esses novos itens: seria replay em
  outro pai/paciente. A aplicação original mantém sua proveniência no histórico;
  a cópia mantém composição/porções independentes, sem atribuir uma nova aplicação
  não verificada ao grupo. Rastreabilidade adicional entre essas cópias exige
  contrato autenticado de origem, não confiar no UUID enviado pelo navegador.
  Isto esclarece T08/G06 sem alterar o contrato legado de cópia nem expor origem
  de outra carteira. A regressão de cópia factual continua obrigatória em T13.
- Duplicação da biblioteca revalida fontes acessíveis e atuais. Referência
  obsoleta não é atualizada silenciosamente: editar/remover/substituir explicitamente
  a entrada antes de confirmar. O grupo original e aplicações existentes permanecem.
- Administração dispõe de consulta mínima própria de fontes de grupos:
  catálogo ativo/aprovado e custom compartilhado. Não conceder ao Client as
  consultas clínicas do Professional para preencher o seletor.
