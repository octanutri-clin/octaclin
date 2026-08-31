from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
import hmac
import os
import re

app = FastAPI(title="OctaClin AI Service", version="0.1.0")


class ModeloEstrito(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ContextoSentimento(ModeloEstrito):
    origem: Literal["checkin_manual", "transcricao_audio", "mensagem_paciente"] | None = None


class ContextoReconhecimentoAlimentar(ModeloEstrito):
    observacao: str | None = Field(default=None, min_length=1, max_length=500)


class RequisicaoSentimento(ModeloEstrito):
    texto: str = Field(min_length=1, max_length=5000)
    contexto: ContextoSentimento = Field(default_factory=ContextoSentimento)


class SinaisSentimento(ModeloEstrito):
    ansiedade: list[str] = Field(max_length=50)
    frustracao: list[str] = Field(max_length=50)
    motivacao: list[str] = Field(max_length=50)
    confusao: list[str] = Field(max_length=50)


class ExplicacaoSentimento(ModeloEstrito):
    provedor: str = Field(min_length=1, max_length=80)
    limitacoes: list[str] = Field(max_length=20)
    sinais: SinaisSentimento


class RespostaSentimento(ModeloEstrito):
    ansiedade_score: float
    frustracao_score: float
    motivacao_score: float
    confusao_score: float
    explicacao: ExplicacaoSentimento
    revisao_humana_obrigatoria: Literal[True] = True


class RequisicaoReconhecimentoAlimentar(ModeloEstrito):
    imagem_hash: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    contexto: ContextoReconhecimentoAlimentar = Field(default_factory=ContextoReconhecimentoAlimentar)


class AlimentoDetectado(ModeloEstrito):
    nome: str = Field(min_length=1, max_length=160)
    confianca: float = Field(ge=0, le=1)
    calorias_estimadas: float | None = Field(default=None, ge=0, le=1_000_000)


class RespostaReconhecimentoAlimentar(ModeloEstrito):
    provedor: str
    imagem_hash: str
    alimentos_detectados: list[AlimentoDetectado] = Field(max_length=100)
    peso_estimado_gramas: float | None = Field(default=None, ge=0, le=1_000_000)
    calorias_estimadas: float | None = Field(default=None, ge=0, le=1_000_000)
    confianca_media: float | None = Field(default=None, ge=0, le=100)
    limitacoes: list[str] = Field(max_length=20)
    revisao_humana_obrigatoria: Literal[True] = True


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
        explicacao=ExplicacaoSentimento(
            provedor="heuristica-local",
            limitacoes=[
                "Analise lexical sem compreensao clinica do prontuario completo.",
                "Negacoes, ironia e contexto cultural podem alterar a interpretacao.",
            ],
            sinais=SinaisSentimento(
                ansiedade=sorted(PALAVRAS_ANSIEDADE.intersection(texto.lower().split())),
                frustracao=sorted(PALAVRAS_FRUSTRACAO.intersection(texto.lower().split())),
                motivacao=sorted(PALAVRAS_MOTIVACAO.intersection(texto.lower().split())),
                confusao=sorted(PALAVRAS_CONFUSAO.intersection(texto.lower().split())),
            ),
        ),
    )


@app.post("/reconhecer-alimento", response_model=RespostaReconhecimentoAlimentar)
def reconhecer_alimento(
    requisicao: RequisicaoReconhecimentoAlimentar,
    _: None = Depends(autenticar_servico),
) -> RespostaReconhecimentoAlimentar:
    descricao = (requisicao.contexto.observacao or "").lower()

    alimentos: list[AlimentoDetectado]
    if "salada" in descricao:
        alimentos = [AlimentoDetectado(nome="salada", confianca=0.76, calorias_estimadas=120)]
    elif "arroz" in descricao:
        alimentos = [
            AlimentoDetectado(nome="arroz", confianca=0.72, calorias_estimadas=190),
            AlimentoDetectado(nome="feijao", confianca=0.61, calorias_estimadas=130),
        ]
    else:
        alimentos = [AlimentoDetectado(nome="refeicao nao classificada", confianca=0.35, calorias_estimadas=350)]

    calorias = sum(float(item.calorias_estimadas or 0) for item in alimentos)
    confianca = sum(item.confianca for item in alimentos) / len(alimentos)

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
