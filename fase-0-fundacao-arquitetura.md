# OctaClin - Fase 0: Fundacao de Arquitetura

## Modulo: Plataforma Operacional Multitenant

### Justificativa Tecnica

- **NestJS + TypeScript**: escolhido para o backend principal por modularidade, injecao de dependencias nativa, suporte maduro a testes com Jest e boa adequacao a DDD em modulos. Alternativas como Express puro reduziriam boilerplate, mas aumentariam acoplamento e custo de manutencao.
- **FastAPI para IA**: isolado do backend principal para separar workloads pesados de texto, audio e imagem. Python tem ecossistema melhor para ML, visao computacional e processamento assíncrono de midia.
- **PostgreSQL 15 + RLS**: escolhido para multitenancy estrito com `tenant_id` obrigatorio e politicas no banco. Schema-per-tenant isola bem, mas aumenta complexidade de migrations, pooling e analytics cross-tenant.
- **pgvector + TimescaleDB**: pgvector cobre buscas semanticas e embeddings; TimescaleDB cobre series temporais de metricas clinicas e adesao.
- **Redis + BullMQ**: separa API sincrona de envios WhatsApp/e-mail, analise de sentimento, reconhecimento alimentar e regras IFTTT.
- **MinIO local / S3 em producao**: mantem paridade operacional para uploads por URL pre-assinada sem depender da AWS em desenvolvimento.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| RLS por `tenant_id` | Baixo | Alto com indices compostos | Alta, uma migration atende todos os tenants |
| Schema-per-tenant | Alto | Medio em escala de tenants | Baixa, migrations e conexoes ficam mais complexas |
| Backend modular monolito no MVP | Baixo | Alto para dominio transacional | Alta, fronteiras DDD claras antes de extrair servicos |
| FastAPI separado para IA | Medio | Alto para jobs pesados | Media, exige observabilidade entre servicos |
| BullMQ para jobs | Baixo | Alto para fan-out | Alta, modelo operacional simples |

### C4 - Diagrama de Contexto

```mermaid
C4Context
    title OctaClin - Contexto do Sistema
    Person(profissional, "Nutricionista / Profissional", "Prioriza pacientes, cria protocolos, analisa alertas e aciona comunicacoes.")
    Person(paciente, "Paciente", "Responde check-ins, registra diario rapido e participa de comunidades.")
    Person(acompanhante, "Acompanhante", "Ajuda o paciente com lembretes e preenchimentos mediante PIN.")
    Person(superadmin, "SuperAdmin", "Opera tenants, planos, auditoria e suporte.")

    System(octaclin, "OctaClin", "Cerebro operacional para acompanhamento nutricional, adesao, IA e comunidades.")

    System_Ext(meta, "Meta Cloud API", "WhatsApp templates, botoes e mensagens transacionais.")
    System_Ext(sendgrid, "SendGrid / SES", "E-mails transacionais e fallback.")
    System_Ext(openai, "OpenAI API", "Sentimento contextual, transcricao e coach virtual.")
    System_Ext(vision, "Google Vision / Clarifai", "Reconhecimento alimentar.")
    System_Ext(push, "Expo Push / FCM / APNs", "Push notification mobile.")
    System_Ext(storage, "Amazon S3 / DigitalOcean Spaces", "Midias, audios, videos e fotos de refeicao.")

    Rel(profissional, octaclin, "Usa dashboard web")
    Rel(superadmin, octaclin, "Administra plataforma")
    Rel(paciente, octaclin, "Usa app mobile")
    Rel(acompanhante, octaclin, "Acessa modo acompanhante")
    Rel(octaclin, meta, "Envia WhatsApp")
    Rel(octaclin, sendgrid, "Envia e-mail")
    Rel(octaclin, openai, "Analisa texto/audio e responde duvidas")
    Rel(octaclin, vision, "Classifica imagens")
    Rel(octaclin, push, "Envia push")
    Rel(octaclin, storage, "Armazena midias")
```

### DER Completo - Mermaid

```mermaid
erDiagram
    tenants ||--o{ tenant_configuracoes : possui
    tenants ||--o{ usuarios : isola
    tenants ||--o{ profissionais : possui
    tenants ||--o{ pacientes : possui
    tenants ||--o{ categorias_pergunta : define
    tenants ||--o{ questionarios : possui
    tenants ||--o{ agendamentos_questionario : possui
    tenants ||--o{ canais_notificacao : possui
    tenants ||--o{ templates_mensagem : possui
    tenants ||--o{ regras_automacao : possui
    tenants ||--o{ circulos_pacientes : possui
    tenants ||--o{ desafios : possui
    tenants ||--o{ badges : possui
    tenants ||--o{ protocolos : possui
    tenants ||--o{ user_action_logs : audita

    usuarios ||--o{ refresh_tokens : autentica
    usuarios ||--o{ consentimentos_lgpd : aceita
    usuarios ||--o{ user_action_logs : gera
    usuarios ||--o| profissionais : perfil
    usuarios ||--o| colaboradores : perfil
    usuarios ||--o| pacientes : perfil
    usuarios ||--o{ anotacoes_voz : cria

    profissionais ||--o{ pacientes : acompanha
    profissionais ||--o{ questionarios : cria
    profissionais ||--o{ protocolos : cria
    profissionais ||--o{ regras_automacao : cria
    profissionais ||--o{ circulos_pacientes : modera
    profissionais ||--o{ desafios : lanca

    pacientes ||--o{ acompanhantes : permite
    pacientes ||--o{ envios_questionario : recebe
    pacientes ||--o{ respostas_checkin : responde
    pacientes ||--o{ arquivos_midia : envia
    pacientes ||--o{ metricas_temporais : registra
    pacientes ||--o{ eventos_timeline : possui
    pacientes ||--o{ ai_sentiment_analysis : analisado
    pacientes ||--o{ food_recognition_cache : possui
    pacientes ||--o{ membros_circulo : participa
    pacientes ||--o{ participacoes_desafio : participa
    pacientes ||--o{ paciente_badges : conquista
    pacientes ||--o{ logs_diario_rapido : registra

    categorias_pergunta ||--o{ perguntas : agrupa
    questionarios ||--o{ perguntas : contem
    questionarios ||--o{ agendamentos_questionario : agenda
    questionarios ||--o{ envios_questionario : gera
    questionarios ||--o{ protocolo_itens : compoe
    perguntas ||--o{ opcoes_pergunta : possui
    perguntas ||--o{ resposta_valores : respondida_em
    envios_questionario ||--o{ respostas_checkin : coleta
    respostas_checkin ||--o{ resposta_valores : contem
    respostas_checkin ||--o{ ai_sentiment_analysis : analisa
    respostas_checkin ||--o{ eventos_timeline : publica

    arquivos_midia ||--o{ food_recognition_cache : analisado_por
    arquivos_midia ||--o{ transcricoes_midia : transcrito_em
    arquivos_midia ||--o{ eventos_timeline : aparece_em
    transcricoes_midia ||--o{ ai_sentiment_analysis : analisa

    canais_notificacao ||--o{ mensagens_notificacao : envia
    templates_mensagem ||--o{ mensagens_notificacao : instancia
    pacientes ||--o{ mensagens_notificacao : recebe
    regras_automacao ||--o{ execucoes_regra : executa
    execucoes_regra ||--o{ mensagens_notificacao : dispara

    circulos_pacientes ||--o{ membros_circulo : contem
    circulos_pacientes ||--o{ posts_comunidade : recebe
    posts_comunidade ||--o{ moderacoes_post : avalia
    desafios ||--o{ participacoes_desafio : mede
    badges ||--o{ paciente_badges : concede
    protocolos ||--o{ protocolo_itens : possui

    tenants {
        uuid id PK
        varchar nome
        varchar slug UK
        varchar status
        timestamptz criado_em
        timestamptz atualizado_em
    }
    usuarios {
        uuid id PK
        uuid tenant_id FK
        varchar email_hash UK
        bytea email_criptografado
        varchar senha_hash
        varchar role
        boolean ativo
        timestamptz ultimo_login_em
    }
    pacientes {
        uuid id PK
        uuid tenant_id FK
        uuid usuario_id FK
        uuid profissional_responsavel_id FK
        bytea nome_criptografado
        bytea contato_criptografado
        date data_nascimento
        varchar status_adesao
        numeric score_risco
    }
    questionarios {
        uuid id PK
        uuid tenant_id FK
        uuid profissional_id FK
        varchar titulo
        varchar status
        integer versao
    }
    perguntas {
        uuid id PK
        uuid tenant_id FK
        uuid questionario_id FK
        uuid categoria_id FK
        varchar tipo
        varchar enunciado
        numeric peso
        jsonb configuracao
        integer ordem
    }
    ai_sentiment_analysis {
        uuid id PK
        uuid tenant_id FK
        uuid paciente_id FK
        uuid resposta_checkin_id FK
        uuid transcricao_midia_id FK
        numeric ansiedade_score
        numeric frustracao_score
        numeric motivacao_score
        numeric confusao_score
        vector embedding
        jsonb explicacao
    }
    food_recognition_cache {
        uuid id PK
        uuid tenant_id FK
        uuid paciente_id FK
        uuid arquivo_midia_id FK
        varchar provedor
        varchar imagem_hash
        jsonb alimentos_detectados
        numeric calorias_estimadas
        numeric confianca_media
    }
    user_action_logs {
        uuid id PK
        uuid tenant_id FK
        uuid usuario_id FK
        varchar acao
        varchar recurso_tipo
        uuid recurso_id
        inet ip
        jsonb metadados
        timestamptz criado_em
    }
```

### Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|---|---:|---|
| Politica RLS mal configurada vazar dados entre tenants | Critico | `tenant_id` `NOT NULL`, indices compostos, testes de isolamento e `SET LOCAL app.tenant_id` por transacao |
| Jobs de IA consumirem recursos da API principal | Alto | Separacao FastAPI + BullMQ, filas por prioridade e timeout por provedor |
| Custo de APIs de IA/visao crescer rapido | Alto | Cache por hash de imagem/texto, limites por plano e fallback heuristico |
| WhatsApp templates reprovados ou indisponiveis | Medio | Fallback e-mail/push, monitor de entrega e reprocessamento idempotente |
| Importacao CSV/XLSX com colunas erradas | Medio | Pre-validacao, dry-run, mapeamento assistido e rollback por lote |
| Dados sensiveis fora do modelo LGPD | Alto | Criptografia AES-256, consentimentos versionados, auditoria e anonimizacao |
| Ranking gamificado gerar comparacao negativa | Medio | Rankings opt-in, metricas relativas e moderacao de conteudo sensivel |

### Criterios de Aceite da Fase 0

- DER cobre tenants, RBAC, pacientes, questionarios, IA, midias, comunidades, gamificacao, notificacoes, logs e LGPD.
- Infra local sobe com PostgreSQL, Redis e MinIO.
- Backend NestJS inicial possui DI, TypeORM, migrations e fronteiras DDD para tenancy, usuarios, profissionais e pacientes.
- Multitenancy adotado por RLS com `tenant_id` obrigatorio e politicas no PostgreSQL.
