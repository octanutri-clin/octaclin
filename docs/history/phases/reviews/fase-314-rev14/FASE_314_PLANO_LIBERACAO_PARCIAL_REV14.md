# OctaClin — Fase 314: liberação parcial independente de curvas e licenças pendentes (REV14)

Data: 2026-10-11. Objetivo: permitir uso da entrega factual e desenvolvimento das fases seguintes sem destravar indevidamente G01.

## 1. Evidências e escopo

- Base informada: `PENDENCIAS_LIBERACAO_FASE_314_REV11.md` enviado pelo proprietário. Relata CL01–CL10 ratificadas, resultados experimentais bloqueados, provas locais, e dependências de R4, CI e migrations 1068/1069 por ambiente.
- GitHub verificado na mesma data: `octanutri-clin/octaclin`, `main` SHA `2e06bcded890826d04a61cbbb8835c5f0b6af9b6`; PR #392 consta *merged* em 2026-10-11 12:42:12 UTC. Merge NÃO equivale a deploy nem a aplicação de migrations.
- Código observado em `main`: `antropometria-pediatrica.ts` salva exclusivamente snapshot `pediatrico-medidas-v1` com estado `protocolos_bloqueados`; `acompanhamento-pediatrico.tsx` oferece formulário, medidas originais, tabela, gráfico descritivo, paginação e mensagens de bloqueio. `indicadores-pediatricos-candidatos.ts` declara módulo experimental isolado.
- Divergências a reconciliar: documento REV11 diz CL08 implementada, mas `elegibilidade-adulta.ts` de `main` mantém `pollock_3`, `pollock_7`, `faulkner`, `guedes`, `cintura`, `rcq` como `pendente` na faixa 18–19. A interface diz “protocolo não ratificado”, embora o G02 tenha sido ratificado pelo proprietário na conversa, com documento REV9/registro de aceite. Conferir eventual branch/worktree mais recente antes de alterar.

## 2. Três trilhas independentes

### A. Candidata à liberação em uso profissional, SEM G01 e SEM copiar referências

- Entrada e guarda de medidas originais pediátricas: peso, comprimento/estatura e data da avaliação; ausências mantidas como ausências.
- Contexto factual confirmado por avaliação: nascimento, idade gestacional ao nascer, fonte, técnica, sexo da referência escolhido, edema, situação ao nascimento/pós-natal; apenas armazenamento, não inferência diagnóstica.
- Idades e relações aritméticas (idade cronológica em dias, idade pós-menstrual em dias e diferença aritmética de idade corrigida), exibidas como informativas, SEM usá-las para atribuir categoria clínica.
- Snapshot cifrado, controle de acesso por clínica e carteira, prevenção de duplicidade, autorização de leitura, histórico paginado, tabela e gráficos das medidas ORIGINAIS; sem curvas oficiais, faixas de normalidade, diagnósticos, escores Z ou percentis.
- No módulo adulto existente: medidas factuais e fórmulas anteriormente autorizadas para 20+; proteção abaixo de 18. A regra aprovada para fórmulas/interpretacões 18–19 pode ser implementada/testada separadamente, sem depender de G01 pediátrico, respeitando domínio e proteções gestacionais.

**A liberação real de A ainda exige:** revisão independente de segurança R4, CI validado no commit que será implantado, provas de migrations 1068/1069 e RLS/roles/rollback nos ambientes-alvo, teste integrado e autorização expressa de ativação/deploy pelo proprietário. Não classificar esses requisitos como jurídicos das curvas. Não executar migrations em staging/produção nem deploy sem autorização.

### B. Pode seguir sendo desenvolvido/testado, mas NÃO habilitado a profissionais

- LMS, interpolação, normalização clínica por técnica, quatro indicadores OMS, flags e classificação SISVAN, curvaturas pediátricas, transição corrigida, aplicação automática do INTERGROWTH, oráculos e coeficientes candidatos.
- Permanecer sem consumidores assistenciais e sem biblioteca/dataset de direitos não esclarecidos no build de produção; testes exclusivamente sintéticos e dossiê de validação versionado.
- Remover textos de UI que possam sugerir que o G02 permanece sem ratificação; descrever corretamente “referências e classificações ainda não habilitadas” e manter o bloqueio por G01/G00.

### C. Pendências que NÃO impedem iniciar fases posteriores

- Direitos específicos OMS, INTERGROWTH e reprodução editorial SISVAN; divergência do INTERGROWTH em 55 semanas, origem e precisão primária dos coeficientes.
- Essas pendências devem continuar em backlog separado e bloqueiam SOMENTE a ativação assistencial de referências dependentes delas.
- Próximas fases podem começar se não consumirem curvas/percentis/classificações nem novas interfaces/campos clínicos que dependam da validação. Fixar contrato e testes de regressão das entregas factuais; não declarar a Fase 314 clinicamente concluída.

## 3. Critérios objetivos para uma entrega parcial controlada

1. Confirmar o que está de fato em `main` e o que só existe localmente na worktree do Codex; registrar commit, PR e artefatos.
2. Criar um escopo/PR específico de liberação factual, sem alterar os bloqueios de classificação e sem usar referências pendentes; preferir mudanças pequenas.
3. Reconciliar CL08 (18–19): aplicar autorização ratificada aos seis métodos individualmente, testes RED/GREEN por 17/18/19/20 anos, sexo, idade ausente, população e gestação; preservar IMC/idade de 18–19 sem classificação adulta e sem usar curvas não licenciadas.
4. Atualizar mensagens de interface: G02 ratificado, G01 ainda bloqueado. Sem expor dados contextuais pediátricos ao portal do paciente.
5. Revisão independente R4 de fronteiras tenant/carteira, RLS, criptografia, replay, paginação, soft delete e isolamento do portal; registrar revisor e evidências sem dados sensíveis no Git público.
6. CI e regressões no HEAD final; migr 1068/1069: conferir status, grants/roles e testes de retenção em cada ambiente, separadamente e com autorização; planejar rollback sem apagar dados.
7. Requerer aprovação explícita do proprietário antes de merge, migrations externas, deploy ou liberação de usuários.
8. Encerrar como `FASE_314_ENTREGA_FACTUAL_APTA_APOS_GATES_OPERACIONAIS`, mantendo `G01_REFERENCIAS_BLOQUEADO` e `FASE_314_CLASSIFICADORES_PENDENTES`. Não chamar a fase clínica completa de PASS.

## 4. Regra para fases seguintes

Não impedir desenvolvimento das fases 315+ apenas por G01, se suas funcionalidades forem independentes do classificador. Para dependências das curvas, disponibilizar contrato de dados, interfaces neutras e placeholders explicitamente desativados; jamais preencher Z/percentil/classificação com aproximações não validadas.

## 5. Mensagem curta sugerida ao Codex

> Quero liberar uma entrega parcial factual da Fase 314 para permitir a continuidade das próximas fases sem esperar os direitos OMS/INTERGROWTH/SISVAN. Leia este arquivo, reconcilie-o com `main` e com a REV11 local. Separe explicitamente (a) medidas/contexto, histórico, gráficos descritivos e segurança — candidatos a liberar após R4/CI/migrations/aceite operacional; (b) os classificadores/curvas, que permanecerão bloqueados; (c) pendências G01 que não travam fases independentes. Confira especialmente a divergência de CL08: `main` ainda marca seis métodos 18–19 como pendentes, apesar da minha ratificação; implemente/teste a autorização de 18 anos, preservando IMC/idade separado. Corrija a mensagem da interface para não dizer que o protocolo G02 não foi ratificado. Gere um checklist PASS/BLOCKED específico de liberação parcial e continue fases futuras independentes. Não faça merge, deploy, migrations externas ou ativação assistencial sem minha autorização.

