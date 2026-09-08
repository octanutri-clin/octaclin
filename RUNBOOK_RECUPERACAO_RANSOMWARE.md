# OctaClin - recuperacao de backup e ransomware

Este runbook define o controle operacional do PR 53 da governanca. Ele cobre o
banco PostgreSQL e o armazenamento de seus backups. Nao substitui o plano geral
de incidente, obrigacoes legais ou a avaliacao dos provedores.

## Objetivos e limites

| Objetivo | Meta inicial | Como e provado |
| --- | --- | --- |
| RPO do banco | 24 horas | backup diario; no exercicio, idade entre o snapshot e a conclusao da validacao |
| Tolerancia para alerta de atraso | 2 horas alem do RPO | incidente do workflow e revisao de recencia; nao altera o RPO |
| RTO do restore do banco | 30 minutos | download, restore e validacao dos manifestos no alvo dedicado |

O RTO acima termina quando o banco restaurado foi validado. Ele nao promete que
web, backend, Redis, DNS, integracoes ou comunicacao com clientes estarao
recuperados em 30 minutos. O tempo total do servico deve ser medido em um
exercicio posterior que inclua essas dependencias.

O backup automatico roda diariamente e o restore de prova roda aos domingos ou
quando `restore_test=true` e um operador autorizado dispara o workflow. A
retencao esperada e 8 dias para `daily/`, 29 dias para `weekly/` e 93 dias para
`monthly/`. Os objetos e os arquivos de checksum usam cifragem AES-256 no B2.

## Estado da imutabilidade

**Object Lock em modo COMPLIANCE com retencao padrao ainda esta nao comprovado
no bucket atual.** Versionamento, lifecycle e cifragem nao sao WORM e nao devem
ser descritos como imutabilidade contra ransomware.

O workflow consulta `get-object-lock-configuration`. Somente registra
`object_lock_compliance` quando o bucket informa Object Lock habilitado, modo
`COMPLIANCE` e prazo padrao positivo. Falha de permissao, configuracao ausente,
modo `GOVERNANCE` ou Object Lock sem retencao resultam em `nao_comprovada`.

`OCTACLIN_BACKUP_IMUTABILIDADE_OBRIGATORIA` deve permanecer `false` enquanto a
configuracao real nao for confirmada. Ativar Object Lock no Backblaze e uma
mudanca de infraestrutura irreversivel no bucket e exige aceite humano,
definicao do prazo/custo, verificacao das application keys e plano para
lifecycle. Depois da configuracao, definir a variavel como `true` transforma a
ausencia da prova em falha fechada do backup.

Excecao aberta: enquanto esse gate estiver `nao_comprovada`, o controle reduz o
risco com bucket privado, credencial separada, cifragem, checksum, retencao
versionada e restore semanal, mas nao fecha o risco de exclusao por uma
credencial com capacidade suficiente.

## Separacao de credenciais e ambientes

- A origem usa `octaclin_backup_producao`, nunca `neondb_owner` nem a role de
  runtime da aplicacao. O manifesto confere `current_user`, e nao apenas o nome
  escrito na URL.
- O restore usa `neondb_owner` somente no banco dedicado configurado em
  `OCTACLIN_RESTORE_DATABASE_EXPECTED`.
- A validacao recusa origem e destino iguais. Nao restaurar backup sobre producao
  para testar, investigar ou ganhar tempo.
- A application key do B2 e exclusiva do ambiente `production-backup`; nao deve
  ser reutilizada pelo backend, por estacoes pessoais ou por integracoes.
- Nenhuma connection string, hash de senha, linha clinica, tenant ou nome de
  bucket privado deve ser copiado para issue, PR ou log.

## O que o restore valida

1. O dump customizado e legivel por `pg_restore --list`.
2. O SHA-256 local coincide com metadado, sidecar e objeto baixado.
3. Origem e destino executam com banco e role esperados.
4. A lista ordenada de migrations e tabelas publicas e identica.
5. Toda tabela que hoje contem `tenant_id` e descoberta dinamicamente; todas
   precisam preservar `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` e
   uma policy completa baseada em `app.tenant_id`.
6. As tabelas clinicas criticas continuam consultaveis e o destino contem pelo
   menos um tenant e um usuario.
7. A idade do snapshot fica dentro de 24 horas e o restore completo fica dentro
   de 30 minutos.

As contagens de linhas sao capturadas e sanitizadas, mas nao sao exigidas como
iguais entre a consulta da origem e o destino: a origem pode receber escritas
entre o manifesto e o snapshot consistente do `pg_dump`. O checksum do dump,
a equivalencia estrutural e a leitura do destino sao as provas sem introduzir
uma corrida falsa no gate.

## Gate de execucao real

Antes de disparar `Backup producao` manualmente com `restore_test=true`:

1. Confirmar repositorio, branch, ambiente `production-backup`, banco de origem
   e nome exato do banco dedicado de destino.
2. Confirmar que o destino pode ser limpo e que nao atende aplicacao ou pessoa.
3. Registrar responsavel e janela fora do Git, sem secrets.
4. Manter `configurar_retencao=false`, salvo se a alteracao de lifecycle tiver
   sido revisada e autorizada separadamente.
5. Executar o workflow e guardar apenas URL, commit, conclusao, duracoes e
   estado sanitizado da imutabilidade.

PASS exige todas as etapas verdes, `restore_test=true`, manifestos equivalentes,
RPO/RTO dentro da meta e alvo dedicado. `SKIPPED`, execucao somente de backup ou
evidencia de uma versao anterior do workflow nao fecha o PR 53.

Se o restore falhar, nao tentar sobre producao. Preservar a URL da execucao,
classificar a etapa (download, checksum, `pg_restore`, schema, tenancy ou tempo),
verificar o backup semanal anterior e corrigir o procedimento em outro alvo
dedicado. Uma segunda tentativa exige entender a primeira falha.

## Resposta a ransomware

### 1. Declarar e conter

- Declarar incidente e nomear um comandante. Usar comunicacao fora dos sistemas
  possivelmente comprometidos.
- Isolar workloads e credenciais afetadas; impedir novos deploys e jobs de
  escrita. Nao apagar evidencias nem desligar recursos indiscriminadamente.
- Revogar sessoes e rotacionar credenciais comprometidas do runtime. Credenciais
  de backup e restore sao tratadas separadamente; rotaciona-las sem antes
  preservar acesso a uma copia conhecida pode destruir o caminho de recuperacao.
- Preservar logs, imagens e indicadores conforme o plano de incidente. Acionar
  juridico/DPO quando houver suspeita de dados pessoais; este runbook nao decide
  notificacao regulatoria.

### 2. Selecionar copia conhecida como limpa

- Nao escolher automaticamente o objeto mais novo. Comparar o inicio estimado
  do comprometimento com backups daily/weekly/monthly.
- Confirmar checksum, cifragem, retencao e, quando disponivel, Object Lock.
- Restaurar primeiro no banco dedicado, sem acesso dos runtimes comprometidos.
- Validar migrations, tabelas, RLS, tenants e usuarios pelo workflow. Investigar
  qualquer divergencia antes de reconstruir servicos.

### 3. Reconstruir e recuperar

- Recriar infraestrutura e credenciais a partir de configuracao versionada e
  fontes conhecidas como limpas; nao confiar em imagens ou tokens do ambiente
  afetado.
- Ordem minima: identidade/segredos, banco validado, backend sem jobs, health e
  leitura controlada, workers/filas, web e integracoes externas.
- Liberar escrita e trafego gradualmente, com monitoramento reforcado. Registrar
  o ponto de recuperacao efetivo e o tempo total; diferenciar restore do banco
  de recuperacao integral do servico.

### 4. Encerrar e aprender

- Rotacionar novamente qualquer credencial temporaria usada na recuperacao.
- Confirmar que jobs, webhooks e filas nao repetiram efeitos antigos.
- Documentar causa, impacto, RPO/RTO observado, copia escolhida, excecoes e
  acoes corretivas sem dados pessoais.
- Executar tabletop apos mudancas relevantes e pelo menos trimestralmente. O
  exercicio deve incluir copia comprometida, credencial de backup indisponivel,
  Object Lock ausente e dependencia externa fora do ar.

Referencias oficiais: CISA `#StopRansomware Guide` e documentacao Backblaze B2
`Cloud Storage Object Lock`. O principio aplicado e manter copias cifradas e
separadas, testar integridade/restauracao e usar delete protection/Object Lock
quando o provedor e a decisao operacional permitirem.

## Rollback do PR 53

Reverter o workflow e os validadores nao altera banco nem objetos ja gravados.
Nao desfazer lifecycle, Object Lock ou retencao no provedor como parte de um
rollback de codigo. Se o novo manifesto revelar uma falha real, corrigir o alvo
dedicado ou a role; nao enfraquecer o gate para obter verde.
