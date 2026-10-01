import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

ESCRITORIO = Path(__file__).with_name("gerar-catalogo-ibge-pof.py")
ESPECIFICACAO = importlib.util.spec_from_file_location("gerar_catalogo_ibge_pof", ESCRITORIO)
MODULO = importlib.util.module_from_spec(ESPECIFICACAO)
assert ESPECIFICACAO and ESPECIFICACAO.loader
ESPECIFICACAO.loader.exec_module(MODULO)


class TestConversorIbgePof(unittest.TestCase):
    def test_normaliza_codigos_inteiros_sem_perder_zeros_decimais_de_valores(self):
        self.assertEqual(MODULO.codigo(6300701.0, "alimento"), "6300701")
        self.assertEqual(MODULO.valor_nutriente("0,02"), "0,02")
        self.assertEqual(MODULO.valor_nutriente("-"), "-")
        self.assertIsNone(MODULO.valor_nutriente(None))
        with self.assertRaises(ValueError):
            MODULO.codigo(1.5, "preparação")

    def test_rejeita_zip_com_membro_diferente_do_xls_oficial(self):
        with tempfile.TemporaryDirectory() as diretorio:
            arquivo = Path(diretorio) / "origem.zip"
            with zipfile.ZipFile(arquivo, "w") as pacote:
                pacote.writestr("unexpected.txt", "not a workbook")
            with self.assertRaisesRegex(ValueError, "somente tabelacompleta.xls"):
                MODULO.ler_arquivo(arquivo)

    def test_rejeita_taxa_de_compressao_excessiva(self):
        with tempfile.TemporaryDirectory() as diretorio:
            arquivo = Path(diretorio) / "origem.zip"
            with zipfile.ZipFile(arquivo, "w", compression=zipfile.ZIP_DEFLATED) as pacote:
                pacote.writestr(MODULO.ARQUIVO_XLS, b"0" * 500_000)
            with self.assertRaisesRegex(ValueError, "Taxa de compressão"):
                MODULO.ler_arquivo(arquivo)


if __name__ == "__main__":
    unittest.main()
