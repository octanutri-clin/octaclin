# OctaClin - Runbook de operacao de lancamento

Este documento controla a abertura do primeiro piloto assistido. Ele nao
autoriza cliente real sozinho: contrato, consentimentos, identidade publica e
os demais gates de `CHECKLIST_GO_LIVE.md` continuam obrigatorios.

## Escopo inicial

- Um unico cliente piloto por janela.
- WhatsApp fora da oferta inicial; manter o canal desligado ou identificado
  como beta ate o aceite da Fase 230.
- Pagamento por PIX e controle manual conforme a Fase 224.
- Mobile e IA fora da oferta enquanto a Fase 241 estiver pendente.
- Agenda interna, Google Calendar e Gmail podem ser usados somente depois dos
  respectivos healthchecks saudaveis.

## Janela do piloto

- Fuso oficial: `America/Sao_Paulo`.
- Preferencia: terca a quinta-feira, das 09:00 as 11:00, fora de feriados.
- Reservar duas horas para ativacao e manter monitoramento reforcado por 48 horas.
- Nao iniciar nas 24 horas anteriores ao backup/restore programado, durante
  manutencao de provedor ou com mudanca nao relacionada aguardando deploy.
- A data concreta e o cliente sintetico/real ficam em
  `OPERACAO_LANCAMENTO_CONTROLE.md`.

## Responsabilidades

| Funcao | Responsabilidade |
| --- | --- |
| Responsavel primario | Octavio, titular da operacao OctaClin: acompanha monitor, declara GO/NO-GO e coordena comunicacao. |
| Executor tecnico | Pessoa registrada no controle ate T-24h: diagnostico, rollback e evidencias tecnicas. Pode ser o responsavel primario no piloto de uma unica clinica. |
| Atendimento | Pessoa registrada no controle ate T-24h: contato com o cliente e registro da linha do tempo. |
| Observador | Confirma os gates e impede que pressao comercial ignore um NO-GO. |

Se qualquer funcao obrigatoria estiver sem responsavel alcancavel, a decisao e
`NO-GO`. Uma pessoa pode acumular funcoes no primeiro piloto, mas os papeis e
os canais de contato devem permanecer distintos no controle.

## Gate T-24h

1. Confirmar contrato, consentimentos e identidade do cliente piloto.
2. Confirmar responsaveis e canal de contingencia fora do OctaClin.
3. Confirmar ultimo backup concluido e restore/canario semanal sem incidente.
4. Confirmar CI verde no commit candidato e ausencia de migration pendente.
5. Confirmar zero incidentes P0/P1 abertos.
6. Confirmar readiness, health detalhado e login web saudaveis.
7. Congelar mudancas nao relacionadas ate o fim da janela.
8. Registrar a decisao preliminar no controle.

## Gate T-30min

Executar e registrar novamente:

```powershell
$env:OCTACLIN_MONITOR_BACKEND_URL='https://octaclin-backend-producao.onrender.com'
$env:OCTACLIN_MONITOR_WEB_URL='https://octaclin-web-producao.onrender.com'
node scripts/monitor-producao.mjs
Remove-Item Env:OCTACLIN_MONITOR_BACKEND_URL
Remove-Item Env:OCTACLIN_MONITOR_WEB_URL
```

Tambem confirmar:

- `/health/pronto` e `/health/detalhado` com contrato saudavel;
- pagina `/login` com identidade OctaClin;
- backup recente e monitor automatico sem incidente aberto;
- fila/outbox sem atraso operacional;
- nenhum deploy ou migration em andamento;
- cliente, atendimento e executor tecnico disponiveis.

## Decisao GO ou NO-GO

Somente declarar `GO` quando todos os gates estiverem comprovados. Qualquer um
dos itens abaixo produz `NO-GO` automatico:

- readiness, dependencia ou web indisponivel;
- backup recente nao confirmado;
- migration pendente ou banco alvo ambiguo;
- incidente P0/P1 aberto;
- responsavel obrigatorio indisponivel;
- contrato/aceite juridico pendente;
- identidade publica ou dominio ainda nao liberado para cliente real.

Adiar nao e incidente. Registre o bloqueio, comunique o cliente sem prometer
novo horario e reagende somente depois de corrigir a causa.

## Sequencia de ativacao

1. Registrar `GO`, commit candidato, horario e responsaveis.
2. Provisionar a clinica pelo console Onboarding usando referencia comercial
   idempotente.
3. Enviar o convite; o proprietario define a propria senha.
4. Validar login do Client, convite do Professional e escopo de permissao.
5. Cadastrar somente os dados minimos aprovados do primeiro paciente.
6. Validar agenda interna; conectar Google apenas se fizer parte do piloto.
7. Distribuir um formulario curto e confirmar resposta/prontuario.
8. Confirmar email controlado; nao habilitar WhatsApp por conveniencia.
9. Registrar fim da ativacao e iniciar acompanhamento de 48 horas.

## Triagem de incidente

| Severidade | Exemplo | Acao inicial |
| --- | --- | --- |
| P0 | indisponibilidade geral, suspeita de vazamento ou perda de dados | pausar onboarding, preservar evidencia, acionar responsavel imediatamente e decidir rollback em ate 20 minutos |
| P1 | fluxo critico sem alternativa para o tenant piloto | pausar o fluxo afetado, comunicar cliente e mitigar ou reverter |
| P2 | degradacao com alternativa segura | registrar, orientar alternativa e priorizar correcao |
| P3 | duvida ou defeito cosmetico sem impacto operacional | registrar no backlog sem interromper a janela |

Nunca incluir token, senha, URL de banco, payload clinico ou dado identificavel
em issue, chat, screenshot ou relatorio do incidente.

## Matriz de rollback

| Falha | Acao primaria | Proibicao |
| --- | --- | --- |
| Backend ou web apos deploy | rollback no Render para o ultimo deploy saudavel e repetir healthchecks | nao aplicar migration adicional para tentar corrigir codigo |
| Migration ou integridade de dados | congelar escrita, preservar logs/request ID e convocar decisao de recuperacao | nao executar `migration:revert`, `down` ou restore sobre producao as cegas |
| Redis/filas | pausar operacoes dependentes, validar conexao e credencial vigente | nao executar `FLUSHDB`/`FLUSHALL` |
| Gmail ou Google Calendar | desligar ou suspender o canal afetado e manter agenda interna | nao rotacionar OAuth sem registrar impacto e plano de reconexao |
| WhatsApp | manter canal fora da oferta/desligado e usar email aprovado | nao usar automacao nao oficial |

Depois do rollback, exigir duas leituras saudaveis separadas por pelo menos
cinco minutos antes de declarar recuperacao. Uma resposta `200` isolada nao
encerra o incidente.

Antes de promover um release, registrar tambem o snapshot sanitizado da aba
`Rollout` da Fase 242. A recomendacao automatica apoia o GO/NO-GO, mas nao
substitui os responsaveis desta janela. Uma flag pode conter IA ou sincronizacao
mobile por tenant; falha de health, fila indisponivel ou 5xx critico exige a
matriz de rollback mesmo que as flags estejam desligadas.

## Comunicacao

### Aviso inicial

> Identificamos uma indisponibilidade no OctaClin e pausamos a ativacao para
> proteger seus dados. A equipe esta atuando e enviaremos nova atualizacao ate
> [horario].

### Atualizacao

> O atendimento continua em andamento. O acesso permanece pausado enquanto
> validamos a recuperacao. Proxima atualizacao ate [horario].

### Recuperacao

> O servico foi recuperado e passou por duas verificacoes de saude. Retomaremos
> a ativacao somente apos sua confirmacao. Enviaremos o resumo do impacto e das
> medidas adotadas pelo canal acordado.

Nao afirmar que nao houve perda ou exposicao antes de a verificacao tecnica
estar concluida. Incidente de dados segue tambem o fluxo juridico/LGPD aplicavel.

## Encerramento do incidente

1. Confirmar duas leituras saudaveis e ausencia de erro correlato.
2. Confirmar consistencia do tenant e da operacao interrompida.
3. Registrar impacto, linha do tempo, causa, mitigacao e responsavel.
4. Comunicar recuperacao sem dados sensiveis.
5. Abrir post-mortem para P0/P1 em ate um dia util.
6. So retomar onboarding com nova decisao `GO`.

## Exercicio sintetico

O comando abaixo simula `readiness 503` apos um deploy, sem rede, credenciais,
tenant ou dados reais:

```powershell
pnpm exercicio:lancamento
pnpm test:lancamento
```

O aceite exige deteccao em ate 10 minutos, classificacao P0 em ate 15,
decisao de rollback em ate 20, recuperacao em ate 45, duas leituras saudaveis,
comunicacao sem dados sensiveis e nenhum revert cego de migration.

## Evidencias da janela

- commit e CIs do candidato;
- execucoes do monitor e do backup;
- decisao GO/NO-GO e responsaveis;
- horarios dos marcos sem payloads sensiveis;
- resultado das duas leituras de recuperacao;
- comunicacao enviada e referencia do post-mortem, quando aplicavel.

As evidencias ficam em sistemas com controle de acesso; o repositorio recebe
somente identificadores e conclusoes sanitizadas.
