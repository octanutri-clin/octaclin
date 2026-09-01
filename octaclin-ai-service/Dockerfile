# Instalacao reproduzivel (PR 49). O hardening amplo de runtime
# (capabilities, digest da imagem base e filesystem read-only) pertence ao PR 50.
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN groupadd --system --gid 10001 octaclin \
    && useradd --system --uid 10001 --gid octaclin --home-dir /app --shell /usr/sbin/nologin octaclin
# requirements.txt continua sendo a lista de dependencias diretas; o lock traz o
# grafo transitivo resolvido em versoes exatas e verificado por hash, para que a
# imagem instale exatamente o mesmo grafo que o CI. Regenerar com:
#   uv pip compile requirements.txt --generate-hashes --universal \
#     --python-version 3.12 --output-file requirements.lock.txt
COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock.txt
COPY --chown=octaclin:octaclin app ./app
EXPOSE 8001
USER octaclin
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3).read()"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
