from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import AnyHttpUrl, BaseModel, Field
from typing import Any
import hmac
import os
import re

app = FastAPI(title="OctaClin AI Service", version="0.1.0")


class RequisicaoSentimento(BaseModel):
    texto: str = Field(min_length=1, max_length=5000)
    contexto: dict[str, Any] = Field(default_factory=dict)


class RespostaSentimento(BaseModel):
    ansiedade_score: float
    frustracao_score: float
    motivacao_score: float
    confusao_score: float
    explicacao: dict[str, Any]


class RequisicaoReconhecimentoAlimentar(BaseModel):
    imagem_url: AnyHttpUrl
    imagem_hash: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    contexto: dict[str, Any] = Field(default_factory=dict)


class RespostaReconhecimentoAlimentar(BaseModel):
    provedor: str
    imagem_hash: str
    alimentos_detectados: list[dict[str, Any]]
    peso_estimado_gramas: float | None = None
    calorias_estimadas: float | None = None
    confianca_media: float | None = None
    limitacoes: list[str]


PALAVRAS_ANSIEDADE = {"ansioso", "ansiosa", "preocupado", "preocupada", "medo", "nervoso", "nervosa"}
PALAVRAS_FRUSTRACAO = {"frustrado", "frustrada", "desanimei", "falhei", "impossivel", "dificil", "culpa"}
PALAVRAS_MOTIVACAO = {"consegui", "melhor", "motivado", "motivada", "orgulho", "evolui", "foco"}
PALAVRAS_CONFUSAO = {"confuso", "confusa", "duvida", "nao entendi", "incerto", "incerta"}


def autenticar_servico(authorization: str | None = Header(default=None)) -> None:
    token_esperado = os.environ.get("IA_SERVICE_TOKEN", "").strip()
    if len(token_esperado) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servico de IA nao configurado.",
        )
    esquema, _, token_recebido = (authorization or "").partition(" ")
    if esquema.lower() != "bearer" or not hmac.compare_digest(token_recebido, token_esperado):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencial de servico invalida.",
        )


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
def analisar_sentimento(
    requisicao: RequisicaoSentimento,
    _: None = Depends(autenticar_servico),
) -> RespostaSentimento:
    texto = requisicao.texto.strip()
    ansiedade = pontuar(texto, PALAVRAS_ANSIEDADE)
    frustracao = pontuar(texto, PALAVRAS_FRUSTRACAO)
    motivacao = max(10.0, pontuar(texto, PALAVRAS_MOTIVACAO))
    confusao = pontuar(texto, PALAVRAS_CONFUSAO)

    return RespostaSentimento(
        ansiedade_score=ansiedade,
        frustracao_score=frustracao,
        motivacao_score=motivacao,
        confusao_score=confusao,
        explicacao={
            "provedor": "heuristica-local",
            "limitacoes": [
                "Analise lexical sem compreensao clinica do prontuario completo.",
                "Negacoes, ironia e contexto cultural podem alterar a interpretacao.",
            ],
            "sinais": {
                "ansiedade": sorted(PALAVRAS_ANSIEDADE.intersection(texto.lower().split())),
                "frustracao": sorted(PALAVRAS_FRUSTRACAO.intersection(texto.lower().split())),
                "motivacao": sorted(PALAVRAS_MOTIVACAO.intersection(texto.lower().split())),
                "confusao": sorted(PALAVRAS_CONFUSAO.intersection(texto.lower().split())),
            },
        },
    )


@app.post("/reconhecer-alimento", response_model=RespostaReconhecimentoAlimentar)
def reconhecer_alimento(
    requisicao: RequisicaoReconhecimentoAlimentar,
    _: None = Depends(autenticar_servico),
) -> RespostaReconhecimentoAlimentar:
    descricao = str(
        requisicao.contexto.get("descricao")
        or requisicao.contexto.get("observacao")
        or ""
    ).lower()

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
        imagem_hash=requisicao.imagem_hash.lower(),
        alimentos_detectados=alimentos,
        peso_estimado_gramas=350.0,
        calorias_estimadas=calorias,
        confianca_media=round(confianca * 100, 2),
        limitacoes=[
            "Estimativa visual dependente da qualidade e do enquadramento da imagem.",
            "Porcao, ingredientes e modo de preparo precisam de confirmacao profissional.",
        ],
    )
