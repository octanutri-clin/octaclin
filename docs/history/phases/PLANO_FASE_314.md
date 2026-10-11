# Plano e análise de gaps — Fase 314

## Estado vigente — REV11 e G02 REV9

Ratificação integral pelo proprietário recebida em 2026-10-11. Protocolo vigente:
`docs/product/FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md`, hash
`3dd197dfa16dd235bda1573020cf0af04b3ae8699c2c21388a90d2bf670a201a`.
G02-PROTOCOLO RATIFICADO_PELO_USUARIO; formalização institucional separadamente
pendente. G01 e direitos BLOCKED, ativação não autorizada. A execução técnica
continua autorizada. As limitações documentais antigas abaixo foram substituídas
pela autorização de desenvolvimento e pelo protocolo ratificado; preservar como
histórico. A main inclui a entrega técnica #392 e a correção #393.
Evidências recebidas imutáveis em `docs/history/phases/reviews/fase-314-rev11`;
scripts novos em `scripts/research/fase314`. Sem migrations novas/externas.

## T01–T18 — situação vigente

O estado técnico, critérios restantes e dependências estão no
[checklist canônico](../../../tasks/todo-fase-314.md#t01t18--situação-vigente-desta-continuação),
para evitar três tabelas concorrentes. G02 ratificado; G01/direitos e ativação
continuam bloqueados. Evidências e comandos em
`docs/history/phases/VALIDACAO_FASE_314_REV11.md`.

## Histórico das etapas anteriores

Preparado em 2026-10-10; atualizado para execução controlada em 2026-10-11.
**Desenvolvimento técnico autorizado; ativação assistencial bloqueada.** Risco **R4**,
por dados clínicos, autorização, isolamento e persistência. Registros históricos
de proibição abaixo descrevem a etapa anterior e foram substituídos pela autorização
expressa de desenvolvimento. G01/G02 permanecem BLOCKED.

Estado e evidências: [entrega técnica](ENTREGA_TECNICA_FASE_314.md). Decisões humanas
concentradas no [dossiê](../../product/DOSSIE_RATIFICACAO_FASE_314.md).

## 1. Base observada e reconciliação

- `main`: `f8c5ab66f2708d4a73fc31d460f929a665bd6f08`, PR #391 mergeada em
  2026-10-10T20:38:15Z, conferida no GitHub e no Git neste ciclo.
- CI final da PR 313 `38082785780`: SUCCESS, incluindo Backend, Web,
  Governança, Demo e PR Gate. O Demo executou 752 testes visuais; a primeira
  falha de acentuação foi corrigida e revalidada. CI principal pós-merge
  `38084523466`: SUCCESS. CodeQL, Semgrep e Trivy pós-merge também SUCCESS.
- Migration 1068: código integrado; aplicação/validação em staging/produção
  **SKIPPED neste ciclo**, sem confirmação do proprietário ou consulta ao banco.
  Revisão R4 independente da 313 continua não comprovada. Não fechar essas
  pendências pelo merge. Não executar bancos externos durante o planejamento.
- Monitor de produção FAIL registrado na 313 continua uma pendência histórica
  separada; nenhuma nova verificação de saúde produtiva neste ciclo.
- Trabalho isolado em `docs/fase-314-planejamento`, worktree
  `.worktrees/docs-fase-314-planejamento`. Preservar o handoff 313 e seus gates
  residuais ao promover o novo handoff; não abrir PR só para reconciliar estado.

## 2. Decisões do proprietário

| Item | Decisão nesta conversa |
| --- | --- |
| Referência pediátrica | OMS 2006/2007 com classificação MS/SISVAN |
| Indicadores | IMC/idade, comprimento ou estatura/idade, peso/idade, peso/comprimento ou estatura |
| Limites | Cada indicador somente na sua faixa; ausência explicada, sem extrapolação |
| IMC aos 19 anos | Adotar a nota SISVAN usando a referência de 19 anos completos para 19a1m–19a11m; não estender estatura automaticamente |
| Superfície | Avaliação, histórico e gráfico no console profissional; sem novo portal/representação legal |
| Prematuros | Incluir classificação e idade corrigida; caminho INTERGROWTH-21st → OMS para revisão clínica |
| Nascimento | Data de nascimento, semanas/dias ao nascer e origem explícitos; incompletos mantêm medidas e motivo |
| Sexo da curva | Escolha explícita por avaliação, sem inferir por nome/identidade; desconhecido não classifica |
| Técnica | Registrar deitado/em pé; conversão OMS de 0,7 cm explícita e original preservado, sujeita à ficha |
| Contexto/histórico | Confirmar e preservar por avaliação; correções só nos próximos registros; separar bases no gráfico |
| Interpretação adulta | Planejar bloqueio de cintura/RCQ/composição abaixo de 18; equipe revisará 18–19 e limites por fórmula |

Decisões complementares: INTERGROWTH sem rótulos SISVAN na etapa inicial;
equipe define elegibilidade, com medidas sem classificação nos casos fora dela;
levar à revisão a transição conservadora após 64s0d. Duração/base da correção
de idade continua pendente. Essas escolhas não ratificam a ficha numérica
completa; a ficha tem checklist de validação clínica separado.

## 3. Gaps observados, com consumidores

| Gap | Evidência em `octaclin-backend/src/modulos/pacientes/` ou Web | Alteração planejada |
| --- | --- | --- |
| Idade reduzida a anos completos | `dominio/antropometria.ts:idadeNaData`; `infraestrutura/avaliacao-antropometrica.orm.ts:idadeAnos` | Função de datas civis/idade em dias, método mensal ratificado; idade real e idade usada no cálculo no snapshot cifrado |
| Sem referência pediátrica | `classificarImc` não classifica <20; aviso exige escore-z | Módulo puro pediátrico, referências estáticas e versões explícitas |
| Só avisos para composição em menores | `aplicarProtocolo` continua executando após `equacao_de_adulto_aplicada_a_menor_de_idade`; teste atual apenas exige aviso | Bloqueio real abaixo de 18; política de 18–19 somente após revisão por fórmula; regressão do comportamento histórico |
| Cintura/RCQ adultas sem idade mínima | `calcularAntropometria` verifica sexo/gestação, mas não idade | Aplicar a política etária ratificada no backend; manter medidas/razão factual |
| Peso mínimo 1 kg e altura mínima 30 cm | `CriarAvaliacaoAntropometricaDto` e `LIMITES` | Entrada pediátrica admite prematuros menores que esses limites; positivos/finitos, precisão e plausibilidade próprios, sem mudar silenciosamente validação adulta |
| IMC técnico 8–100 herdado | `LIMITES.imc` usado por todo o domínio | Não usar esse intervalo como validade de curvas neonatais; ficha define proteção técnica distinta |
| Sem técnica da medida | `MedidasAntropometricas.alturaCm` sem deitado/em pé | Técnica e ajuste preservados; nunca sobrescrever a medida original |
| Sem contexto neonatal | Serviço lê nascimento do cadastro; DTO não registra IG ao nascer/origem | Contexto cifrado e confirmado por avaliação; não inferir prematuridade nem IG por peso |
| Referência não reproduzível após mudança do cadastro | Snapshot atual preserva sexo/idade em anos, não nascimento/idade precisa/técnica | Guardar todas as entradas efetivamente usadas e política de correção; conferência do cadastro na gravação |
| Sem modelo neonatal | Não existem INTERGROWTH/idade pós-menstrual/idade corrigida no domínio | Roteamento de referências por população e idade; classificação parcial por indicador |
| Histórico limitado sem cobertura | `listarAvaliacoesAntropometricas` usa `take:100` e não pagina | Projeção pediátrica paginada específica, limite e cursor visíveis |
| Gráfico genérico por data | `aba-antropometria.tsx`/`GraficoEvolucao` mostram peso/IMC/RCQ/composição | Curvas por idade/comprimento/PMA, com bases separadas, fonte e unidade; tabela acessível |
| Preview tem classificação adulta local | `aba-antropometria.tsx` reproduz cortes adultos e apenas avisa <20 | Nenhum classificador pediátrico no navegador; prévia factual e resultados autoritativos do backend |
| Portal só conhece métricas antigas | `dominio/progresso-paciente.ts` permite IMC, gordura e massa magra | Não acrescentar indicadores pediátricos ao portal nesta fase; regressão garante allowlist e ausência de contexto neonatal/novas classes |
| Há responsável cadastral, sem representação autenticada | `ResponsavelCadastroPacienteDto` contém nome/parentesco/contato; não há autorização/consentimento de representante | Não confundir contato com acesso legal; sem novo fluxo de representante nesta entrega |

Consumidores a inspecionar na implementação: `prontuario-api.ts`, snapshots
do resumo/timeline/longitudinal, comparação de avaliações, relatório de alta e
documentos que leem antropometria. Não acrescentar novos rótulos clínicos a
essas superfícies por efeito colateral. Gestantes/adultos/idosos permanecem
cobertos por regressões; gestação tem precedência sobre classificador pediátrico.

## 4. Referências e gates de entrada

Fontes, hashes, limites e exemplos em
[FICHA_VALIDACAO_CLINICA_FASE_314.md](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md)
e [FONTES_ANTROPOMETRIA_FASE_314.md](../../product/FONTES_ANTROPOMETRIA_FASE_314.md).
Foram lidas 16 planilhas oficiais OMS (L/M/S e grades), quatro tabelas neonatais,
manuais OMS/INTERGROWTH e documento SBP. Isso é conferência documental, sem
afirmar validação clínica independente.

- **G01 — referência computacional completa.** Fechar lookup mensal OMS 2007,
  bordas 60/61 meses e 19 anos, interpolação por comprimento, caudas LMS,
  percentis, flags técnicas e política por fórmula. Para INTERGROWTH, obter
  equações/coeficientes ou dados diários oficiais suficientes. Tabelas semanais
  arredondadas não autorizam estimar escores/percentis individuais por
  interpolação inventada. Conferir condições de reprodução dos artefatos e
  atribuição antes de incorporá-los; não copiar executáveis/calculadoras.
- **G02 — ratificação clínica.** Equipe/proprietário revisa a ficha consolidada,
  população neonatal, transição/correção e exemplos de borda. Registrar o
  resultado e versão revisada. Escolhas de produto não substituem essa revisão.
- **G03 — autorização de implementação e modelo.** Este pedido autoriza apenas
  planejamento/gaps. Pedir implementação após G01/G02 e handoff final.

G01/G02 não impedem inventário/contratos/documentação. Não implementar o
classificador nem inserir dados clínicos da curva em runtime antes do gate.

## 5. Contrato e persistência propostos

### 5.1 Gravação — endpoint atual

**Rev2:** papéis atuais SuperAdmin/Professional/Collaborator e permissões
`pacientes.ler`/`pacientes.gerenciar`; Professional limitado à carteira pelo
resolvedor atual, demais com visão tenant. Não copiar a exclusividade de
emissão do encaminhamento 312 nem afirmar acesso exclusivo do responsável.
CL-10 deve ratificar adequação; eventual restrição exige decisão explícita.

Estender `POST /pacientes/:id/avaliacoes-antropometricas`, preservando o
contrato legado. Acrescentar `pediatrico?: ContextoPediatricoDto` validado,
UUID `chaveCriacao` obrigatório para novas avaliações com contexto pediátrico:

```text
pediatrico:
  confirmarContexto: true
  dataNascimentoConferida: data civil | ausente
  tipoMedidaLinear: deitado | em_pe | nao_informada
  nascimento: a_termo | prematuro | nao_informado
  semanasGestacaoAoNascer?: inteiro
  diasGestacaoAoNascer?: 0..6
  origemIdadeGestacionalAoNascer: enum fechado, ratificado na ficha
  referenciaNeonatalAplicavel?: confirmação do profissional
  [critérios adicionais de elegibilidade somente após decisão da ficha]
```

Reutilizar `sexo` como referência escolhida explicitamente, sem inferência do
cadastro. Ausência significa curva não escolhida. Campo de nascimento ausente
permite medidas sem indicadores por idade; diferença entre nascimento
conferido e cadastro atual retorna 409 para nova conferência. O serviço mantém
lock do paciente durante resolução das entradas e gravação; não aceitar idade,
escore, percentil, rótulo, L/M/S ou algoritmo enviados pelo cliente.

Datas: validar calendário real, anterioridade nascimento/avaliação, sem futuro;
operações em dias civis, sem relógio/local timezone/DST na idade. Nascimento
gestacional com pares semanas/dias coerentes e fonte explícita; regra final
dos limites na ficha. Nascimento prematuro não informado não vira a termo.
Obrigatoriedade do contexto de prematuridade depende da janela de correção
ratificada; não exigir história neonatal de todos os adolescentes para usar
idade cronológica quando a correção já não se aplica.

O bloqueio de fórmulas não depende do cliente enviar `pediatrico`: a idade
resolvida no servidor aplica a política também às chamadas legadas. Preservar
a interface adulta e distinguir dado ausente/inválido, referência inaplicável
e extremo estatístico. Não trocar uma classificação pediátrica ausente por
faixa adulta. Contexto gestante bloqueia interpretação pediátrica automática
do estado nutricional atual, inclusive 18–19, sem alterar a 313.

### 5.2 Snapshot cifrado

Extensão aditiva em `resultadoCriptografado.pediatrico`; manter campos antigos.
Guardar contexto real, nascimento conferido, sexo usado, idade cronológica em
dias, idade pós-menstrual/corrigida e política, técnica original/normalizada,
ajuste, fonte/versão/hash público do artefato, algoritmo, chave/posição da
tabela e parâmetros efetivamente utilizados. Por indicador:

```text
id; valor; unidade; eixo/base de idade; referencia;
escoreZ bruto e precisão de exibição;
percentil (número permitido ou indicação de cauda);
classificacao quando aplicável; motivos de ausência; flags técnicas.
```

Não classificar pelo IMC/arredondamento já exibido no objeto antigo. IMC
medido (peso/medida original) e IMC usado na curva (medida normalizada) precisam
ser distinguíveis; não substituir o primeiro silenciosamente. Campos novos
ficam dentro dos blobs cifrados, sem DOB/IG/prematuridade/sexo novo em metadata
de auditoria ou índices. `idadeAnos` e `sexo` existentes mantêm o contrato.

Sem nova entidade/migration clínica prevista: 1016 admite idade zero e já
protege por FORCE RLS; 1068 fornece chave/unique/replay e trigger de UPDATE
para avaliações com chave. A imutabilidade não é absoluta: o trigger permite
soft delete/compartilhamento e não cobre DELETE físico. Provar grants/ausência
ou bloqueio de DELETE no runtime; se for necessário endurecimento estrutural,
reabrir a decisão de schema, sem editar a 1068 integrada ou criar migration
nesta etapa. Não declarar proteção de DELETE com base no trigger de UPDATE.
Não modificar snapshots antigos nem realizar backfill.
Se surgir necessidade real de schema, voltar ao plano antes de criar 1069.
Obrigar chave para contexto novo e provar trigger em PostgreSQL real.
Fingerprint cifrado normaliza o payload efetivamente aceito; mesma chave e
pedido retornam o mesmo snapshot, mesmo após mudança do cadastro. Outra chave
aplica o cadastro/contexto atual. Replay divergente retorna 409; não devolver
`_fingerprint` ou entidade ORM na projeção.

### 5.3 Leitura e gráfico

Propor `GET /pacientes/:id/acompanhamento-pediatrico` com `indicador` enum,
`cursor` UUID e `limite` 1–100 (padrão 100). Reutilizar guardas/papéis/permissão
`pacientes.ler` do console e `garantirEscopoPaciente`/`ExecutorTenant`; nenhuma
ampliação de acesso. Revalidar paciente/carteira em cada página.

Retornar somente snapshots pediátricos/proveniência necessários à superfície,
cursor e cobertura. Ordenação total por data civil, timestamp e UUID;
comparação da âncora no SQL para conservar microssegundos. Cursor precisa
pertencer ao mesmo tenant/paciente; pode ancorar registro legado sem contexto
pediátrico, pois o scan é do histórico geral. A âncora excluída logicamente
continua válida só para posicionamento, nunca para exposição clínica.
**Rev2 — sem índice clínico novo:** varrer até `limite` avaliações gerais +1
lookahead por chamada (máximo 100+1), descriptografar apenas o lote autorizado,
projetar somente indicadores pediátricos pertinentes. O cursor de continuação
é o último registro **examinado**, não o último resultado pediátrico exibido.
Página pode ser vazia com continuação; UI deve permitir avançar e jamais
interpretar vazio como fim. Retornar `registrosExaminados`, `itensExibidos`,
`temMaisHistorico` e `proximoCursor`; não prometer página com 100 pontos
pediátricos nem total completo antes de consumir a série. Query `indicador`
filtra projeção; mudanças de filtro reiniciam o cursor. Não usar JSON SQL em
blob cifrado, scan ilimitado ou flag pediátrica em claro para otimizar.
Provar >100 registros mistos, blocos vazios, ciphertext ilegível e exclusão
da âncora; snapshot ilegível dá motivo técnico neutro e não vira medida zero.
Avaliações legadas permanecem no histórico geral sem classificação retroativa.

BFF específico com sessão, permissão, UUID, whitelist de query e respostas
privadas `no-store` inclusive erros, `Vary: Cookie`; sem PHI na URL. Escrita
continua no BFF existente, com origem e limite de corpo. Nenhuma referência é
obtida pela rede em runtime; dados estáticos não vão ao cliente como mecanismo
de classificar novas medidas.

Gráfico seleciona indicador/referência/base, apresenta unidades, datas/idades,
faixas/escores e tabela equivalente. Separar sexo, nascimento/IG/política,
referência/algoritmo e técnica/base incompatíveis; não conectar curvas OMS2006,
OMS2007 e INTERGROWTH como uma função contínua nem ocultar troca de método.
Peso/comprimento usa comprimento/estatura como eixo; índices por idade usam a
idade correspondente; prematuros mostram PMA, corrigida e cronológica com
rótulos distintos. Pontos duplicados na mesma idade continuam individualmente
identificáveis; não escolher um arbitrariamente.

API fornece curvas visuais limitadas (proposta: até 200 pontos por referência,
preservando descontinuidades e bordas). Amostragem é apenas desenho, jamais
base do cálculo individual. UI indica amostragem/cobertura parcial, permite
carregar mais, não inventa denominador nem conecta lacunas. Tabela rolável com
região nomeada/foco de teclado, como na correção mobile da 313.

## 6. Fatias e checkpoints

Tarefas pequenas com arquivos, dependências e aceite em
[todo-fase-314.md](../../../tasks/todo-fase-314.md).

1. G01/G02: fichas, regras e artefatos reproduzíveis; revisão antes do algoritmo.
2. Vertical OMS: idade exata + IMC/idade + snapshot + resultado/histórico.
3. Estatura/idade + peso/idade + peso/comprimento-estatura; técnicas e caudas.
4. Vertical neonatal: elegibilidade + PMA + INTERGROWTH + transição/correção.
5. Proteções adultas T11 antes da primeira gravação pediátrica T06, sem alterar históricos.
6. Projeção paginada + BFF + gráfico/tabela + regressões/demo/governança.

Checkpoints após cada 2–3 tarefas. Contrato/fixtures fechados antes das telas;
um escritor ativo por vez. Não delegar automaticamente nem criar PRs por fatia.

## 7. Plano de prova e riscos

Não foram executados nem adicionados testes de implementação neste
planejamento. A execução futura depende do escopo de validação autorizado.

| Risco | Prova prevista |
| --- | --- |
| Referência/sexo/unidade trocados | Manifesto/hash e grade completa; arquivos de peso OMS2007 têm nome `hfa` mas planilha interna `wfa`, verificar conteúdo/unidade |
| Idade/limites incorretos | Nascimento/avaliação civis, bissexto, fim do mês, 730/731 e 1856/1857 dias, 60/61/120/228/229 meses, 18/20 anos |
| Caudas/percentis falsos | LMS L=0/L≠0, caudas ±3, limites de percentil, classificação pelo valor bruto; exemplos publicados independentes |
| Prematuro tratado como a termo | IG ausente, PMA anterior à curva, população não elegível, transição/limite da correção e gestação atual |
| Fórmula adulta em menor | Todas as quatro fórmulas/cintura/RCQ, chamadas legadas, ausência de idade/sexo, 17a364d/18/19/20, gestante |
| Snapshot mutável/corrida | PostgreSQL real runtime não owner/RLS; replay simultâneo; mudança DOB/carteira durante conferência; imutabilidade e histórico após correção |
| Paginação perde dados | Mais de 100 avaliações, mesma data/microssegundos, cursor alheio e soft delete; nenhuma perda/duplicação |
| Vazamento | Cross-tenant/carteira/papel, BFF sem permissão/sessão/origem, cache em sucesso/erro, auditoria sem PHI, portal sem novos campos |
| Interface inacessível | Desktop/mobile, teclado, axe, tabela/gráfico/sem dados/erro/recuperação, corte de cobertura explícito |
| CI falso verde | Registrar testes novos em Jest/harness authz/Playwright default; Demo sintético com contrato fiel; linguagem antes do push |

Gates futuros: backend typecheck/build/focado/completo/PG real; Web
lint/typecheck/build/test:authz/focado desktop-mobile; `test:linguagem` e jornada
de microcopy; governança aplicável, Demo local smoke e PR Gate; scanners.
DoD: um PR de implementação, gates no mesmo HEAD, evidências PASS/FAIL/NA/
SKIPPED, revisão R4 quando viável. Check externo não executado não vira PASS.

Rollback: não remover snapshots/contexto nem reintroduzir fórmula adulta
inadequada para desligar a função. Se retirar temporariamente novas gravações,
preservar leitura histórica, fontes e proteções etárias. Sem DDL/backfill nem
mudança de provider neste plano. A liberação externa exige conferir 1068 e
schema/runtime/grants pelo runbook; planejamento não autoriza deploy.

## 8. Modelos e handoff

- Planejamento, protocolo, algoritmo, persistência/concorrência e integração:
  **GPT-6.1 Sol médio**. O escopo neonatal ampliado mantém essa recomendação.
- **GPT-6 Luna alto** é suficiente para telas/fixtures isoladas somente depois
  de contrato, regras e exemplos fechados; não definir curva/corte/cauda para
  economizar tokens. Evitar refazer a pesquisa: fornecer ficha/manifesto e
  tarefa delimitada. Alertar o proprietário e pausar antes de qualquer troca.
- Não é necessário mudar o modelo agora. Não iniciar implementação nesta
  sessão sem autorização posterior e ratificação dos gates clínicos.

## 9. Evidências deste planejamento

- PASS: leitura do código/contratos e reconciliação Git/GitHub da 313.
- PASS: downloads públicos e inspeção de conteúdo/grades das 16 planilhas OMS;
  quatro tabelas INTERGROWTH e manuais, checksums no manifesto.
- PASS: links locais dos cinco novos documentos e `git diff --check`.
- PASS: `pnpm security:secrets`; nenhum segredo real encontrado. Aviso do
  ambiente Node 24/pnpm 11 fora da faixa Node 22 não impede essa verificação
  documental; testes de implementação devem usar runtime suportado.
- SKIPPED: testes do software da 314, código não implementado/escopo atual é
  planejamento; revisão clínica final e computação neonatal completa pendentes.
- SKIPPED: aplicação de migration, acesso a bancos externos, deploy,
  diagnóstico de produção e revisão R4 independente da implementação.


## 10. Consolidação técnica rev2 e gates G00–G05

[Relatório completo de revisão](REVISAO_PLANEJAMENTO_FASE_314.md), com
anexos preservados, hashes, divergências, comandos e prontidão. A ficha contém
CL-01–CL-10 com fonte/impacto/risco/decisão; T01–T18 continuam não iniciadas
como implementação. T01 documental avançou, mas seu gate não está concluído.

| Gate | Estado | Evidência / condição de saída |
| --- | --- | --- |
| G00 — base, fontes, direitos e dependência operacional | BLOCKED (partes PASS) | Branch/diff/base/PR reconfirmados; hashes locais OMS PASS. Termos e aplicação externa da 1068 não confirmados. Sem acesso a bancos. Bloqueio operacional da 1068 aplica-se ao rollout; não impede pesquisa documental. |
| G01 — método computacional | BLOCKED | Interpolação OMS confirmada em fonte oficial; âncoras identificadas. Neonatal diário/termos, edição/método de idade e provas completas ainda faltam. |
| G02 — ratificação CL | BLOCKED | CL-01–CL-10 sem aceite humano específico desta versão. |
| G03 — implementação/testes | BLOCKED | Proprietário autorizou somente revisão/documentação e proibiu T03–T18 neste ciclo. |
| G04 — implementação/R4/regressões | SKIPPED | Não implementado; nenhum teste do software executado. Provas previstas nas tarefas e matriz. |
| G05 — entrega/rollout | BLOCKED | Sem implementação/CI314/revisão R4 final; ambiente/1068/saúde não comprovados. Deploy/migration/merge não autorizados. |

Esta tabela é a fonte do estado consolidado. SKIPPED é não executado;
BLOCKED identifica condição necessária aberta; partes PASS não fecham um gate.
G01/G02/G03 são necessários antes de T03–T18. G00 operacional e G05 exigem
prova externa futura específica antes de produção, sem acoplar consulta de
produção à autorização de pesquisa. Uma PR documental não foi aberta.

### 10.1 Correções arquiteturais adicionais

- Reutilizar `ExecutorTenant`, escopo/carteira, locks e cifra existentes. Não
  criar segundo registro clínico, tabela de prematuros ou pipeline de auth.
- DTO atual rejeita <1 kg/<30 cm; domínio também. T06 deve validar ambos os
  caminhos explicitamente, com discriminante pediátrico validado, sem deixar
  o cliente omitir contexto e obter faixa adulta. Testar idade desconhecida,
  cadastro alterado entre conferência/gravação e permissão revogada.
- Contexto inclui `edema: sim|nao|nao_informado` e dados mínimos de elegibilidade
  **somente após CL-05/CL-09**, dentro da cifra; nada inferido do peso.
- Snapshot/projeção têm estado por indicador `classificado`, `nao_aplicavel`,
  `insuficiente` ou `inconsistente`, motivo enum fechado e flag separada; escore
  disponível sem classe SISVAN (etapa INTERGROWTH) deve ser representável.
- Normalização/técnica/flags do IMC pertencem a T03/T05, antes da gravação T06,
  não esperar T07/T08. T11 protege o primeiro caminho de gravação; T16-A
  prova snapshot/RLS/replay antes de UI; T16-B prova paginação em T12.
- Fingerprint atual abrange `dados`; estender normalização canônica sem mudar
  semântica do replay de registros 313. Revalidar autorização antes do replay;
  chave excluída não cria registro novo. Mesma chave, corpo e ator: snapshot
  original; payload divergente: 409; mesma chave em outro ator tem escopo
  separado, como o índice atual. Falha de auditoria após commit não justifica
  gerar nova chave/duplicar avaliação. Locks na ordem existente paciente → key.
- Transferência/cadastro concorrentes devem usar lock compatível; verificar
  caminhos que editam perfil/DOB antes de afirmar que um único lock resolve
  toda corrida. Em leitura, autorização/carteira precisam continuar válidas
  no instante da projeção, sem misturar páginas de pacientes.
- `mapearAvaliacaoAntropometrica` hoje devolve todo o JSON `resultado`.
  Não adicionar campos internos e presumir que tipos TS ocultam dados. Nova
  projeção e consumidores legados requerem allowlist; portal mantém métricas
  explicitamente autorizadas e não recebe contexto/flags/classe pediátrica.
- Retificação referenciada por novo evento/supersessor é hipótese dos anexos,
  não contrato existente. Nesta fase manter nova avaliação com snapshot e
  exclusão lógica autorizada já existente; não inventar vínculo de retificação,
  migration ou tratamento de ponto antigo sem nova decisão de produto.
- Rollback conserva leitura de snapshots, fontes/versões e proteções. Pode
  desabilitar novos cálculos/gravações; não desabilitar toda leitura histórica
  nem usar down da 1016/1068 com dados para reverter esta fase.

## 11. Integração REV3 — foco G01 e pendências clínicas

Proprietário aprovou revisão documental **com ressalvas**, autorizando pesquisa
sem implementação. [Investigação detalhada](INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md)
e [propostas CL-01–CL-10](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md#10-propostas-para-ratificação--integração-rev3)
refinam os seis documentos. Relatório rev2 é histórico, não deletado.

Candidato contínuo INTERGROWTH identificado nos dois projetos; oráculo oficial
concordou em14 casos únicos/28 resultados (lote12/24 + inicial1/2 +55semanas1/2).
Coeficientes detalhados primários/direitos/políticas continuam pendentes.
G01 não muda paraPASS por concordância entre bibliotecas ou amostra sintética.

| Subgate G00 | Estado | Limite |
| --- | --- | --- |
| G00-fonte/direitos | BLOCKED (integridade parcialPASS) | Hashes/commits/licenças de código identificados; direitos de dados/equações/incorporação ainda abertos |
| G00-operação1068 | BLOCKED (consultaSKIPPED) | Aplicação em staging/produção,role/grants/RLS sem prova externa; necessário para rollout, não para pesquisa |

G00 global BLOCKED; G01/G02/G03 BLOCKED; G04 SKIPPED; G05 BLOCKED.
Tabela seção10 preserva histórico; esta seção refina evidência, sem fechar gate.
Não executar T03–T18 nem entregar apenasOMS por descoberta de biblioteca.

Refinamentos de contrato **propostos, não aprovados**: contexto explícito
nascimento versus pós-natal e janela0–2 dias (CL-05); não adicionar Newborn Size,
hora do nascimento ou nova entidade por inferência. Política única versionada
para correção/transição (CL-07), sem copiar WHO cronológica de gigs e sem
assumir24/36 meses. Normalização neonatal não herda±0,7OMS automaticamente.
Campos mínimos elegibilidade/técnica/edema/política permanecem cifrados,
confirmados por avaliação; nenhum novo índice clínico ou papel foi autorizado.

T01-C passa a exigir procedência científica dos coeficientes, oráculo diário,
limites/extremos e termos por camada, com ressalva55semanas preservada.
T02 recebe propostas explícitas e alternativas de todos osCL. Ordem T01–T18
rev2 permanece: nenhum algoritmo novo iniciado. Preservar proteção gestacional,
replay/carteira/RLS/cifra/allowlists/paginação e rollback do plano existente.

Prontidão: planejamento aprovado documentalmente com ressalvas e atualizado;
clínicaBLOCKED, implementaçãoBLOCKED, produçãoBLOCKED. Sol 6.1 médio continua
adequado à pesquisa/núcleo; Luna alto somenteUI delimitada após contratos/gates,
com aviso e pausa para troca manual.

## 12. Decisões finais REV4 e prova finita

[Matriz finalCL-01–CL-10](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md#11-matriz-final-de-decisão-cl-01cl-10--rev4)
é o formulário vigente para respostas, com fonte/proposta/alternativa/impacto.
CL-07 incorporaElmrayed2025:36 meses **corrigidos** em IG<32, sem incluir32–36.
Opção24corrigidos para32–<37 é proposta local provisória a ratificar, não
conclusãoSBP ou evidência universal. RCPCHNICM24corrigidos é alcance deinstrumento;
SBP 2023 refere desenvolvimento segundo REV4, acesso direto403. Base/igualdade
no limite/indicadores/técnica eexceções devem ser aprovadas explicitamente.

Contagem reconciliada nosJSONs:14 casos únicos/28 resultados, lote12/24 + inicial1/2
+55s1/2; z epercentil compõem umresultado de indicador. Nenhuma consulta nova
Oxford nestaREV4. [Protocolo prospectivo finito e direitos](INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md#8-fechamento-objetivo-rev4--evidência-contagens-e-direitos):
14 casos existentes +até 8 manuais novos, provas locais diáriasoffline, tolerâncias
propostas a aprovar antes das novas comparações. Não usar todos osdias contra
site nem incluir rede em CI. Caso55semanas não justifica aumentar tolerância.

Encerrar discussão genérica: faltam respostasCL, fonte/precisão científica,
aceite/explicação55, dados/ediçãoOMS e decisão de direitos da incorporação.
VillarCCBY-NC-ND é obra; pacotesGPL/MIT e dados/métodos têm análise distinta.
Roteiro de consulta preparado,sem envio a terceiros autorizado. Não fazer
novo módulo/tabela/protocolo paralelo nem adicionar recursoNewbornSize.

G00-fonte/direitosBLOCKED e G00-operação1068BLOCKED/consultaSKIPPED separados;
G01/G02/G03BLOCKED, G04SKIPPED, G05BLOCKED. ContratosRLS/cifra/carteira/replay,
snapshots/versionamento, paginação por examinados/âncoraSQL, portal/gestação,
retenção e rollback da seção5 continuam integralmente preservados.
T03–T18 não iniciadas. Ficha ratificada+evidênciasG01+autorizaçãoG03 requeridas;
nenhuma aprovação documental substitui esses gates. ModeloSol6.1médio suficiente,
sem necessidade de troca para concluir esta etapa.
