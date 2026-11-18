# Brief sintético — FOOD06 P3-1, etapas B e C

Primeira tela utilizável (B) e pré-conclusão da PR (C) da leitura do portal de restrições. Base: branch `claude/vigilant-rubin-p6gmql`,
HEAD `3fd6d14` com o ajuste de foco (`4870398`). Dados sintéticos; BFF simulado; flag desligada.

Evidência fornecida às personas (só texto, sem imagem): o texto renderizado no celular (Pixel 5) da conta própria, na ordem da tela,
e a árvore acessível resumida (região "Restrições alimentares" > título nível 2 > regiões por grupo com título nível 3 e lista); o
seletor de uma conta que acompanha três pessoas e os textos com o nome da pessoa; os estados cobertos pelo spec automatizado (área
desligada, vazio, falha com nova tentativa, mais de 200 itens, sem acesso, setas do teclado, troca rápida de pessoa, 320 px, axe
WCAG 2.0–2.2 AA). Informado como limite: sem botão de informar nem de pedir correção nesta PR; sem leitor de tela real nem pessoas.
A persona nutricionista recebeu a mesma tela descrita do ponto de vista do que o paciente lê.
Capturas usadas pelo coordenador (não versionadas): `1-propria.png` e `3-representante.png`, geradas pelo Playwright com a
fixture `tests/visual/fixtures/food06-restricoes-portal.mjs`.
