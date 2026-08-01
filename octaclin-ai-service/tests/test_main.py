import os
import unittest
from unittest.mock import patch

from app.main import (
    RequisicaoReconhecimentoAlimentar,
    RequisicaoSentimento,
    analisar_sentimento,
    reconhecer_alimento,
)


class ServicoIaTest(unittest.TestCase):
    def test_nao_declara_openai_sem_chamada_real(self) -> None:
        with patch.dict(os.environ, {"OPENAI_API_KEY": "dummy"}):
            resposta = analisar_sentimento(RequisicaoSentimento(texto="Estou frustrado"))

        self.assertEqual(resposta.explicacao["provedor"], "heuristica-local")
        self.assertTrue(resposta.explicacao["limitacoes"])

    def test_reconhecimento_informa_limitacoes(self) -> None:
        resposta = reconhecer_alimento(
            RequisicaoReconhecimentoAlimentar(imagem_url="https://example.com/prato.jpg")
        )

        self.assertEqual(resposta.provedor, "heuristica-local")
        self.assertTrue(resposta.limitacoes)


if __name__ == "__main__":
    unittest.main()
