"""Valida a superficie dos dois papeis UX; stdlib, sem provider ou acesso externo."""
import json
import sys
import tomllib
from pathlib import Path

NOMES = ('octaclin-nutricionista-ux', 'octaclin-paciente-ux')
FEATURES = {'shell_tool', 'apps', 'plugins', 'memories', 'request_permissions_tool'}


def validar_documento(dados, nome):
    erros = []
    if set(dados) != {'name', 'description', 'developer_instructions', 'features'}:
        erros.append('CAMPOS_NAO_PERMITIDOS_OU_AUSENTES')
    if dados.get('name') != nome:
        erros.append('IDENTIDADE_DIVERGENTE')
    for campo in ('description', 'developer_instructions'):
        if not isinstance(dados.get(campo), str) or not dados[campo].strip():
            erros.append('INSTRUCAO_AUSENTE')
    f = dados.get('features')
    if not isinstance(f, dict) or set(f) != FEATURES or any(v is not False for v in f.values()):
        erros.append('FERRAMENTA_NAO_DESABILITADA')
    return erros


def auditar(raiz):
    raiz = Path(raiz)
    erros = []
    pasta = raiz / '.codex' / 'agents'
    if (raiz / '.codex').is_symlink() or pasta.is_symlink():
        return ['RAIZ_SYMLINK']
    for nome in NOMES:
        arquivo = pasta / (nome + '.toml')
        if arquivo.is_symlink():
            erros.append(nome + ':SYMLINK')
            continue
        try:
            with arquivo.open('rb') as f:
                dados = tomllib.load(f)
        except (OSError, tomllib.TOMLDecodeError):
            erros.append(nome + ':AUSENTE_OU_TOML_INVALIDO')
            continue
        erros.extend(nome + ':' + erro for erro in validar_documento(dados, nome))
    return erros


if __name__ == '__main__':
    erros = auditar(Path(__file__).resolve().parent.parent)
    print(json.dumps({'violacoes': erros}, ensure_ascii=False))
    sys.exit(bool(erros))
