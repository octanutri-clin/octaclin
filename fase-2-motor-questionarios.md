# OctaClin - Fase 2: Motor de Questionarios

## Escopo Entregue

- Modulo NestJS `questionarios` com DDD aplicado.
- CRUD inicial de categorias de pergunta.
- CRUD inicial de questionarios.
- Criacao e listagem de perguntas com os 7 tipos obrigatorios.
- Opcoes para perguntas de multipla escolha.
- Reordenacao transacional de perguntas.
- Agendamento por `regraCron` ou `dataFixa`.
- Processador cron a cada minuto para gerar `envios_questionario`.
- Editor web em Next.js 14 com dnd-kit para drag-and-drop.
- Testes unitarios para contrato de tipos e reordenacao.

## Modulo Backend: Questionarios

### Justificativa Tecnica

O modulo foi criado no backend NestJS porque o motor de questionarios e regra central do dominio, nao apenas UI. A entidade `perguntas` usa `tipo`, `peso`, `categoria_id`, `configuracao` e `ordem`, permitindo evoluir campos especificos sem migrations para cada variacao de pergunta. `jsonb` foi usado para configuracoes flexiveis como limites de slider, unidade de metrica ou restricoes de upload.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| `jsonb` para configuracao de pergunta | Baixo | Alto para leitura simples | Alta flexibilidade, exige validadores por tipo |
| Tabelas relacionais para questionario/pergunta/opcao | Medio | Alto com indices por tenant | Contrato claro e auditavel |
| Reordenacao por lista normalizada | Baixo | Alto para questionarios pequenos/medios | Simples e previsivel |
| Versao incremental do questionario | Baixo | Alto | Base para historico e publicacao imutavel |

### Riscos

- **Configuracao `jsonb` invalida por tipo**: mitigacao atual valida tipo e peso; proximo passo e criar validadores especificos por `tipo`.
- **Edicao de questionario publicado alterar historico**: mitigacao parcial por `versao`; antes de producao, publicar deve gerar snapshot imutavel.
- **Questionarios muito longos**: reordenacao salva todos os itens do questionario; aceitavel no MVP, mas deve virar update em lote se passar de centenas de perguntas.

## Modulo Backend: Agendamento

### Justificativa Tecnica

Foi usado `@nestjs/schedule` com varredura a cada minuto para a Fase 2 porque o objetivo imediato e provar a regra de agendamento. A tabela guarda `ultima_execucao_em` e `proxima_execucao_em`, calculada com `cron-parser`, evitando recalcular todas as regras a cada consulta.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Varredura cron no NestJS | Baixo | Boa em instancia unica | Simples para MVP |
| BullMQ desde a Fase 2 | Medio | Melhor em escala | Mais infraestrutura antes da camada de comunicacao |
| `proxima_execucao_em` persistida | Baixo | Alto | Facil auditoria e reprocessamento |
| Envio gerado como `pendente` | Baixo | Alto | Integra naturalmente com filas da Fase 3 |

### Riscos

- **Multiplas replicas gerarem envios duplicados**: mitigacao futura com lock distribuido ou BullMQ repeatable jobs.
- **Todos os pacientes receberem o mesmo questionario**: MVP usa tenant inteiro; proximo passo e segmentacao por filtros ou lista de pacientes.
- **Timezone inconsistente**: `cron-parser` recebe timezone; validar calendario real com testes integrados.

## Modulo Web: Editor de Questionarios

### Justificativa Tecnica

Next.js 14 App Router foi usado por alinhar com a restricao tecnica. O editor e Client Component porque drag-and-drop, estado local e edicao de propriedades sao interacoes ricas. `dnd-kit` foi escolhido por acessibilidade, composicao e suporte a sortable sem acoplar a um design system especifico.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Client Component para editor | Medio | Alto no browser | Necessario para DnD e edicao fluida |
| Server Components fora do editor | Baixo | Alto | Ideal para paginas estaticas futuras |
| Componentes shadcn-compatible locais | Baixo | Alto | Evita dependencia de CLI na geracao inicial |
| Estado local mockado | Baixo | Alto | Rapido para UX; precisa conectar API na proxima iteracao |

### Riscos

- **Editor ainda nao persiste via API**: mitigacao: conectar aos endpoints criados antes da Fase 3.
- **Sem teste visual automatizado**: mitigacao: quando dependencias estiverem instaladas, rodar Playwright/Lighthouse.
- **Acessibilidade do DnD precisa QA real**: dnd-kit ajuda, mas keyboard flow deve ser testado em navegador.

## Endpoints Adicionados

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| POST | `/categorias-pergunta` | SuperAdmin, Professional, Collaborator | Cria categoria |
| GET | `/categorias-pergunta` | SuperAdmin, Professional, Collaborator | Lista categorias |
| POST | `/questionarios` | SuperAdmin, Professional, Collaborator | Cria questionario |
| GET | `/questionarios` | SuperAdmin, Professional, Collaborator | Lista questionarios |
| PATCH | `/questionarios/:id` | SuperAdmin, Professional, Collaborator | Atualiza questionario |
| POST | `/questionarios/:id/perguntas` | SuperAdmin, Professional, Collaborator | Adiciona pergunta |
| GET | `/questionarios/:id/perguntas` | SuperAdmin, Professional, Collaborator | Lista perguntas |
| PATCH | `/questionarios/:id/perguntas/ordem` | SuperAdmin, Professional, Collaborator | Reordena perguntas |
| POST | `/agendamentos-questionario` | SuperAdmin, Professional, Collaborator | Cria agendamento |

## Quality Gate da Fase 2

- Sete tipos de perguntas modelados e validados.
- Perguntas pertencem a categorias com cor e icone SVG.
- Peso de pergunta participa do contrato do questionario.
- Reordenacao por drag-and-drop implementada no web.
- Agendamento por cron/data fixa implementado no backend.
- Testes unitarios adicionados para regras puras.

## Proximo Gate Antes da Fase 3

Validacao executada nesta entrega:

```bash
cd outputs/octaclin-backend
jest
tsc --noEmit
nest build

cd ../octaclin-web
tsc --noEmit
next build
```

Resultado:

- Backend: 5 suites Jest aprovadas, 10 testes aprovados.
- Backend: TypeScript sem erros e build NestJS concluido.
- Web: TypeScript sem erros e build Next.js concluido.

Observacao operacional: o `pnpm install` concluiu a instalacao dos pacotes, mas retornou `ERR_PNPM_IGNORED_BUILDS` por politica de build scripts ignorados (`@nestjs/core` no backend e `unrs-resolver` no web). A validacao foi feita chamando os binarios locais diretamente com Node no PATH.

Antes da Fase 3:

```bash
pnpm approve-builds
```

Antes de integrar WhatsApp/SendGrid na Fase 3, conectar o editor web aos endpoints reais e trocar geracao direta de envio por job BullMQ idempotente.
