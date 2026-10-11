# Dossiê único para ratificação — Fase 314

## Estado vigente — integração REV11 / ratificação G02 REV9 (2026-10-11)

O proprietário ratificou integralmente CL-01–CL-10 no pedido de integração da REV11.
O protocolo normativo vigente é [G02 REV9](FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md),
SHA-256 `3dd197dfa16dd235bda1573020cf0af04b3ae8699c2c21388a90d2bf670a201a`;
registro não identificável em [aceite](FASE_314_ACEITE_CLINICO_G02_REV9_2026-10-11.md).
**G02-PROTOCOLO: RATIFICADO_PELO_USUARIO.** Formalização institucional pendente e
revisão especializada não alegada; são estados separados. Não exigir novo aceite
para a mesma versão. **G01 BLOCKED**, direitos não comprovados; ativação não autorizada.

Regras anteriores conflitantes abaixo são histórico, não contratos de implementação:
roteamento local 1856/1857 dias; técnica pela idade efetiva e limiar731 dias;
correção por DPP+meses civis; fórmulas adultas desde18 anos, com domínios individuais;
escrita pediátrica somente Professional autorizado e leitura autorizada/auditada.
Cálculos pediátricos continuam isolados do serviço assistencial; snapshots v1 não
são recalculados. Os novos snapshots v2 preservam a ratificação e identificam
validação computacional/direitos pendentes. A autorização de desenvolvimento segue
vigente; não abrange merge, deploy, migrations externas ou ativação clínica.

Dossiê operativo vigente: [pendências de liberação](PENDENCIAS_LIBERACAO_FASE_314_REV11.md),
com CL01–10 ratificadas e separação entre pendências técnicas, direitos e operação.

## Histórico documental anterior à ratificação REV9

**Estado:** propostas REV5; nenhuma ratificação clínica/jurídica presumida. Desenvolvimento técnico autorizado separadamente. Respostas e identificação do responsável competente devem ser registradas em canal protegido, referenciando versão/hash dos documentos. Não incluir assinaturas, nomes ou registros profissionais em Git público.

As regras implementadas experimentalmente não são usadas pelo backend assistencial. Os snapshots do console contêm medidas e relações aritméticas, com quatro indicadores bloqueados. Fontes primárias e limitações completas: [manifesto](FONTES_ANTROPOMETRIA_FASE_314.md), [ficha](FICHA_VALIDACAO_CLINICA_FASE_314.md), [REV5](DECISOES_RATIFICACAO_FASE_314_REV5.md) e [investigação](../history/phases/INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md).

| CL | Regra preferencial / população | Fonte e justificativa | Alternativas e riscos | Impacto, testes e aceite necessário |
| --- | --- | --- | --- | --- |
| CL-01 | Datas civis; dias/30,4375 separado; OMS2006 abaixo de60 meses estatísticos, OMS2007 a partir60, limites por indicador; SISVAN19 anos apenas IMC até20º aniversário | OMS Anthro/AnthroPlus, SISVAN2011; separar idade estatística e aniversário evita extrapolação | Transição civil diverge da estatística; não inferir âncoras60/121/229 de planilha.29/02 precisa convenção clínica explícita | Ratificar roteamento/edição/âncoras/igualdade/29/02. Testes730/731,60/61,120/121,228/229,19/20. Datas civis técnicas já testadas; datasets/roteamento clínico não liberados |
| CL-02 | Técnica explícita; proposta OMS<24m comprimento,>=24m estatura,±0,7 uma vez; em pé<9m reconferir; WFA independente | OMS Anthro e padrões2006; regra não se transfere ao IG | Ratificar qual idade governa técnica do prematuro e exceções neonatais; sem técnica não imputar | Preservar original e valor normalizado/versionado; precisão0,001kg/0,1cm proposta. Candidato sintético testado; ajuste não aplicado aos snapshots assistenciais |
| CL-03 | LMS/interpolação de parâmetros, caudas por indicador; z bruto, apresentação2 casas; percentil limitado textualmente; IG lognormal direto | Algoritmos OMS e modelo candidato Villar/gigs/growthstandards, investigação independente Oxford sintética | Concordância matemática amostral não prova clínica/direitos; precisão primária e 55s abertas | Ratificar método/caudas/exibição/flags. Tolerâncias prospectivas z1e−8,pct1e−6pp; limites textuais sem0/100 artificiais. Testes sintéticos e oráculos arquivados |
| CL-04 | Edição-base SISVAN2011 única; tabela de verdade com cortes brutos e nomenclatura completa; IG sem rótulos SISVAN | MS2011; peso elevado por idade não implica obesidade | Resolver divergências2008/2011 explicitamente, sem mistura por indicador | Ratificar todas as igualdades−3/−2/+1/+2/+3 e vizinhanças por idade/indicador. Rótulos clínicos não habilitados |
| CL-05 | Proposta singleton,IG26s0–36s6, sem exclusões relevantes; confirmação específica; nascimento e0–2dias fora do pós-natal | Villar2015: população selecionada, menor representação<33; limitação não equivale proibição universal<33 | Regras de produto para RCIU/morbidade/malformação e0–2dias são propostas locais; alternativa protocolo específico com nova evidência | Neonatologia/pediatria ratifica critérios/campos mínimos/exceções. Preservar medidas e motivos. Não adiciona Newborn Size ou hora de nascimento |
| CL-06 | Candidato peso/comprimento por PMA27s0–64s0 inclusivo; sem interpolação semanal ou WFL neonatal | Villar2015, gigs/growthstandards pinados e Oxford arquivado14 casos/28resultados | Fonte/precisão primária e direitos não comprovados; semanal55s diverge0,005026kg da tabela | Aceite clínico do método/domínio mais avaliação de direitos. Coeficientes só em teste excluído do build; varredura local de260dias×2sexos×2indicadores. G01 BLOCKED |
| CL-07 | Proposta IG até64s0; OMS corrigida64s1; <32s até36m corrigidos,32–<37 até24m corrigidos; dia-limite inclusivo, cronológica no seguinte | Elmrayed2025: estudo23–31s,1416sobreviventes, dados até36m; SBP2017 transição64s; SBP2023 dois anos para desenvolvimento. Não prova estrato32–36 nem política universal | RCPCH tradicional1ano32–36/2anos<32 e serviço digital diferente;36m não universal.24m estrato32–36 é proposta conservadora local, não evidência direta do estudo | Pediatria/neonatologia ratifica estratos/finalidade/exceções/29/02. Candidato versionado testado em31s6/32s0,64s0/64s1 e limite24m. Idade negativa não truncada |
| CL-08 | <18 bloqueia interpretações adultas;18–19 seis decisões individuais:Pollock3,Pollock7,Faulkner,Guedes,cintura,RCQ | Produto já aprovou<18; código antigo não é fonte de validação clínica dos18–19 | Alternativa liberar método apenas com estudo/amostra/sexo/idade verificados; ausência de fonte mantém método pendente | Ratificar seis aceites/suspensões separadamente. Novos cálculos bloqueados por elegibilidade; medidas/RCQ factual/legados/adultos/idosos/gestação preservados. Testes por método e faixa |
| CL-09 | Medidas positivas/finitas; edema sim/nao/desconhecido; peso somente edema não; flags por indicador no z bruto, sem diagnóstico | OMSflagsHFA−6/+6,WFA−6/+5,BFA/WFL−5/+5; política conservadora desconhecido sujeita aceite | Software OMS pode flagar após arredondamento; z técnico suspeito só profissional; limites técnicos não são limites populacionais clínicos | Ratificar edema desconhecido, igualdade, precisão, visibilidade e reconferência. Candidato preserva HFA/resultado parcial; flags sem rótulo. Snapshots não atribuem plausibilidade clínica |
| CL-10 | Console/papéis/permissões/carteira existentes; sem portal; cifragem/allowlist/idempotência/RLS/retificação sem apagar histórico | Arquitetura real312/313,ExecutorTenant,migrations1016/1068 e classificação de dados | Permissão técnica não é representação legal; responsabilidades/retificação assistencial exigem governança. CI não prova1068externa | Ratificar lançar/consultar/finalidade/retencao. Operador comprova1068/role/grants/RLS por ambiente antes rollout. Testes tenant/carteira/transferência/replay/concorrência e retenção |

## Decisões concentradas para liberar

1. **Clínica:** responder CL01–10, com seis respostas individuais emCL08 e participação pediatria/neonatologia para prematuridade. Registrar versão/hash da ficha e referência ao aceite protegido.
2. **Método:** origem/precisão primária IG, divergência55s, edição/âncoras OMS e validação independente completa. Manter tolerâncias prospectivas; não calibrar para obterPASS.
3. **Direitos:** comprovar uso comercial dos artefatos concretos OMS/IG e a forma de incorporação. Licenças GPL/MIT de bibliotecas não autorizam automaticamente datasets/equações.
4. **Operação:** prova externa1068 e qualquer nova migration, role/grants/RLS, revisãoR4/CI doHEAD final; autorização separada de merge/deploy. Nenhuma execução externa feita nesta etapa.

**Prontidão:** desenvolvimento técnico controlado em andamento; protocolos assistenciais e produção BLOCKED. A autorização de desenvolvimento não transforma propostas em ratificação.
