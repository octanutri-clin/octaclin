# OctaClin - Fase 4: IA e Gamificacao

## Escopo Entregue

- Microservico FastAPI `octaclin-ai-service`.
- Endpoint de analise de sentimento contextual.
- Endpoint de reconhecimento alimentar por imagem.
- Modulo NestJS `ia` para persistir `ai_sentiment_analysis` e `food_recognition_cache`.
- Modulo NestJS `automacoes` com regras IFTTT e BullMQ.
- Modulo NestJS `gamificacao` com circulos, posts moderados, desafios, rankings e badges.
- Testes unitarios para moderacao e avaliador de regras.

## Modulo IA

### Justificativa Tecnica

O processamento de IA foi isolado em FastAPI porque workloads de texto, imagem e audio tendem a usar bibliotecas Python e podem escalar separadamente da API transacional. O backend NestJS permanece como orquestrador, dono do contexto de tenant, seguranca e persistencia.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| FastAPI separado | Medio | Alto para IA | Melhor isolamento operacional |
| Heuristica local por padrao | Baixo | Alto | Permite desenvolvimento sem custo externo |
| Contrato HTTP estavel | Baixo | Alto | Provedor real pode trocar sem mudar NestJS |
| Cache por hash de imagem | Baixo | Alto | Reduz custo de visao computacional |

### Riscos

- **Scores heurísticos nao substituem modelo clinico**: mitigacao com provedores reais e calibracao com profissional.
- **Imagem sem escala real dificulta peso estimado**: mitigacao com heuristica declarada e campo de confianca.
- **Alertas falsos de frustracao**: mitigacao por explicacao e revisao humana no dashboard.

## Modulo Automacoes

### Justificativa Tecnica

As regras IFTTT foram modeladas como `gatilho`, `condicoes` e `acoes` em JSONB, processadas assincronamente via BullMQ. Isso permite que regras de adesao, renovacao e comunicacao evoluam sem alterar o schema a cada nova automacao.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| JSONB para regras | Baixo | Alto | Flexivel, exige validadores por tipo |
| BullMQ para avaliacao | Medio | Alto | Evita travar API principal |
| Execucao auditavel | Baixo | Alto | Facil reprocessar e explicar |

### Riscos

- **Acoes ainda sao planejadas, nao executadas automaticamente**: mitigacao na proxima iteracao conectando com `comunicacoes`.
- **Regras mal configuradas**: mitigacao futura com editor visual e validacao por schema.

## Modulo Gamificacao

### Justificativa Tecnica

Comunidades, desafios e badges foram separados em `gamificacao` porque representam um subdominio de engajamento, com regras proprias de moderacao, ranking e conquistas. Posts passam por moderacao automatica simples antes de aparecerem como publicados.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Moderacao heuristica local | Baixo | Alto | Rapida, mas limitada semanticamente |
| Ranking por pontos persistidos | Baixo | Alto | Simples e auditavel |
| Badges por concessao explicita | Baixo | Alto | Evita conceder conquista errada |

### Riscos

- **Moderacao pode perder contexto**: mitigacao futura com IA e fila de revisao.
- **Ranking pode gerar comparacao negativa**: manter opt-in e progresso relativo no app.
- **Badges duplicados dependem de constraint do banco**: ja existe `unique (tenant_id, paciente_id, badge_id)`.

## Endpoints Adicionados

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/ia/sentimento` | Analisa resposta aberta e persiste radar emocional |
| POST | `/ia/reconhecimento-alimentar` | Reconhece alimentos e cacheia resultado |
| POST | `/automacoes/regras` | Cria regra IFTTT |
| GET | `/automacoes/regras` | Lista regras |
| POST | `/automacoes/avaliacoes` | Enfileira avaliacao de regra |
| POST | `/gamificacao/circulos` | Cria circulo de pacientes |
| POST | `/gamificacao/circulos/:id/membros` | Adiciona paciente ao circulo |
| POST | `/gamificacao/posts` | Cria post com moderacao |
| POST | `/gamificacao/desafios` | Cria desafio sazonal |
| POST | `/gamificacao/desafios/progresso` | Atualiza pontos de paciente |
| GET | `/gamificacao/desafios/:id/ranking` | Ranking do desafio |
| POST | `/gamificacao/badges` | Cria badge |
| POST | `/gamificacao/badges/concessoes` | Concede badge ao paciente |

## Validacao

Validacao executada nesta entrega:

```bash
cd outputs/octaclin-backend
jest
tsc --noEmit
nest build

cd ../octaclin-ai-service
python -m py_compile app/main.py
```

Resultado:

- Backend: 8 suites Jest aprovadas, 18 testes aprovados.
- Backend: TypeScript sem erros.
- Backend: build NestJS concluido.
- FastAPI: `py_compile` concluido.
- Imports relativos do backend: 94 arquivos verificados.
- Nenhuma referencia propria ao nome anterior encontrada nos artefatos.

## Proximo Gate Antes da Fase 5

- Conectar acoes de automacao ao modulo `comunicacoes`.
- Substituir heuristicas por OpenAI/Gemini/Google Vision em ambiente sandbox.
- Adicionar revisao humana de moderacao.
- Expor widgets mobile para diario rapido e upload multimodal.
