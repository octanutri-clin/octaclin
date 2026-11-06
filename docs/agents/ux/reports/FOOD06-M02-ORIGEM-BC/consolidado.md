# FOOD06 M02 — fonte, ordenação e origem: UX B/C delimitada

Base de código36223bcd, delta descrito na [execução](../../../../../tasks/food06-m02-origem-ordenacao.md).
Papéis explícitos da #451/0d3382b6, duas instâncias distintas sem ferramentas,
edição, rede, outros pareceres ou dados reais. Seleção nativa TOML não comprovada.
Personas receberam brief sanitizado dos textos/comportamentos da interface e das
provas do coordenador; não viram screenshots nem operaram browser. Avaliações
simuladas não são validação com profissionais/pacientes reais, clínica ou R4.

## Nutricionista — `/root/food06_m02_origem_nux`

Positivos: consulta sob demanda reduz informação inicial; plano/refeição mantém
contexto; peso salvo, preparo e fonte próximos do alimento; original exato
somente leitura, Escape e retorno de foco preservam a consulta e o rascunho.
Considerou os perfis iniciante/experiente, autônomo/equipe sem presumir uniformidade.
São avaliações do desenho relatado, sem cliques/tempo medidos ou teste próprio.

| ID | Cenário/objetivo e hipótese | Impacto | Sugestão / aceite | Prioridade | Decisão do coordenador |
| --- | --- | --- | --- | --- | --- |
| NUX-01 | Revisar1,5porção e100g; pode haver dúvida se peso é total | Multiplicação repetida indevida ou conferência extra | Avaliar “Peso total considerado”; usuário explica relação sem multiplicar novamente | P2 | AVALIAR/BACKLOG de compreensão: texto vigente já informa peso considerado. Sem novo cálculo nem decisão clínica adotada |
| NUX-02 | Identificar maior contribuição entre várias refeições; alcance da ordem pode confundir | Interpretar ordem como restrita à refeição | Dizer “na seleção inteira” e provar com valores distintos; usuário entende desconhecido≠zero | P2 | JÁ COBERTO: seletor/caveat explícitos, lista global por posição; domínio testa9,8,7 em refeições intercaladas. Browser zero só prova apresentação, não matemática |
| NUX-03 | Consultar publicação com rascunho diferente; pode ignorar texto introdutório | Confundir original e edição atual | Avaliar marcador “Somente consulta”; usuário distingue os dois estados | P3 | JÁ COBERTO na descrição e versão explícitas; marcador adicional BACKLOG, não gate clínico |

Nenhum P0/P1 ou defeito comprovado pela persona. Oportunidade de produtividade:
conferir o dado perto do alimento sem sair do editor. Sugestões não ampliam o
escopo automaticamente; não foi fabricado consenso entre personas.

## Paciente — `/root/food06_m02_origem_pux`

Jornada direta **N/A**: console profissional, sem relatório/envio/tela no portal.
Considerou separadamente familiaridade tecnológica e necessidades de acessibilidade;
não inventou exposição no portal para justificar avaliação. Clareza de planejado,
origem publicada e zero/desconhecido pode beneficiar comunicação indiretamente.

| ID | Cenário / hipótese indireta | Impacto | Sugestão / aceite | Prioridade | Decisão |
| --- | --- | --- | --- | --- | --- |
| PUX-01 | Paciente recebe explicação verbal e pode entender planejamento como consumo | Expectativa incorreta sobre registro alimentar | Preservar indicação de planejado; não afirmar ingestão real | P3 | JÁ COBERTO pelas ressalvas existentes; sem novo portal |
| PUX-02 | Paciente recebe explicação verbal da ordenação e pode inferir qualidade ou ausência=zero | Conclusão não sustentada pelos dados | Explicar contribuição conhecida e desconhecidos; não chamar ranking clínico | P3 | JÁ COBERTO por texto e cobertura; não pedir ao paciente recalcular prescrição |

Sem navegação direta do paciente ou teste AT humano. Ambos os pareceres se
basearam nas duas provas Playwright iniciais desktop/mobile relatadas; a matriz
posterior e os screenshots são evidência do coordenador, não execução própria.
