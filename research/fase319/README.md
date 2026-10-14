# Laboratório sintético — Fase 319

Esta pasta é uma PoC offline, não integrada ao produto. Contém somente textos,
IDs e pacientes artificiais. Não use ou substitua registros reais neste corpus.

## Reproduzir

1. Use Python 3.12; crie ambiente virtual fora da aplicação.
2. Instale em ambiente descartável com `pip install -r requirements-lab-lock.txt`.
3. Rode `python fetch_models.py`; valide os SHA-256 LFS e mantenha pesos fora
   do Git e da aplicação.
4. Rode `python build_corpus.py` e confirme o hash congelado em `protocolo.json` antes de ler os
   resultados; qualquer mudança exige nova versão do protocolo.
5. Rode `python -m unittest discover -s tests -v`, `run_benchmark.py` e
   `run_scale.py` em CPU.

Os hashes LFS só ficam confirmados quando a PoC os confere. Os cartões públicos
declaram MIT e Apache-2.0; ambos os arquivos `LICENSE` consultados retornaram
404. A avaliação sintética não constitui parecer de direitos nem autoriza uso
comercial, incorporação ao runtime ou processamento de prontuário real.

Os oráculos apontam para as fontes que foram escritas especificamente para cada
consulta. Ainda não houve revisão independente/humana dos rótulos. Relatório de
qualidade é exploratório e não estabelece validade clínica. O ensaio humano,
aprovação de direitos e decisão de valor permanecem pendentes.

## Rodada corrigida v4

V3, seu hash e seus resultados são históricos e permanecem sem alteração. A
rodada v4 fica isolada em `v4/`, com corpus/protocolo próprios e thresholds
copiados sem mudança. Reproduza a integridade e o benchmark com:

```sh
/tmp/f319-venv/bin/python -m unittest discover -s research/fase319/v4/tests -v
taskset -c 0 /tmp/f319-venv/bin/python research/fase319/v4/run_benchmark.py
```

Os modelos devem estar em `/tmp/f319-models` e conferir com os hashes do
manifesto. O parecer recebido que motivou as correções foi arquivado em
`docs/history/phases/reviews/fase-319/AUDITORIA_30_CASOS_POC_FASE_319.md` e o
relatório dos resultados está em `docs/history/phases/reviews/fase-319/RELATORIO_POC_SINTETICA_V4.md`.
V4 não implementa abstinência; o critério de segurança para consultas sem
resposta permanece não demonstrado.
