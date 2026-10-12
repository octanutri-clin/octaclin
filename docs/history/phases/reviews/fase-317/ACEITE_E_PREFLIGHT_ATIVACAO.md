# Aceite operacional e preflight de ativação da Fase317

## Autorização recebida — 2026-10-12

O proprietário confirmou merge/CI verde da PR405 e aplicação da migration1070
em staging e produção. Em seguida declarou seu aceite final do termo/operação
de moderação e autorizou a ativação. A autorização está recebida e não precisa
ser solicitada novamente para o mesmo escopo. Não constitui parecer jurídico
independente, aceite de pacientes ou dispensa de defeitos verificáveis de segurança.

Main examinada: `315dd35c24d527298faf383c6dd2aad74adc5f43`.
Base da revisão R4: `a84921fbb4ec98ac267ef262362080698d03e03e`.

## Evidência operacional somente por leitura

Alvos já identificados pelo proprietário nesta conversa:

- Produção: projeto Neon Octaclin-produção, branch production,
  banco Octaclin-db-producao.
- Staging: projeto Neon octaclin-staging, branch production, banco neondb.

Consultas SELECT em migrations/pg_class/pg_namespace/pg_constraint/pg_roles e
has_table_privilege confirmaram, em ambos os alvos:

- Ledger contém PilotoGamificacao1720000001070.
- Dez tabelas317 examinadas têm RLS e FORCE RLS ativos; owner neondb_owner.
- Roles octaclin_app_producao/staging: NOSUPERUSER e NOBYPASSRLS, login ativo.
- Privilégios SELECT/INSERT/UPDATE/DELETE nas dez tabelas para essas roles.
- Doze constraints fk_*317 continuam NOT VALID conforme o desenho aditivo.
  Isso não comprova órfãos ausentes nem autoriza validar constraints implicitamente.

Não foram lidos nomes, prontuários, conteúdo comunitário ou linhas de pacientes.
A conexão do conector é owner: catálogo não prova que o backend usa a role
runtime correta. Deploy/identidade do processo/worker/purga continuam pendentes.
Não houve DDL, escrita de banco, alteração de ambiente ou ativação.

## Revisão R4 independente técnica

Revisor separado `/root/review_317_activation`, contexto inicial sem histórico
de autoria, sem edição do patch. Revisão estática, sem testes executados ou
acesso a banco pelo revisor. Não é revisão humana, jurídica ou clínica.

### R4-ATIV-01 — HIGH, bloqueante

Mudanças reversíveis de carteira/DOB/arquivamento não persistem imediatamente
a revogação de participação317. A invalidação só é persistida pelo cron de
cinco minutos. Transferência A→B→A antes da rodada deixa membro/geração/aceite
ativos e permite que conteúdo volte a aparecer sem novo convite/aceite.

Evidências: servico-circulos-piloto.ts perfis (linhas23–41),
servico-retencao-piloto.ts (19–21), processador-retencao-piloto.ts (12),
ServicoPacientes.atualizar (362/393/403), arquivar/restaurar (420/441).
Verificar também profissionais arquivar/restaurar, alteração de identidade de
acesso e transições LGPD. O teste PG atual só verifica o período fora da carteira.

Correção necessária: invalidar na mesma transação da mudança, com lock317 antes
dos locks de linhas, ocultação persistente e prazos sem extensão. Retorno não
restaura a geração; novo convite/aceite permanece obrigatório. Avaliar também
conquistas compartilhadas. Não alterar1070 já aplicada nem instalar trigger que
inverta a ordem de locks do núcleo. Provar ida/retorno sem cron e concorrência
em PostgreSQL descartável. O cenário foi identificado estaticamente; reprodução
por teste de implementação ainda pendente.

### R4-ATIV-02 — HIGH, bloqueante

dataCivilHoje fixa America/Sao_Paulo e ignora obterTimezoneClinico já existente.
No instante sintético2026-10-13T03:30Z, em SP é13/10 e em Rio Branco ainda12/10.
DOB2008-10-13 pode ser admitida antes do aniversário civil no fuso configurado.
As datas foram conferidas com Intl em execução local; não é teste da integração.

Correção necessária: usar o resolvedor clínico validado, mantendo fallbackSP,
e testar aniversário em fuso alternativo, fallback, configuração inválida e29/02.
Não aceitar relógio/fuso do cliente.

## Gates

| Gate | Estado nesta rodada |
| --- | --- |
| G00 | PASS: base e merge conferidos |
| G01 | Aceite final operacional recebido do proprietário; sem atribuir parecer jurídico inexistente |
| G02 | BLOCKED: revisão independente realizada, dois HIGH ainda sem correção |
| G03 | PASS de catálogo externo e provas locais anteriores; identidade efetiva de runtime ainda não comprovada |
| G04 | CI verde do código mergeado; correções futuras exigem novos testes/checks |
| G05 | Autorização de ativação recebida; preflight/escopo/deploy/worker pendentes e G02 bloqueante |

O proprietário confirmou o workspace My Workspace da conta Octaclin
(tea-d9ag97gk1i2s73fjn03g) e a liberação somente do controle global. Cada gestor
habilita conquistas/comunidade da própria clínica pelo console; nenhuma flag
de tenant ou aceite de paciente será alterado nesta ativação. Staging backend
srv-d9agg1jeo5us739u40t0 e produção srv-d9hm4anlk1mc73e8a8s0 foram identificados;
o último deploy de ambos estava live no SHA315dd35c, anterior às correções.

Próximas ações: corrigir os dois achados com regressões e revisar o novo SHA;
confirmar identidade/deploy/worker no workspace aprovado; ensaiar em staging;
habilitar gate literal e a configuração do escopo autorizado, verificar e
documentar o resultado. Rollback funcional desliga flags/gate e mantém histórico,
revogação/retencão/tombstones e schema. Não usar migration:revert.


## Correções preparadas após confirmação do escopo

R4-ATIV-01: invalidação transacional com lock317 antes dos acessos a linhas nos
escritores de responsável/DOB do console e DOB do portal, arquivamento de paciente
ou profissional, desativação de conta e transição LGPD. A ocultação existente foi
extraída para helper interno, com os mesmos filtros/prazos e sem módulo paralelo.
Retorno não reativa participação; conquistas perdem compartilhamento/aceite daquele
contexto. Autor histórico não revoga compartilhamento vigente de outro responsável.
Nenhuma migration nova ou alteração da1070.

R4-ATIV-02: data civil usa obterTimezoneClinico, com validação e fallback existentes.
Não há fuso/relógio vindo do cliente. Teste RED reproduziu o fuso errado; testes
posteriores PASS. Revisão estática independente final favorável, sem achados
bloqueantes remanescentes no diff examinado; prova funcional PG ainda necessária.
A revisão é de agente sem autoria, não parecer humano/jurídico.

PASS local: suite ampla309/2713 testes (82 condicionais SKIPPED nessa invocação,
antes do último caso PG de concorrência), foco66, typecheck/build backend, diff,
secrets e redacao de auditoria. Os números são evidência da execução descrita,
não aprovação de código posterior ou de ambientes externos.

PostgreSQL local BLOCKED: tentativa de subir fixture falhou com no space left on
device. Isso não é RED do defeito de transferência. Cache/imagens próprios
transitórios foram removidos, mantendo código/worktrees/artefatos316 e dados externos.
O CI deverá executar29 casos da317 (21 originais +8 novos), com schema completo,
role runtime sem bypass, RLS e cenários de retorno/concorrência. Sem alterar
fixture para simular Timescale ou usar banco real de pacientes no teste.

G02: revisão técnica estática favorável, liberação condicionada à prova PG/checks
do SHA final. G05 permanece pendente até as correções serem integradas e servidas,
preflight do processo/retencão e atualização do gate global literal true. A
confirmação atual autoriza essa atualização após os requisitos; não repetir aceite.
Merge de PR corretiva não foi autorizado e continua sob decisão do proprietário.
