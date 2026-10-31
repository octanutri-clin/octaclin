# FOOD06 — Onda A: contratos e execução

M01/M03/M05/M09 são obrigatórias e complementam o núcleo, não são uma nova função
assistencial habilitada por padrão. Direitos continuam gate para tabelas; itens
independentes de tabelas podem avançar. Risco R2 no domínio puro; R4 ao alcançar
dados clínicos, API, persistência, tenant/RLS/exportação.

## A1 — domínio/contratos sem alterar saídas da PA06 legada

Implementado em incremento separado, com extração do seletor PA06 compartilhado,
sem mudar a soma ou o contrato do endpoint. Cobertura e explicações são puras,
sem registrar rota/provider. [Execução A1](execucao-pos-320-food06-a1.md).
Fontes, causas específicas na interface, revisão de redação e integração continuam
pendentes; este resultado não conclui M01/M03/M09 integralmente.

Reutilizar o resultado PA06 e seu somador de snapshots. Projeção nova enriquecida
é aditiva e versionada; não alterar silenciosamente `ResultadoCalculoCombinadoApi`
ou trocar `parcial` por novo estado no endpoint legado.

Unidade de contagem: componente nutricional efetivo incluído pelo planejamento
autorizado; não alternativas disponíveis, não refeições desligadas. Repetição
legítima do mesmo alimento em refeições distintas não é deduplicada por catálogo.

Estados propostos M01, com precedência explícita:

| Estado | Condição | Quantidade e comparação |
| --- | --- | --- |
| INDISPONIVEL | Impedimento técnico/contratual conhecido para a operação; sem itens para calcular também tem motivo próprio | Não oferecer percentual; se um subtotal independente existir, identificá-lo apenas como contabilizado |
| INCOMPATIVEL | Existe componente com unidade/forma conhecida incompatível | Não somar componente incompatível; subtotal compatível não vira total; sem percentual de referência |
| PARCIAL | Pelo menos um valor compatível conhecido e componentes ausentes/não resolvidos | Quantidade conhecida, contagens/motivos e “total desconhecido”; sem percentual de referência |
| DESCONHECIDO | Itens incluídos, nenhum valor compatível conhecido, sem prova de incompatibilidade | Sem zero numérico inventado, informar causas |
| COMPLETO | Todos os componentes relevantes possuem valores compatíveis conhecidos, inclusive zeros | Total e comparação somente se contexto/ref/população/dia e direitos elegíveis |

Estado de **cobertura** é independente de **comparação**: pode haver total completo
sem referência aplicável. Não chamar todo valor sem referência de incompatível.
Qualidade/licença das fontes também é diferente de completude numérica.

Contrato candidato por nutriente: código/unidade/qualificador, estado/cobertura,
total somente completo, quantidadeConhecida quando parcial, incluídos/conhecidos/
semComposicao/incompativeis/naoResolvidos, motivos com contagens, fontes projetadas
explicitamente, versão do mapeamento/motor. Contagens não viram “confiança80%”.
Campos de fonte devem vir de registros/snapshots autorizados e projeções, nunca de
Record/ORM arbitrário ou lookup no navegador.

Preservar causas: ausência/legado, traço/LOQ, não analisado, reavaliação, valor
inválido/duplicado, schema desconhecido, incompatibilidade unidade/definição e
erro de leitura. Um nutriente inválido não remove valores válidos dos demais.
Limites e erros numéricos da PA06 não são escondidos como simples ausência.

M03: catálogo de códigos → mensagem curta → detalhe → ação possível. Backend
retorna códigos e texto seguro/projetado; frontend apenas apresenta o contrato.
Erros conhecidos não recebem stack, ciphertext, conteúdo do paciente ou nome de
provider no lugar da explicação. Contexto inválido e falha técnica têm causas distintas.

M09: textos próprios de ajuda para RDA/AI/UL, composição/cobertura, planejado versus
ingerido, abaixo/acima sem diagnóstico e limitação do UL. Revisão técnica usa a
ficha ratificada; mudanças clínicas novas exigem aprovação específica. Nenhuma
persona pode aprovar redação que mude o protocolo ou libere comparação bloqueada.

## A2 — rastreabilidade e integração protegidas

Fundamento puro de contexto implementado em incremento da #456, sem rota ou
registro científico. Datas e anos completos reutilizam Fase314; fuso reutiliza
resolvedor canônico sem alterar seu fallback. Casos de confirmação diária e
vitamina C/UL são independentes. [Execução/contexto](execucao-pos-320-food06-contexto.md).
Não equivale a A2 completo ou comprovação de origem autorizada do dado.


M05: registro científico imutável de referência/conjunto com ID/revisão, autoridade,
documento/ano, código/forma/origem/unidade, população/faixas, valor/tipo/UL,
restrições, fonte/atribuição/direitos, checksum e motor. Sem liberdade para cliente
escolher coeficientes ou marcar `elegivel=true` como autorização. Gate de direitos
fecha no servidor; configuração de UI nunca o substitui.

Contexto confirmado no servidor: data civil pelo timezone canônico do tenant,
idade exata/faixa, sexo da referência, sem gestação/lactação, população elegível,
tabagismo e mesmo dia. Revalidar conforme fonte/versão/paciente/configuração atuais;
não guardar PHI/contexto em localStorage/URL/telemetria.

Análise deliberadamente salva para M05/D: envelope clínico versionado e cifrado,
imutável quanto a entradas/resultados usados, sem mutar versão publicada.
Guardar o mínimo necessário à reprodução e ao detalhamento autorizado. Nova
migration aditiva apenas após confirmar leitores/escritores/retenção/rollback;
ensaiar exclusivamente em PostgreSQL descartável. Reutilizar ExecutorTenant,
crypto/auditoria/paginação e políticas profissionais existentes. Proposta detalhada
de entidade/constraints/role e retenção precede DDL; não editar 1078–1080 aplicadas.

Serviço/BFF autenticado revalida tenant/paciente/carteira e capacidade de origem.
Locks/revisões exatas e fontes são resolvidos na mesma visão transacional. No-store,
allowlists e limites. Nenhum corpo clínico nos erros/auditoria. Base de composição
é congelada; nova análise não recalcula snapshot antigo pelo catálogo atual.

## Testes por incremento e saída da Onda A

- A1 RED/GREEN: completo, zero, parcial, desconhecido, incompatível e técnico;
  cada causa/fonte/schema, mistura de snapshots e invariância ON/OFF. Somador
  PA06 continua único e resultados do endpoint legado não mudam.
- M03/M09: todos códigos conhecidos possuem texto/ação coerentes, idioma pt-BR,
  sem números/doses inventados, diagnóstico, recomendação de suplemento ou PHI.
- A2: oráculos/versionamento de referências, datas/faixas/19anos/sexo/fisiologia,
  tabagismo/35mg sem UL alterado, contexto não informado e dia não confirmado.
- Segurança: PostgreSQL descartável com FORCE RLS/role runtime, cross-tenant,
  outro paciente, carteira transferida, usuário revogado, CAS/replay/rollback,
  snapshots cifrados e projeção/erros/logs com canários sintéticos.
- UX A consultada antes de novos fluxos; B na primeira UI e C antes da conclusão.
  Testes de domínio não provam acessibilidade. R4 independente não é substituída
  por personas. CI identifica HEAD; falha Mobile não é dispensada por falta de relação.

Onda A só conclui com M01/M03/M05/M09 integradas e comprovadas, não com A1 puro.
Próxima ação: integrar entradas autorizadas PA06 com projeções factuais e contexto,
sem habilitar referências com direitos pendentes. Provar autorização/RLS/concorrência
no incremento integrado; manter #455 e #456 delimitadas.
