# PR 50 — Containers e runtime.
#
# Base fixada por digest imutavel (indice OCI multi-arch linux/amd64+arm64),
# resolvido em 2026-09-01 no Docker Hub oficial (library/python:3.12-slim). A tag
# humana permanece para legibilidade; o digest e a ancora real. Atualizacao do
# digest segue o processo em docs/governance/RELATORIO_SEGURANCA_PR50_2026-09-01.md.
#
# requirements.txt continua sendo a lista de dependencias diretas; o lock traz o
# grafo transitivo resolvido em versoes exatas e verificado por hash. Regenerar:
#   uv pip compile requirements.txt --generate-hashes --universal \
#     --python-version 3.12 --output-file requirements.lock.txt
FROM python:3.12-slim@sha256:e5c9fa26ffb76e11e0f054f30dc2523a2f9693f0c36c0cf1e39b27e152d899fc AS build
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY requirements.txt requirements.lock.txt ./
# Instala o grafo travado num prefixo isolado que o estagio final recebe pronto.
# Assim o runtime nao executa pip: sem gerenciador de pacotes no estagio final.
RUN pip install --no-cache-dir --require-hashes --prefix=/install -r requirements.lock.txt

FROM python:3.12-slim@sha256:e5c9fa26ffb76e11e0f054f30dc2523a2f9693f0c36c0cf1e39b27e152d899fc AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN groupadd --system --gid 10001 octaclin \
    && useradd --system --uid 10001 --gid octaclin --home-dir /app --shell /usr/sbin/nologin octaclin
COPY --from=build /install /usr/local
COPY --chown=octaclin:octaclin app ./app
EXPOSE 8001
USER octaclin
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3).read()"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
