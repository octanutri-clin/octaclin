"""Extração de conferência documental; nunca importada pelo runtime."""
import argparse
from decimal import Decimal
from html.parser import HTMLParser
import json
from pathlib import Path
import re


class Tabelas(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tabelas = []
        self.tabela = None
        self.linha = None
        self.celula = None
        self.sup = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table':
            if self.tabela is not None:
                raise ValueError('Tabela aninhada não suportada.')
            self.tabela = {'id': attrs.get('id'), 'linhas': []}
        elif self.tabela is not None:
            if tag == 'tr':
                self.linha = []
            elif tag in ('th', 'td'):
                self.celula = {'tag': tag, 'attrs': attrs, 'texto': [], 'notas': []}
            elif tag == 'sup':
                self.sup += 1
            elif self.celula is not None and tag == 'a' and self.sup:
                self.celula['notas'].append(attrs.get('href'))
            elif self.celula is not None and tag == 'br':
                self.celula['texto'].append(' ')

    def handle_endtag(self, tag):
        if tag == 'table' and self.tabela is not None:
            self.tabelas.append(self.tabela)
            self.tabela = None
        elif tag == 'tr' and self.tabela is not None and self.linha is not None:
            self.tabela['linhas'].append(self.linha)
            self.linha = None
        elif tag in ('th', 'td') and self.celula is not None:
            if self.linha is not None:
                self.celula['texto'] = ' '.join(''.join(self.celula['texto']).split())
                self.linha.append(self.celula)
            self.celula = None
        elif tag == 'sup':
            self.sup = max(0, self.sup - 1)

    def handle_data(self, data):
        if self.celula is not None and not self.sup:
            self.celula['texto'].append(data)


def numero(texto):
    if texto == 'ND':
        return None
    if not re.fullmatch(r'(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?', texto):
        raise ValueError('Célula numérica inesperada: revisar fonte.')
    return str(Decimal(texto.replace(',', '')))


def extrair(html):
    parser = Tabelas()
    parser.feed(html)
    saida = []
    identidades = set()
    for tabela in parser.tabelas:
        cabecalhos = {}
        for linha in tabela['linhas']:
            for celula in linha:
                identidade = celula['attrs'].get('id')
                if celula['tag'] == 'th' and identidade:
                    if identidade in cabecalhos:
                        raise ValueError('Cabeçalho duplicado.')
                    cabecalhos[identidade] = celula
        for linha in tabela['linhas']:
            dados = [c for c in linha if c['tag'] == 'td' and c['attrs'].get('headers')]
            if not dados:
                continue
            idade = dados[0]
            vinculos_idade = idade['attrs']['headers'].split()
            if len(vinculos_idade) != 2:
                raise ValueError('Identidade de idade inesperada.')
            if any(i not in cabecalhos for i in vinculos_idade) or cabecalhos[vinculos_idade[1]]['texto'] != 'Age':
                raise ValueError('Cabeçalho de idade inválido.')
            for celula in dados[1:]:
                ids = celula['attrs']['headers'].split()
                if len(ids) != 3 or ids[0] != vinculos_idade[0] or any(i not in cabecalhos for i in ids):
                    raise ValueError('Vínculo de cabeçalhos ausente ou inconsistente.')
                grupo, nutriente, coluna = [cabecalhos[i] for i in ids]
                if coluna['attrs'].get('headers', '').split() != [ids[1]]:
                    raise ValueError('Coluna vinculada a outro nutriente.')
                if not coluna['texto'].startswith(('RDA/AI', 'AI', 'UL')):
                    continue
                identidade = (tabela['id'], grupo['attrs']['id'], idade['texto'], ids[1], ids[2])
                if identidade in identidades:
                    raise ValueError('Célula de referência duplicada.')
                identidades.add(identidade)
                notas = list(dict.fromkeys(nutriente['notas'] + coluna['notas'] + celula['notas']))
                saida.append({'tabela': tabela['id'], 'grupo': grupo['texto'],
                              'idade': idade['texto'], 'nutriente': nutriente['texto'],
                              'coluna': coluna['texto'], 'valor': numero(celula['texto']),
                              'notas': notas, 'cabecalhos': ids})
    return saida


if __name__ == '__main__':
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument('--vitaminas', type=Path, required=True)
    argumentos.add_argument('--elementos', type=Path, required=True)
    argumentos.add_argument('--saida', type=Path, required=True)
    args = argumentos.parse_args()
    fontes = {}
    for nome in ('vitaminas', 'elementos'):
        fontes[nome] = [r for r in extrair(getattr(args, nome).read_text())
                        if r['grupo'] in ('Males', 'Females') and
                        r['idade'].replace('–', '-').replace(' ', '') in
                        ('19-30y', '31-50y', '51-70y', '>70y')]
    args.saida.write_text(json.dumps({'estado': 'CANDIDATO_NAO_RATIFICADO_SEM_USO_RUNTIME',
                                     'fontes': fontes}, ensure_ascii=False, indent=2) + '\n')
