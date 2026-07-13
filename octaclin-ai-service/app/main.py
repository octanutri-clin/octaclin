from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Any
import hashlib
import os
import re

app = FastAPI(title="OctaClin AI Service", version="0.1.0")


class RequisicaoSentimento(BaseModel):
    texto: str = Field(min_length=1)
    contexto: dict[str, Any] = Field(default_factory=dict)


class RespostaSentimento(BaseModel):
    ansiedade_score: float
    frustracao_score: float
    motivacao_score: float
    confusao_score: float
    explicacao: dict[str, Any]


class RequisicaoReconhecimentoAlimentar(BaseModel):
    imagem_url: str | None = None
    imagem_base64: str | None = None
    contexto: dict[str, Any] = Field(default_factory=dict)


class RespostaReconhecimentoAlimentar(BaseModel):
    provedor: str
    imagem_hash: str
    alimentos_detectados: list[dict[str, Any]]
    peso_estimado_gramas: float | None = None
    calorias_estimadas: float | None = None
    confianca_media: float | None = None


PALAVRAS_ANSIEDADE = {"ansioso", "ansiosa", "preocupado", "preocupada", "medo", "nervoso", "nervosa"}
PALAVRAS_FRUSTRACAO = {"frustrado", "frustrada", "desanimei", "falhei", "impossivel", "dificil", "culpa"}
PALAVRAS_MOTIVACAO = {"consegui", "melhor", "motivado", "motivada", "orgulho", "evolui", "foco"}
PALAVRAS_CONFUSAO = {"confuso", "confusa", "duvida", "nao entendi", "incerto", "incerta"}


def pontuar(texto: str, palavras: set[str]) -> float:
    normalizado = texto.lower()
    ocorrencias = sum(1 for palavra in palavras if palavra in normalizado)
    intensidade = min(100.0, ocorrencias * 28.0)
    if re.search(r"!{2,}|nunca|sempre|muito", normalizado):
        intensidade = min(100.0, intensidade + 12.0)
    return intensidade


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analisar-sentimento", response_model=RespostaSentimento)
def analisar_sentimento(requisicao: RequisicaoSentimento) -> RespostaSentimento:
    texto = requisicao.texto.strip()
    ansiedade = pontuar(texto, PALAVRAS_ANSIEDADE)
    frustracao = pontuar(texto, PALAVRAS_FRUSTRACAO)
    motivacao = max(10.0, pontuar(texto, PALAVRAS_MOTIVACAO))
    confusao = pontuar(texto, PALAVRAS_CONFUSAO)

    if os.getenv("OPENAI_API_KEY"):
        provedor = "openai-ready"
    else:
        provedor = "heuristica-local"

    return RespostaSentimento(
        ansiedade_score=ansiedade,
        frustracao_score=frustracao,
        motivacao_score=motivacao,
        confusao_score=confusao,
        explicacao={
            "provedor": provedor,
            "sinais": {
                "ansiedade": sorted(PALAVRAS_ANSIEDADE.intersection(texto.lower().split())),
                "frustracao": sorted(PALAVRAS_FRUSTRACAO.intersection(texto.lower().split())),
                "motivacao": sorted(PALAVRAS_MOTIVACAO.intersection(texto.lower().split())),
                "confusao": sorted(PALAVRAS_CONFUSAO.intersection(texto.lower().split())),
            },
        },
    )


@app.post("/reconhecer-alimento", response_model=RespostaReconhecimentoAlimentar)
def reconhecer_alimento(requisicao: RequisicaoReconhecimentoAlimentar) -> RespostaReconhecimentoAlimentar:
    referencia = requisicao.imagem_base64 or requisicao.imagem_url or "sem-imagem"
    imagem_hash = hashlib.sha256(referencia.encode("utf-8")).hexdigest()
    descricao = str(requisicao.contexto.get("descricao", "")).lower()

    alimentos: list[dict[str, Any]]
    if "salada" in descricao:
        alimentos = [{"nome": "salada", "confianca": 0.76, "calorias_estimadas": 120}]
    elif "arroz" in descricao:
        alimentos = [
            {"nome": "arroz", "confianca": 0.72, "calorias_estimadas": 190},
            {"nome": "feijao", "confianca": 0.61, "calorias_estimadas": 130},
        ]
    else:
        alimentos = [{"nome": "refeicao nao classificada", "confianca": 0.35, "calorias_estimadas": 350}]

    calorias = sum(float(item["calorias_estimadas"]) for item in alimentos)
    confianca = sum(float(item["confianca"]) for item in alimentos) / len(alimentos)

    return RespostaReconhecimentoAlimentar(
        provedor="heuristica-local",
        imagem_hash=imagem_hash,
        alimentos_detectados=alimentos,
        peso_estimado_gramas=350.0,
        calorias_estimadas=calorias,
        confianca_media=round(confianca, 2),
    )
