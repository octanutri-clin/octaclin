# FOOD06 — matriz obrigatória de aceite

Escopo M01–M12 aprovado integralmente em 2026-10-31. Esta matriz não atribui
conclusão funcional a uma aprovação de produto ou a testes apenas do núcleo.
Fontes: [especificação](especificacao-pos-320-food06-melhorias.md),
[Onda A](onda-a-pos-320-food06.md), [execução](execucao-pos-320-food06.md).

| ID obrigatório | Comportamento/contrato | Evidência de aceite exigida | Estado observado nesta auditoria |
| --- | --- | --- | --- |
| M01-C1 | Zero conhecido ≠ ausência; cobertura por nutriente, não por alimento global | RED/GREEN: dois alimentos, ferro zero+ausente e cálcio completo | PASS domínio A1: zero/ausência por nutriente; integração/interface/exportação pendentes |
| M01-C2 | Completo/parcial/desconhecido/incompatível/indisponível com motivos/fontes | Mistura de unidade/forma/schema/fonte/erro; soma apenas compatíveis; nenhuma confiança científica percentual | PARCIAL A1: cinco estados/causas/contagens; resolução autorizada de fontes pendente |
| M01-C3 | Subtotal parcial explícito, sem percentual de referência; mesmos dados nas saídas | Backend/BFF/tabela/exportação e fonte legada; total desconhecido não vira zero | PARCIAL: serviço/BFF/RLS factuais comprovados em80763589; CI global, tabela e exportação pendentes |
| M02-C1 | Total→refeição→alimento, quantidade/preparo/fonte e cobertura | Soma hierárquica reconcilia com PA06, receita1,5porções, conhecido zero/ausente | PENDENTE |
| M02-C2 | Denominador completo/positivo, sem dupla contagem | Alternativa escolhida exclui principal; disponíveis não contam; alimento repetido em refeições legítimas conta ambas | PENDENTE |
| M02-C3 | Ordenação/expansão/atalho autorizado | Testes componente/Playwright, leitura/editável e acesso negado ao destino | PENDENTE |
| M03-C1 | Motivos clínicos/técnicos/contratuais estruturados, backend autoritativo | Contratos negativos por motivo, texto seguro e ação válida quando existir | PARCIAL A1: 11 motivos com texto/ação; causas de cobertura e serviço pendentes |
| M03-C2 | Tabela/detalhes/relatório concordam, sem dados nos logs | Canários sintéticos em logs/erros/projeções e mesma revisão | PENDENTE |
| M04-C1 | Prévia antes/depois, percentuais válidos, cobertura/eligibilidade | Troca alimento/porção/preparo/receita; principal e alternativa não somados; zero no denominador sem percentual | PENDENTE |
| M04-C2 | Sem gravação; confirmação CAS e rollback | PostgreSQL descartável: revisão stale, duas abas/PA07, perda de acesso, idempotência/replay, falha intermediária | PENDENTE |
| M05-C1 | Fonte/autoridade/documento/versão/ID/unidade/população/regras | Registro server-side imutável e manifesto com direitos/atribuição | PARCIAL: IDs de referência no núcleo; direitos BLOCKED |
| M05-C2 | Reproduzir análise original sem atualização silenciosa | Atualização de tabela, mesma análise anterior, nova análise versionada, snapshots cifrados | PENDENTE persistência |
| M06-C1 | Colunas, todos filtros aprovados e ordenação determinística | Tabela de verdade abaixo/acima/igual, completo/parcial, ausência/UL incompatível; decisão antes do arredondamento | PENDENTE |
| M06-C2 | Texto/filtros ativos/limpar, sem ranking clínico ou cor única | Componentes e Playwright desktop/mobile, teclado, leitor, zoom; ausente não ordena como zero | PENDENTE |
| M07-C1 | Duas versões autorizadas com contexto e deltas válidos | Versões publicadas/rascunho com revisão exata; paciente/tenant adversário negados | PENDENTE |
| M07-C2 | Distinguir dieta/fonte/ref/contexto/cobertura | Cada causa isolada e combinada; causa incerta declarada; referência comum só se aplicável a ambos | PENDENTE |
| M08-C1 | PDF fiel à análise autorizada e minimizada | Mesmos números/revisões/contexto/fontes; teste autorização/revogação/PII canário | PENDENTE |
| M08-C2 | Arquivo seguro, sem publicação/entrega automática | Sem URL/objeto público/cache persistente; política retenção/descarte; cancelamento/erro | PENDENTE |
| M08-C3 | Artefato PDF legível e acessível | PDF real: texto selecionável, ordem/cabeçalhos/limites próximos, celular e tecnologia assistiva | PENDENTE; HTML acessível não comprova PDF |
| M09-C1 | Explicar RDA/AI/UL, planejado/consumido, parcial e limitações | Conteúdo próprio revisado, fonte identificável, sem diagnóstico ou recomendação de suplemento | PARCIAL A1: catálogo estático e testes; revisão de redação/interface pendentes |
| M09-C2 | Explicações curtas e detalhes acessíveis | Texto perto do dado, expansão teclado/leitor; zero e desconhecido distinguíveis | PENDENTE |
| M10-C1 | Histórico paginado e pontos reproduzíveis | Data/plano/revisão/nutriente/cobertura/ref e autorização atual/carteira | PENDENTE |
| M10-C2 | Gráfico e tabela equivalentes, sem interpolação indevida | Lacunas, parcial, mudança de fonte/ref/contexto, não ligar bases incompatíveis ou inferir melhora clínica | PENDENTE |
| M11-C1 | Catálogo autorizado por porção/preparo/teor conhecido | Fonte ativa/autorizada, unidade/base clara, ausência fora do ranking sem virar zero | PENDENTE |
| M11-C2 | Restrições confiáveis e mínimas, sem alegar compatibilidade por omissão | Contrato validado por IDs, negativos de alergia/restrição e acesso; nenhuma inferência de texto livre | BLOCKED no caminho individualizado até contrato comprovado |
| M11-C3 | Prévia/confirmação e dependência FOOD05 protegida | Sem tratamento/absorção/suplementação automática; capacidade ausente não chama implementação paralela | PENDENTE |
| M12-C1 | Cenários temporários claros e determinísticos | Original/troca, receita/porção, refeições/dia, macros/micros/cobertura/ref/deltas | PENDENTE |
| M12-C2 | Não persistir/publicar nem somar alternativas excludentes | Cancelar, sair/trocar paciente, resposta tardia, fontes indisponíveis, memória sem armazenamento persistente | PENDENTE |
| M12-C3 | Confirmar fonte/contexto/revisão/fingerprint atuais | CAS/PA07, reaplicação/replay, acesso revogado, rollback e publicação intacta | PENDENTE |

## Gates transversais

- Contexto puro A2: datas/19anos/confirmações implementados; obtenção autorizada,
  fontes/referências e integração ainda PENDENTES. Ver execução/contexto.
- CL01–CL08: PASS de ratificação humana da ficha/quadro de `cb8a9c47`, não de software.
- Direitos: BLOCKED; nenhum aceite das melhorias concede direitos ou licença nova.
- Núcleo T03-A: testes locais e re-revisão estática favoráveis nos limites registrados.
- CI `eeb552fa`: 20 success, Mobile Expo e PR Gate FAIL; SBOM provenance SKIPPED.
  CI `0ec4cd31`: na consulta seguinte, Mobile FAIL e Web em execução. Não atribuir PASS global. Falha não
  autoriza mudar severidade, exceção ou dependências em FOOD06 por conveniência.
- PostgreSQL/RLS, exportação, migração local nova, BFF e UI: NOT RUN para M01–M12.
- UX A: avaliações por instâncias separadas; sugestões são hipóteses, não testes
  reais ou nova autorização clínica. UX B/C e R4 integral: PENDENTES.
- G06 externo BLOCKED, FOOD05-MDL fora do escopo, sem merge/deploy/migration externa.

Cada linha só pode virar PASS com teste/evidência do commit correspondente.
Backlog de refinamentos não retira nenhuma linha obrigatória desta matriz.
