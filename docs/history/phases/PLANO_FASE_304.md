# Plano da Fase 304 - adesao longitudinal factual e substituicoes

## 1. Objetivo e risco

Entregar ao profissional uma leitura longitudinal factual do acompanhamento do
plano alimentar, contextualizada pela versao que estava publicada, e tornar
consultavel na interface o conteudo das versoes historicas que a API interna ja
autoriza.

Esta e uma mudanca R4: atravessa autorizacao por papel e carteira, tenancy,
RLS e dados clinicos sensiveis. O menor escopo nao cria score, diagnostico,
alerta, automacao, escrita clinica ou contrato publico `/v1`.

## 2. Fontes e decisoes vigentes

- `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md`: check-ins
  declarados, respostas ausentes e escolhas de troca junto da versao publicada;
  versao historica consultavel na UI; sem inferir consumo real.
- `docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`: os dados ja existem e a
  lacuna e torna-los legiveis em conjunto, sem recriar subsistema.
- `docs/history/phases/fase-234-editor-planos-alimentares-avancado-multifonte.md`:
  escolhas sao eventos append-only e nunca alteram a versao publicada.
- `docs/history/phases/PLANO_FASE_274.md`: a preparacao de consulta ja entrega
  contagens recentes; a Fase 304 nao deve duplicar esse resumo nem a timeline
  geral do prontuario.
- ADRs e contrato atual: somente `Professional` ou `SuperAdmin` com
  `planos_alimentares.ler`; profissional continua limitado a pacientes sob sua
  responsabilidade atual; tenant vem da credencial e de `ExecutorTenant`.

## 3. Revisao de gaps no codigo atual

### Ja existe e deve ser reutilizado

- `GET /pacientes/:pacienteId/planos-alimentares/:planoId/versoes/:numero`
  retorna o conteudo completo de uma versao depois de revalidar papel,
  permissao, tenant e carteira.
- A Web ja lista resumos das versoes historicas, mas exibe apenas numero, data e
  hash; nao chama a rota de detalhe.
- A trilha paginada de escolhas do paciente ja informa `versaoId` e
  `versaoNumero`, com refeicao, alimento, alternativa ou retorno ao principal.
- Check-ins rapidos cifrados guardam `adesaoPlano` e data declarada.
- Envios de questionario guardam estado, envio, resposta e expiracao.

### Lacunas confirmadas

1. Nao ha projecao que associe fatos de acompanhamento ao intervalo em que uma
   versao estava publicada.
2. A UI nao permite abrir uma versao historica, apesar de a API/BFF ja
   existirem.
3. As trocas aparecem numa lista unica; o profissional precisa interpretar
   manualmente a qual versao pertencem.
4. Adesao declarada e ausencia de resposta nao aparecem no contexto do plano.
5. Envios sem resposta finalizada sao o fato operacional aprovado para
   "respostas ausentes"; campos opcionais vazios em formularios concluidos nao
   pertencem a esta fase.

## 4. Contrato de produto proposto

### 4.1 Unidade de leitura

A unidade e uma **versao publicada do plano**. Para cada versao selecionada, a
interface mostra fatos ocorridos entre `publicadaEm` e a publicacao da versao
seguinte; para a versao publicada atual, o intervalo termina no momento da
consulta.

O texto da interface deve dizer "registrado enquanto esta versao estava
publicada". Proximidade temporal nao significa que o paciente consumiu o item,
seguiu o plano ou que a versao causou o resultado.

Versoes nunca publicadas (`rascunho` ou `descartada`) podem ter o conteudo
historico consultado, mas nao recebem indicadores de acompanhamento nem uma
janela de adesao ficticia.

### 4.2 Fatos exibidos

- check-ins com percentual de adesao explicitamente declarado, data e fonte;
- envios de questionario sem resposta finalizada, com estado e datas minimas;
- escolhas de substituicao vinculadas diretamente a `versaoId`, incluindo
  retorno ao alimento principal;
- estados vazios separados: nenhum registro, dado nao informado, versao nunca
  publicada e falta de permissao.

Nao calcular media, tendencia, queda, cumprimento, consumo, abandono ou score.
Nao promover estes fatos para a timeline geral do prontuario.

### 4.3 Decisao fechada sobre respostas ausentes

"Respostas ausentes" significa envio de questionario sem resposta finalizada,
nos estados `pendente`, `enviado` ou `expirado`. Perguntas opcionais sem valor
dentro de formulario finalizado ficam fora desta fase.

Como `envios_questionario` nao possui `criado_em`, apenas envios com
`enviado_em` podem ser associados com seguranca a janela publicada. Registros
sem essa data devem aparecer somente como contagem de dados sem referencia
temporal, nunca atribuidos a uma versao por `expira_em` ou outra aproximacao.

## 5. Desenho tecnico proposto

### Incremento 1 - projecao backend por versao publicada

- Adicionar leitura clinica sob o controlador de planos existente, sem rota
  publica `/v1` e sem migration.
- Entrada: paciente, plano e numero da versao; tenant e usuario apenas da
  sessao validada.
- Reutilizar `obterPlanoNoEscopo` antes de qualquer consulta sensivel.
- Consultar somente campos minimos e descriptografar check-ins depois da
  autorizacao.
- Determinar o fim da janela pela proxima `publicadaEm`, com limites inclusivo
  no inicio e exclusivo no fim para impedir dupla contagem.
- Retornar DTO explicito, nunca entidades ORM ou blobs cifrados.
- Limitar e paginar eventos para impedir resposta sem teto; ordenacao estavel
  por data e `id`.

### Incremento 2 - consulta de versao historica na Web

- Transformar o resumo de cada versao em acao acessivel de consulta.
- Usar o BFF e `obterVersaoPlanoAlimentar` existentes.
- Exibir o detalhe em modo somente leitura, separado do editor e com estados de
  carregamento, erro, vazio e retorno para a versao atual.
- Funcionar em desktop, mobile e teclado; nenhuma resposta autenticada entra em
  Cache Storage.

### Incremento 3 - painel longitudinal factual

- No contexto da versao selecionada, mostrar sua janela de publicacao e os
  fatos do Incremento 1.
- Reutilizar a apresentacao das trocas e agrupa-las pela versao selecionada.
- Explicitar dados faltantes e a natureza declarada dos check-ins.
- Nao duplicar os cards de preparacao de consulta nem a linha do tempo geral.

### Incremento 4 - documentacao, revisao e fechamento

- Atualizar roadmap, checklist, status, resumo e matriz de confiabilidade no
  mesmo PR da implementacao.
- Revisar o diff com foco em IDOR, tenant/carteira, PHI em logs/cache,
  paginacao e limites.
- Solicitar revisao cruzada R4 quando viavel.

## 6. TDD e criterios de aceite

### Backend - testes RED antes do codigo

- profissional autorizado le somente fatos do paciente de sua carteira;
- outro profissional, outro tenant e papel sem acesso recebem resposta opaca e
  nao consultam dados clinicos;
- eventos no inicio da janela entram, no instante da proxima publicacao nao;
- check-in sem percentual nao vira adesao zero nem evento inventado;
- escolha pertence a sua `versaoId`, inclusive retorno ao principal;
- versao rascunho/descartada nao recebe janela publicada;
- paginacao e desempate por `id` nao repetem nem omitem fatos;
- blobs cifrados, texto livre desnecessario e identidade do paciente nao saem
  no DTO.

### Web - testes RED antes do codigo

- abre e fecha uma versao historica usando a rota existente;
- falha de uma leitura historica nao derruba o editor;
- exibe rotulos factuais, dados ausentes e aviso de nao inferencia;
- alterna versoes sem misturar eventos de requisicoes concorrentes;
- desktop, mobile, teclado e acessibilidade preservados;
- BFF aceita apenas os parametros allowlisted e exige
  `planos_alimentares.ler`.

### Gates planejados

- Jest focado de servico e controlador backend;
- testes de contrato do BFF;
- Playwright focado desktop/mobile e acessibilidade;
- typecheck e build backend/web;
- `pnpm --dir octaclin-web test:authz`, lint e linguagem;
- regressao backend proporcional ao diff;
- `git diff --check` e `pnpm security:secrets`;
- CI completo, incluindo PostgreSQL/RLS real quando acionado.

## 7. Migration, rollout e rollback

Nenhuma migration nova e prevista: a Fase 304 le tabelas existentes. A
migration 1063 da Fase 303 permanece pendencia operacional separada e deve ser
aplicada antes de ativar o runtime que depende dela, mas nao sera executada por
esta fase.

Rollback e de codigo: remover a rota/projecao e a UI nova restaura o
comportamento anterior sem apagar escolhas, check-ins, respostas ou versoes de
plano. Nao usar `migration:revert`.

## 8. Fora de escopo

- media, tendencia, score ou classificacao de adesao;
- inferir consumo real a partir de troca, check-in ou silencio;
- alertas, automacoes ou contato com paciente;
- cruzamento com antropometria e questionarios respondidos (Fase 305);
- alteracao do portal do paciente, plano publicado ou contrato `/v1`;
- migration, backfill, deploy ou configuracao externa.

## 9. Entrega e evidencias locais em 2026-10-04

### Entregue

- projecao backend paginada por versao publicada, com janela
  `[publicadaEm, proximaPublicadaEm)`, autorizacao por papel, permissao,
  tenant e carteira antes das consultas clinicas;
- check-ins declarados, envios sem resposta finalizada e escolhas append-only
  em DTO minimo, sem identidade do paciente, blobs cifrados, score ou media;
- defesa contra referencias inconsistentes que tentem associar conteudo de
  item ou substituicao de outra versao;
- rota BFF allowlisted e respostas historicas com `private, no-store`;
- consulta somente leitura da versao atual, publicada historica ou descartada,
  com paginacao independente, estados ausentes, aviso de nao inferencia e
  descarte de respostas concorrentes atrasadas;
- documentacao canonica, rollback de codigo e proxima fase reconciliados.

### Gates

- `PASS` - Jest focado: 2 suites e 56 testes;
- `PASS` - regressao backend completa: 256 suites e 2.327 testes; 4 suites e
  43 testes de integracao ficaram ignorados pelo proprio ambiente;
- `PASS` - typecheck e build backend; typecheck e build Web;
- `PASS` - contrato de planos/BFF: 26 testes; `test:authz` completo;
- `PASS` - lint Web com zero erros e 63 avisos permitidos pelo baseline;
- `PASS` - linguagem da interface: 8 testes e scanner;
- `PASS` - Playwright desktop/mobile para leitura, teclado, paginacao,
  concorrencia e axe-core no painel factual;
- `PASS` - `pnpm security:secrets` e `git diff --check`;
- `SKIPPED` - PostgreSQL/RLS local: Docker nao esta instalado neste ambiente;
  o job real do CI e obrigatorio antes do merge;
- `SKIPPED` - compatibilidade local com Node 22: somente Node 24.19.0 esta
  disponivel; os comandos passaram com aviso de engine e o CI em Node 22 deve
  fornecer a prova autoritativa;
- `NA` - migration, deploy e contrato publico `/v1`: nao foram alterados nem
  executados.

A revisao R4 foi feita em passe separado, seguindo o checklist de revisao de
codigo, mas nao foi independente porque nao havia segundo agente disponivel.
CI, revisao humana e merge permanecem pendentes. A migration 1063 continua
sem aplicacao confirmada em staging ou producao e nao foi executada nesta fase.
