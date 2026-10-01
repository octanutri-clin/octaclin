#!/usr/bin/env python3
"""Converte o arquivo oficial XLS da POF 2008-2009 em JSON local de ingestão."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import zipfile
from datetime import date
from pathlib import Path

import xlrd

URL_ARTEFATO = (
    "https://ftp.ibge.gov.br/Orcamentos_Familiares/"
    "Pesquisa_de_Orcamentos_Familiares_2008_2009/"
    "Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/"
    "tabelacompleta.zip"
)
ARQUIVO_XLS = "tabelacompleta.xls"
LIMITE_ZIP = 50 * 1024 * 1024
LIMITE_XLS = 20 * 1024 * 1024
TOTAL_LINHAS_ESPERADO = 1971


def texto(valor: object) -> str:
    return str(valor).strip() if valor is not None else ""


def codigo(valor: object, campo: str) -> str:
    if not isinstance(valor, (int, float)) or not math.isfinite(valor) or not float(valor).is_integer():
        raise ValueError(f"Código inválido no campo {campo}.")
    return str(int(valor))


def valor_nutriente(valor: object) -> int | float | str | None:
    if valor is None or valor == "" or valor == "-":
        return None if valor != "-" else "-"
    if isinstance(valor, str) and re.fullmatch(r"\d+(?:,\d+)?", valor):
        return valor
    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
        raise ValueError("Valor nutricional não numérico no XLS do IBGE.")
    return int(valor) if float(valor).is_integer() else float(valor)


def ler_arquivo(caminho: Path) -> tuple[bytes, bytes]:
    arquivo = caminho.read_bytes()
    if len(arquivo) > LIMITE_ZIP:
        raise ValueError("Arquivo ZIP do IBGE excede o limite de 50 MiB.")
    try:
        with zipfile.ZipFile(caminho) as pacote:
            entradas = pacote.infolist()
            if len(entradas) != 1 or entradas[0].filename != ARQUIVO_XLS:
                raise ValueError("ZIP do IBGE deve conter somente tabelacompleta.xls.")
            entrada = entradas[0]
            if entrada.file_size > LIMITE_XLS or entrada.file_size == 0:
                raise ValueError("Planilha XLS do IBGE excede o limite ou está vazia.")
            if entrada.compress_size == 0 or entrada.file_size / entrada.compress_size > 200:
                raise ValueError("Taxa de compressão do XLS do IBGE excede o limite permitido.")
            conteudo = pacote.read(entrada)
            if len(conteudo) != entrada.file_size:
                raise ValueError("Tamanho do XLS extraído diverge do diretório ZIP.")
            return arquivo, conteudo
    except zipfile.BadZipFile as erro:
        raise ValueError("Arquivo de origem IBGE não é um ZIP válido.") from erro


def extrair_referencias(planilha: object) -> dict[str, str]:
    referencias: dict[str, str] = {}
    for indice in range(4, planilha.nrows):
        codigo_fonte = planilha.cell_value(indice, 0)
        if isinstance(codigo_fonte, (int, float)) and float(codigo_fonte).is_integer():
            descricao = texto(planilha.cell_value(indice, 2)) or texto(planilha.cell_value(indice, 1))
            referencias[str(int(codigo_fonte))] = descricao
    if not referencias:
        raise ValueError("A lista de fontes de referência do XLS está vazia.")
    return referencias


def extrair_legenda(planilha: object) -> dict[str, str]:
    legenda: dict[str, str] = {}
    for indice in range(3, planilha.nrows):
        nome = texto(planilha.cell_value(indice, 0))
        unidade = texto(planilha.cell_value(indice, 1))
        if nome and unidade:
            legenda[nome] = unidade
    if not legenda:
        raise ValueError("A legenda de nutrientes do XLS está vazia.")
    return legenda


def converter(arquivo: Path, versao: str, capturada_em: str) -> dict[str, object]:
    zip_bytes, xls_bytes = ler_arquivo(arquivo)
    livro = xlrd.open_workbook(file_contents=xls_bytes, on_demand=True)
    try:
        tabela = next((livro.sheet_by_index(i) for i in range(livro.nsheets) if livro.sheet_by_index(i).ncols == 43), None)
        if tabela is None or tabela.nrows < 5:
            raise ValueError("A tabela de composição IBGE não tem o formato esperado de 43 colunas.")
        cabecalhos = [texto(valor) for valor in tabela.row_values(3)]
        if len(cabecalhos) != 43 or "CÓDIGO DO ALIMENTO" not in cabecalhos[0].upper():
            raise ValueError("Cabeçalho da tabela de composição IBGE inesperado.")
        nomes_legenda = next((livro.sheet_by_index(i) for i in range(livro.nsheets) if "nutriente" in livro.sheet_by_name(livro.sheet_names()[i]).name.lower()), None)
        fontes = next((livro.sheet_by_index(i) for i in range(livro.nsheets) if "refer" in livro.sheet_by_name(livro.sheet_names()[i]).name.lower()), None)
        if nomes_legenda is None or fontes is None:
            raise ValueError("Abas de legenda ou fontes de referência ausentes no XLS do IBGE.")
        referencias = extrair_referencias(fontes)
        legenda = extrair_legenda(nomes_legenda)
        linhas: list[dict[str, object]] = []
        for indice in range(4, tabela.nrows):
            valores = tabela.row_values(indice)
            codigo_alimento = valores[0]
            if codigo_alimento == "" or codigo_alimento is None:
                continue
            if not isinstance(codigo_alimento, (int, float)):
                continue
            nutrientes = {
                cabecalhos[coluna]: valor_nutriente(valores[coluna])
                for coluna in range(6, 43)
            }
            linhas.append(
                {
                    "numeroLinha": indice + 1,
                    "codigoAlimento": codigo(codigo_alimento, "alimento"),
                    "nomeAlimento": texto(valores[1]),
                    "codigoPreparacao": codigo(valores[2], "preparação"),
                    "nomePreparacao": texto(valores[3]),
                    "referenciaCodigo": codigo(valores[4], "referência"),
                    "referenciaDescricao": texto(valores[5]),
                    "nutrientes": nutrientes,
                }
            )
        if len(linhas) != TOTAL_LINHAS_ESPERADO:
            raise ValueError(f"Contagem de linhas IBGE divergente: {len(linhas)} (esperado {TOTAL_LINHAS_ESPERADO}).")
        return {
            "versao": versao,
            "checksumArquivo": hashlib.sha256(zip_bytes).hexdigest(),
            "checksumPlanilha": hashlib.sha256(xls_bytes).hexdigest(),
            "capturadaEm": capturada_em,
            "urlArtefato": URL_ARTEFATO,
            "referencias": referencias,
            "metadadosOrigem": {
                "nomeArquivo": ARQUIVO_XLS,
                "checksumPlanilha": hashlib.sha256(xls_bytes).hexdigest(),
                "unidadeBase": "por 100 gramas de parte comestível",
                "legendaNutrientes": legenda,
                "totalLinhas": len(linhas),
            },
            "linhas": linhas,
        }
    finally:
        livro.release_resources()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--arquivo", required=True, type=Path, help="ZIP oficial tabelacompleta.zip já baixado")
    parser.add_argument("--saida", required=True, type=Path, help="Destino local do JSON intermediário")
    parser.add_argument("--versao", default="pof-2008-2009-2011-v1")
    parser.add_argument("--capturada-em", required=True, type=date.fromisoformat)
    argumentos_cli = sys.argv[1:]
    if argumentos_cli and argumentos_cli[0] == "--":
        argumentos_cli = argumentos_cli[1:]
    argumentos = parser.parse_args(argumentos_cli)
    if not argumentos.arquivo.is_file():
        parser.error("--arquivo não existe ou não é arquivo regular.")
    dados = converter(argumentos.arquivo, argumentos.versao, argumentos.capturada_em.isoformat())
    argumentos.saida.parent.mkdir(parents=True, exist_ok=True)
    temporario = argumentos.saida.with_suffix(argumentos.saida.suffix + ".tmp")
    temporario.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporario, argumentos.saida)
    print(f"Artefato IBGE gerado: {len(dados['linhas'])} registros; checksum {dados['checksumArquivo']}.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, xlrd.XLRDError) as erro:
        print(f"Falha ao converter o catálogo IBGE: {erro}", file=sys.stderr)
        raise SystemExit(1)
