"""Coleta documental de fontes públicas; não extrai valores clínicos para runtime."""
import argparse
import hashlib
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.request import urlopen

BASE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes'
DATASET = '77fae12d-1ef0-431e-98df-451a4f7951c3'
FONTES = {
    'vitaminas': BASE + '/tables/reference-values-vitamins.html',
    'elementos': BASE + '/tables/reference-values-elements.html',
    'indice': BASE + '/tables.html',
    'licenca': 'https://open.canada.ca/en/open-government-licence-canada',
    'metadados': 'https://open.canada.ca/data/api/3/action/package_show?id=' + DATASET,
}
MAX_BYTES = 2_000_000


class ConteudoPrincipal(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.main = 0
        self.ignorados = 0
        self.partes = []
        self.modificado = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta' and attrs.get('name') == 'dcterms.modified':
            self.modificado = attrs.get('content')
        if tag == 'main':
            self.main += 1
        if tag in ('script', 'style'):
            self.ignorados += 1

    def handle_endtag(self, tag):
        if tag == 'main':
            self.main = max(0, self.main - 1)
        if tag in ('script', 'style'):
            self.ignorados = max(0, self.ignorados - 1)

    def handle_data(self, data):
        if self.main and not self.ignorados:
            self.partes.append(data)

    def texto(self):
        texto = ' '.join(' '.join(self.partes).split())
        if not texto:
            raise ValueError('Fonte HTML sem conteúdo principal; revisão necessária.')
        return texto


def sha(dados):
    return hashlib.sha256(dados).hexdigest()


def analisar(nome, url, final_url, dados):
    if not dados or len(dados) > MAX_BYTES:
        raise ValueError('Tamanho documental inválido.')
    registro = {'id': nome, 'url': url, 'urlFinal': final_url,
                'bytes': len(dados), 'sha256Bytes': sha(dados)}
    if nome == 'metadados':
        resposta = json.loads(dados)
        resultado = resposta.get('result', {})
        if resposta.get('success') is not True or resultado.get('id') != DATASET:
            raise ValueError('Metadados de outro recurso ou resposta inválida.')
        registro.update({'datasetId': resultado['id'], 'licenseId': resultado.get('license_id'),
                         'licenseUrl': resultado.get('license_url'),
                         'metadataModified': resultado.get('metadata_modified'),
                         'recursos': [r['url'] for r in resultado.get('resources', [])]})
    else:
        parser = ConteudoPrincipal()
        parser.feed(dados.decode('utf-8'))
        registro.update({'sha256TextoPrincipal': sha(parser.texto().encode('utf-8')),
                         'paginaModificadaEm': parser.modificado})
    return registro


def coletar():
    registros = []
    for nome, url in FONTES.items():
        with urlopen(url, timeout=25) as resposta:
            if resposta.status != 200 or not resposta.url.startswith('https://'):
                raise ValueError('Resposta documental inesperada.')
            dados = resposta.read(MAX_BYTES + 1)
            registros.append(analisar(nome, url, resposta.url, dados))
    return {'obtidoEm': datetime.now(timezone.utc).isoformat(),
            'finalidade': 'investigacao_documental_sem_valores_runtime',
            'direitos': 'PENDENTE_conferencia_escopo_e_terceiros',
            'fontes': registros}


if __name__ == '__main__':
    argumento = argparse.ArgumentParser(description=__doc__)
    argumento.add_argument('--saida', required=True, type=Path)
    args = argumento.parse_args()
    # Falhas não escrevem um manifesto parcial com aparência de aprovação.
    manifesto = coletar()
    args.saida.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n')
