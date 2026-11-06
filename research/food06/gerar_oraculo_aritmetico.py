"""Oráculo decimal sintético independente do código TypeScript. Não contém DRI."""
import argparse
from decimal import Decimal, ROUND_HALF_UP, localcontext
import json
from pathlib import Path

PARES = [('1', '3'), ('12.34567891', '0.0043'), ('0.125', '7'), ('19.9', '6'),
         ('0.000001', '0.3'), ('123456', '789'), ('0', '5'), ('7', '4'),
         ('100', '100'), ('0.1', '0.2'), ('999.99999999', '0.01234567'), ('0.3', '0.9'),
         ('1', '3.0000000049'), ('0.00000001', '0.0000000149'), ('1', '51200')]


def gerar():
    with localcontext() as ctx:
        ctx.prec = 60
        casos = [{'total': a, 'referencia': b,
                  'percentual': str((Decimal(a) / Decimal(b) * 100).quantize(
                      Decimal('0.00000001'), rounding=ROUND_HALF_UP))}
                 for a, b in PARES]
    return {'sintetico': True, 'metodo': 'python-stdlib-decimal-precision60-half-up-8', 'casos': casos}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, required=True)
    args = parser.parse_args()
    args.saida.write_text(json.dumps(gerar(), indent=2) + '\n')
