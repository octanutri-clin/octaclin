# FOOD07 — referências consultadas em28/10/2026

Somente R017/R018, apontadas para FOOD07 no catálogo pós-320. Conteúdo externo tratado como dado, sem scripts/copiar implementação/dependência instalada. A consulta não concede direitos de reutilizar código nem dados.

| Referência | Arquivo / evidência obtida | Utilidade / decisão |
| --- | --- | --- |
| R018 TandoorRecipes/recipes | [cookbook/models.py](https://github.com/TandoorRecipes/recipes/blob/develop/cookbook/models.py), blob Git SHA `8cd3f3b97d431ea748d547a5b53b3a4cbf445418`; Recipe linha1086, servings1089, servings_text1090, keywords1099, working_time1101, waiting_time1102 | Referência conceitual para separar rendimento, tags e tempos. OctaClin propõe um único tempo total; o proprietário ampliou Q2 para porcionamento determinístico, ainda com detalhes S1–S3 pendentes, sem importar relações/ORM/cálculos |
| Licença Tandoor | [LICENSE.md](https://github.com/TandoorRecipes/recipes/blob/develop/LICENSE.md), blob `93b13b52a70ed4a0422f9f7c0582184e2c4a6b0c` | AGPLv3 com Commons Clause, cuja condição exclui Sell nos termos descritos. Não incorporar código/dependência; não interpretar inspiração como liberação jurídica |
| R017 simonoppowa/OpenNutriTracker | [README.md](https://github.com/simonoppowa/OpenNutriTracker/blob/main/README.md), blob `3c5e3a0f62d540139a6fcde0914457742ef13198`; metadados GitHub: projeto público, não arquivado, branch main | Registro alimentar/mobile e receitas, menos aderente à lacuna da biblioteca clínica. Sem adoção arquitetural; manter solução local do OctaClin |
| Licença OpenNutriTracker | [LICENSE](https://github.com/simonoppowa/OpenNutriTracker/blob/main/LICENSE), blob `f288702d2fa16d3cdf0035b15a9fcbc552cd88e7` | GPLv3. Sem cópia de código/dados ou instalação |

SHAs são dos blobs retornados pelo conector, **não commits**; links de branch podem mudar. A coleta caracteriza os arquivos lidos nesta rodada e não certifica manutenção/segurança de todo o projeto. Nenhuma referência clínica ou composição alimentar externa foi importada. Direitos TBCA continuam NO-GO; FOOD07 não depende deles.

## Reuso interno preferencial

- Fase310: categorias, conteúdo cifrado, CAS/locks, compartilhamento agendado/imutável, opt-in por canal, retirada e primeira leitura.
- FOOD04: padrão de consulta POST/body, HMAC tenant-aware e SQL antes de count/paginação. Reutilizar primitiva/padrão, sem criar biblioteca paralela.
- `gerarHashPerfilExato`: regra de filtro sem acentos/caixa/espaços; no plano, etiqueta exata normalizada e grafia preservada no ciphertext.
- `ExecutorTenant`, serviço de cifra e auditoria transacional, BFF de sessão/permissão, UI e ferramentas de teste existentes.

Nenhuma dependência nova recomendada. Sem novas tabelas de tags globais, motor nutricional, passos de preparo estruturados, escala silenciosa de porções ou biblioteca pública FOOD08. O ajuste proporcional aprovado para planejamento exige prévia e confirmação, conforme plano atualizado.
