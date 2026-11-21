# Brief — QST01, etapa A

Base `60bbe01f944d3c14a3dd30210bb4843b4187e356`, observada em 21/11/2026.
Usuário autorizou preparar pequenas melhorias profissionais paralelas à FOOD06,
sem FOOD08. Somente planejamento; nenhuma interface foi executada.

Evidência sanitizada: `area-respostas.tsx:146–169` lista envios por `respostaId`,
com resumo paciente/finalização/contagem e `dl` contendo todas as perguntas/valores.
Há filtros de paciente, questionário e busca; não há accordion nesse trecho.

Proposta: inicialmente aberto; controle por envio e Expandir/Recolher tudo nos
resultados exibidos; cabeçalho preservado; busca inclui conteúdo recolhido; estado
em memória reiniciado ao mudar paciente/questionário; teclado/foco e estados
acessíveis; sem novos requests, persistência, permissões ou mudança de conteúdo.

Cenário sintético: profissional consulta dois envios fictícios, recolhe um,
pesquisa termo existente apenas no conteúdo recolhido, expande para conferir e
troca de contexto. Nenhum dado real foi fornecido.

Paciente N/A: portal, preenchimento, envios, relatórios e conteúdo não mudam.
Sugestões novas não autorizam mudanças automáticas de produto.
