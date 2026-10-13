# Harness sintético318

`python3 scripts/research/fase318/avaliar-sinteticos.py` reproduz o relatório
sem rede e calcula SHA256 do corpus/rubrica. `--candidato arquivo.json` aceita
saídas por C01–C30 para conferência estrutural offline, sem enviar segredos.
`python3 -m unittest discover -s scripts/research/fase318` testa o harness.

REV1 é uma proposta técnica; a equipe ainda deve revisar/ratificar a rubrica e
especificar fatos obrigatórios/proibidos por caso antes de ensaio clínico.
Fontes dos casos de pipeline são descrições do cenário, não requisições válidas
para o fornecedor. Esses casos são cobertos pelos testes backend/BFF/UI.
A composição literal não é benchmark de IA nem oráculo clínico. A comparação
com preparação atual e modelo real, tempos/custos e qualidade humana permanecem
pendentes; o relatório não libera G01. Mudanças de critérios geram nova versão.
