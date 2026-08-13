# OctaClin AI Service

Microservico FastAPI da Fase 4 para processamento isolado de IA.

## Rodar localmente

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Defina `IA_SERVICE_TOKEN` com um segredo aleatorio de pelo menos 32 caracteres
e configure exatamente o mesmo valor no backend. Os endpoints `POST` falham
fechados sem esse segredo e exigem `Authorization: Bearer`; somente `/health`
permanece publico.

## Endpoints

- `GET /health`
- `POST /analisar-sentimento`
- `POST /reconhecer-alimento`

Por padrao, usa heuristicas locais para desenvolvimento. Em producao, provedores
reais devem preservar o contrato, a revisao humana e o hash de integridade
recebido do backend. O navegador nunca envia URL privada ou hash diretamente ao
microservico.
