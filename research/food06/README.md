# FOOD06 — coleta documental reproduzível

Utilitário Python 3, somente biblioteca padrão, para obter metadados, hashes e
datas das fontes oficiais candidatas. Não contém classificador, tabelas de
valores clínicos, dados de pacientes ou dependências novas do produto.

```sh
python -m unittest discover -s research/food06 -p 'test_*.py' -v
python research/food06/coletar_fontes.py --saida /tmp/manifesto-food06.json
```

Execute da raiz. O segundo comando faz GET público de cinco URLs fixas e salva
somente o manifesto no caminho informado. Não usa credenciais; não lê `.env` nem
consulta Neon/Render. Falha de rede, recurso inesperado, tamanho excessivo ou HTML
sem conteúdo principal interrompem a coleta; não grava manifesto parcial.

`sha256Bytes` permite identificar os bytes obtidos. `sha256TextoPrincipal`
normaliza espaços e exclui script/style fora do conteúdo; não é um hash de tabela
normalizada ou prova de equivalência clínica. Mudanças de números/notas ainda
precisam de investigação. A data da página e a data de metadados não são versões
científicas de cada nutriente.

O manifesto versionado é evidência da execução de 2026-10-30. O HTML completo
foi lido temporariamente e não é distribuído com o produto. A licença do recurso
foi identificada como OGL-Canada; direitos de terceiros e alcance às páginas
atuais permanecem em conferência. O script nunca concede aprovação de uso.

Oito testes usam HTML/JSON sintéticos ou falha de rede simulada. Resultado desta
rodada: PASS 8/8. São testes do coletor, não RED/GREEN de domínio clínico nem
validação científica independente. Nenhuma comparação clínica é ativada.
