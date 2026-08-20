# OctaClin - Roadmap de qualidade e seguranca das Fases 248 a 262

Atualizado em 2026-08-20.

## Objetivo

Este roteiro transforma a melhoria contínua em uma sequência verificável. Ele
não declara o produto pronto por quantidade de fases: cada etapa precisa reduzir
um risco observável, ter critérios de aceite e atualizar o checklist vivo.

O app Expo não é prioridade de produto, mas sua dívida de segurança não pode
ficar indefinidamente no repositório público. Por isso a Fase 243 entra como
interrupção de segurança antes da sequência 248-262, sem ativar nem distribuir o
Mobile.

## Ordem recomendada

1. **Interrupção: Fase 243** - atualizar o ecossistema Expo de forma coordenada,
   manter `mobile.sync=false` e substituir os cinco PRs automáticos isolados.
2. **Fases 248-252** - corrigir estados, consistência visual, dívida de PRs,
   linguagem e descoberta de funcionalidades.
3. **Fases 253-259** - fechar as jornadas essenciais de agenda, paciente,
   prontuário, formulários, portal, comunicação e acesso.
4. **Fases 260-262** - medir estabilidade, repetir a revisão de segurança e
   decidir GO/NO-GO do piloto com evidência.

## Classificação das 15 fases

| Fase | Entrega | Prioridade | Bloqueio |
| --- | --- | --- | --- |
| 248 | Estados e recuperação clínica | Essencial | Bloqueia piloto |
| 249 | Densidade e responsividade web | Importante | Não bloqueia isoladamente |
| 250 | Fechamento da dívida Mobile e PRs | Essencial/segurança | Bloqueia Mobile; prazo pré-piloto |
| 251 | Linguagem e microcopy integral | Importante | Pré-piloto |
| 252 | Navegação e descoberta por papel | Essencial | Pré-piloto |
| 253 | Agenda clínica confiável | Essencial | Bloqueia piloto |
| 254 | Lista e cadastro de pacientes | Essencial | Pré-piloto |
| 255 | Prontuário e linha de cuidado | Essencial | Bloqueia piloto |
| 256 | Formulários/check-ins ponta a ponta | Essencial | Pré-piloto |
| 257 | Portal do paciente por tarefas | Essencial | Pré-piloto |
| 258 | Comunicações confiáveis | Essencial | Pré-piloto |
| 259 | Acesso, convite e ativação | Essencial | Pré-piloto |
| 260 | Desempenho, resiliência e diagnóstico | Essencial | Estabilidade pré-piloto |
| 261 | Regressão de segurança e privacidade | Essencial/segurança | Bloqueia piloto |
| 262 | Aceite e prontidão para piloto | Essencial | Bloqueador final |

## Critérios transversais

- Nenhuma fase pode remover ou afrouxar RLS, tenant, permissões ou auditoria
  para simplificar uma tela.
- Dados de testes, screenshots e documentação devem ser sintéticos.
- Estados de carregamento, vazio, erro, sucesso, permissão negada e recuperação
  são parte do aceite, não acabamento posterior.
- Desktop profissional é a prioridade de uso. Web móvel deve permanecer íntegra
  e acessível; o app Expo continua desativado até a Fase 243 ser aceita.
- Correção visual exige screenshots comparáveis, teclado, foco, contraste e
  ausência de sobreposição. Correção funcional exige teste no nível adequado.
- Cada fase atualiza seu `fase-XXX-*.md`, este roteiro quando houver mudança de
  ordem e `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` ao ser concluída.

## Auditoria dos PRs abertos em 2026-08-20

### Resultado

| PR | Situação observada | Necessidade | Decisão recomendada |
| --- | --- | --- | --- |
| `#22` | React Native e screens isolados; branch atrás; job Mobile falha | Não serve isoladamente | Substituir pela Fase 243 e encerrar depois |
| `#24` | Safe Area Context major isolada; branch atrás | Depende da matriz Expo alvo | Substituir pela Fase 243 e encerrar depois |
| `#25` | Expo 52 para 57 sozinho; grande troca de lockfile; branch atrás | É a direção, não um PR integrável sozinho | Refazer coordenado na Fase 243 |
| `#29` | Expo AV major isolada; branch atrás | Depende do SDK alvo | Substituir pela Fase 243 e encerrar depois |
| `#30` | Expo Status Bar major isolada; branch atrás | Depende do SDK alvo | Substituir pela Fase 243 e encerrar depois |
| `#6` | Fase 150A de julho, 10 commits, conflitos com `main` | Conteúdo atual já possui escopo Mobile/IA mais amplo e testes posteriores | Encerrar como superado; não tentar merge/cherry-pick |

Nenhum PR aberto está pronto para merge. Não fechar automaticamente nesta
auditoria: primeiro criar o PR substituto da Fase 243; depois registrar nos PRs
automáticos o substituto. O PR `#6` pode ser encerrado independentemente porque
está conflitante e a implementação atual já valida tenant, paciente,
profissional responsável, mídia, hash, idempotência e locks em serviços mais
novos.

## Triagem dos alertas Dependabot

Fonte: API REST do GitHub, estado `open`, consultada em 2026-08-20. A análise
foi estática: nenhuma aplicação, teste de exploração ou código do produto foi
executado.

- Total: **37** alertas em `octaclin-mobile/pnpm-lock.yaml`.
- Severidade: **1 crítico**, **26 altos** e **10 médios**.
- Escopo informado pelo GitHub: `runtime` para os 37.
- Backend, web e serviço de IA: nenhum alerta Dependabot aberto nessa coleta.

| Pacote | Alertas | Severidade | Avaliação |
| --- | --- | --- | --- |
| `tar` | 1-6, 14-18 e 22 | 1 crítico, altos e médios | Presença confirmada via Expo CLI; prioridade máxima da atualização |
| `@xmldom/xmldom` | 7-11 | Altos | Presença confirmada via configuração/prebuild Expo |
| `postcss` | 12, 20, 21 e 27 | Altos e médios | Presença confirmada na cadeia Metro/Expo |
| `uuid` | 13 | Médio | Presença confirmada em dependências transitivas |
| `fast-uri` | 19 e 28 | Altos | Presença confirmada via AJV |
| `brace-expansion` | 23-26 | Altos | Presença confirmada via minimatch |
| `undici` | 29-31 | Médios | Presença confirmada via Expo CLI |
| `js-yaml` | 32-33 | Altos | Presença confirmada em ferramentas transitivas |
| `nanoid` | 34 e 37 | Altos | Presença confirmada em navegação/PostCSS |
| `image-size` | 35-36 | Altos, sem patch direto indicado | Presença confirmada via Metro; resolver pela atualização do ecossistema |

Veredito: a dívida de dependências é **confirmada**. A explorabilidade contra o
SaaS web implantado fica como **não demonstrada/necessita revisão**, porque o
lockfile afetado pertence ao app nativo não distribuído e vários caminhos são
de build. O repositório público aumenta a visibilidade do atraso, mas não cria
sozinho um caminho de ataque ao backend ou à web. O risco permanece relevante
para builds, estações de desenvolvimento e uma futura distribuição Mobile.

## Política de dependências após a Fase 250

- Crítico: triagem em 1 dia útil e correção ou contenção com prazo explícito.
- Alto: plano em até 7 dias; sem acúmulo silencioso.
- Médio: tratar no ciclo mensal ou antes se houver caminho exposto.
- Atualizações acopladas por framework entram em um PR coordenado, nunca como
  merges automáticos independentes.
- PR automático atrás da `main` ou superado deve receber destino explícito;
  não pode permanecer aberto como backlog sem dono.
- Antes de liberar Mobile: zero alerta crítico/alto sem exceção formal, build
  suportado, Expo Doctor, typecheck, testes offline e revisão de permissões.
