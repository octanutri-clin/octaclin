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

O servico atual usa somente heuristicas locais: nao chama provider externo, nao
possui ferramentas e nao executa acao clinica. Entradas e saidas usam schemas
fechados e toda sugestao declara `revisao_humana_obrigatoria=true`.

O backend envia somente o texto necessario para sentimento ou, no
reconhecimento alimentar, o hash validado e uma observacao opcional. URL
assinada e bytes da imagem nao atravessam esta fronteira. O reconhecimento
atual, portanto, e uma heuristica baseada na observacao, nao visao computacional.

Adicionar provider real, ferramentas ou processamento de imagem exige novo
threat model, base legal, minimizacao, testes adversariais e autorizacao
explicita. Ate la, essa integracao permanece proibida.
