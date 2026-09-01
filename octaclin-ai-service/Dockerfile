# Instalacao reproduzivel (PR 49). O hardening de runtime do container
# (non-root, capabilities, digest da imagem base, healthcheck) pertence ao PR 50.
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# requirements.txt continua sendo a lista de dependencias diretas; o lock traz o
# grafo transitivo resolvido em versoes exatas e verificado por hash, para que a
# imagem instale exatamente o mesmo grafo que o CI. Regenerar com:
#   uv pip compile requirements.txt --generate-hashes --universal \
#     --python-version 3.12 --output-file requirements.lock.txt
COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock.txt
COPY app ./app
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
