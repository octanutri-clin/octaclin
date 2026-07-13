# OctaClin AI Service

Microservico FastAPI da Fase 4 para processamento isolado de IA.

## Rodar localmente

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Endpoints

- `GET /health`
- `POST /analisar-sentimento`
- `POST /reconhecer-alimento`

Por padrao, usa heuristicas locais para desenvolvimento. Em producao, `OPENAI_API_KEY` e credenciais de visao computacional devem habilitar provedores reais sem alterar o contrato HTTP consumido pelo backend.
