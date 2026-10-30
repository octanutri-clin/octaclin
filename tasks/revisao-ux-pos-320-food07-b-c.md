# FOOD07 — revisão UX das etapas B e C

Data: 29/10/2026. Avaliações feitas por dois subagentes independentes com os papéis versionados/pinados na PR #451 (`0d3382b6`), sobre screenshots e testes sintéticos. Nenhum profissional ou paciente real participou; isto não é validação clínica nem pesquisa com usuários.

## Evidência observada

- Console profissional e portal paciente em screenshots Playwright de `/tmp/food07-stage-b/`, com fixture sintética; portal também reavaliado pós-correção em `/tmp/food07-stage-c-paciente-mobile.png`.
- Spec verificável: `octaclin-web/tests/visual/food07-metadados-receitas.spec.mjs`.
- FOOD07: 13/13 desktop e 13/13 mobile PASS, incluindo origem Jantar distinta do destino Lanche, bases, mudança com confirmação, cancelamento, prévia/revalidação, 1,5/2,5 porções, lote/paginação, instruções, portal e Axe nos alvos da spec.
- PA07: 5 cenários relevantes (segunda aba, transferência, cópia, encerramento de posse, revogação) × desktop/mobile = 10/10 PASS.
- R4 T06 independente: nenhum achado material estático; reviewer não executou testes. R4 integral FOOD07 continua pendente.

## Avaliação do nutricionista — simulação

**Pontos positivos:** fluxo de aplicação distingue origem e destino; a confirmação resume versão, quantidade, base, destino, ingredientes ajustados e valores nutricionais; dados ausentes permanecem como indisponíveis. Lote preserva seleção entre páginas e permite identificar os registros.

| ID | Cenário / evidência | Tipo e impacto | Prioridade | Sugestão e aceite verificável | Estado |
|---|---|---|---|---|---|
| NUXB-01 | Procurar receita durante consulta; a seção vem após outros blocos do plano nas screenshots | Hipótese de fricção/produtividade | P2 | Avaliar atalho que leve à seção sem perder rascunho; verificar chegada em um passo em desktop/mobile | BACKLOG |
| NUXB-02 | Agendar envio; placeholder nativo `mm/dd/yyyy` na captura | Risco de interpretação do formato | P2 | Exibir e revisar data pt-BR e hora 24h; teste deve confirmar valor sem ambiguidade | BACKLOG |
| NUXB-03 | Cadastro com origem/destino diferentes; teste final confirma seleção própria de Jantar e destino Lanche | Sem erro funcional observado na UI/rota simulada | P3 | Teste com profissional real poderia avaliar compreensão; não exigido para este merge | BACKLOG |

## Avaliação do paciente — simulação

**Pontos positivos:** quantidade recebida é declarada (1,5 porções), rendimento original aparece secundariamente e instruções mostram pesos ajustados. Formatação pt-BR e associação texto/quantidade estão cobertas por casos da spec.

| ID | Cenário / evidência | Tipo e impacto | Prioridade | Sugestão e aceite verificável | Estado |
|---|---|---|---|---|---|
| PUXB-01 | Ler receita em viewport 320px e texto 200%; os rótulos do menu fixo ultrapassavam as células (RED) | Defeito visual reproduzido, não problema de dados ou autorização | P1 antes do fix | Restringir o item/label à sua célula; nenhum retângulo de rótulo sai da célula no teste 320px/200% | CORRIGIDO; GREEN desktop/mobile |
| PUXB-02 | Após o fix, rótulos ficam truncados como “I…”/“A…” quando texto é ampliado; nomes semânticos continuam no texto acessível | Limitação visual observada; compreensão não testada | P2 | Validar destinos com participantes ou protótipo de navegação compacta; critérios humanos devem confirmar reconhecimento sem ajuda | BACKLOG; não bloqueia por ausência de evidência de falha |
| PUXB-03 | Navegação fixa ocupa a borda inferior na captura enquanto se lê o cartão | Risco plausível validado: quantity row pode ser posicionada acima da barra | Sem bloqueio após prova | Playwright traz “1,5 medida (187,5 g)” ao viewport e confirma rect.bottom ≤ nav.top em desktop/mobile a 320px/200% | RESOLVIDO para a linha testada; demais conteúdos usam rolagem normal |
| PUXB-04 | Títulos e corpo do cartão em 320px; teste do container não detectou overflow horizontal | Suspeita visual da primeira captura, não reproduzida como overflow na spec | sem prioridade de defeito | Continuar teste de reflow; manter nomes/números/unidades associados | JÁ COBERTO no teste de largura |

## Consolidação

A implementação corrigiu a sobreposição concreta do menu no viewport ampliado. A linha de quantidade consegue ser lida acima da barra fixa após rolagem. O menu ainda abrevia texto quando o usuário aumenta fonte, mas o cenário não demonstrou que os destinos sejam incompreensíveis; fica como P2 para melhoria futura. Atalho da seção de receitas e formato nativo de agendamento pt-BR também ficam em backlog para não ampliar escopo aprovado. Não houve validação de tecnologia assistiva fora do Axe Playwright, nem testes com pessoas reais.
