"""Oráculo sintético independente: Fraction e Decimal/ROUND_HALF_UP, sem dados clínicos."""
import json
import sys
from decimal import Decimal, localcontext, ROUND_HALF_UP
from fractions import Fraction
from pathlib import Path

destino = Path(__file__).resolve().parents[3] / 'octaclin-backend/src/modulos/planos-alimentares/dominio/fixtures/porcionamento-receita-oraculo.json'
entradas = [
    ('receita_inteira', '4', '500', '500', p) for p in ['0.001', '0.5', '1', '1.5', '2.5', '4', '10']
] + [
    ('por_porcao', '4', '125', '125', p) for p in ['0.001', '0.5', '1', '1.5', '2.5', '4', '10']
] + [
    ('receita_inteira', '3', '1', '500', '1'),
    ('receita_inteira', '4', '2', '2', '0.003'),
    ('receita_inteira', '1000', '10000', '10000', '0.001'),
    ('por_porcao', '1', '0.001', '0.001', '1000'),
    ('receita_inteira', '1', '10000', '10000', '1'),
    ('receita_inteira', '7', '123.456', '789.123', '2.5'),
    ('receita_inteira', '999', '3456.789', '9876.543', '2.501'),
]
casos = []
for base, rendimento, quantidade, gramas, porcoes in entradas:
    fator = Fraction(porcoes) / (Fraction(rendimento) if base == 'receita_inteira' else 1)
    resultado = {}
    with localcontext() as ctx:
        ctx.prec = 80
        for chave, origem in [('quantidade', quantidade), ('porcaoGramas', gramas)]:
            exato = Fraction(origem) * fator
            arredondado = (Decimal(exato.numerator) / Decimal(exato.denominator)).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)
            resultado[chave] = float(arredondado)
    casos.append(dict(base=base, rendimento=int(rendimento), quantidade=float(quantidade), gramas=float(gramas),
                      porcoes=float(porcoes), fator=dict(numerador=str(fator.numerator), denominador=str(fator.denominator)), esperado=resultado))
texto = json.dumps(dict(oraculo='python-fraction-decimal-half-up-v1', casos=casos), ensure_ascii=False, indent=2) + '\n'
if '--check' in sys.argv:
    if not destino.exists() or destino.read_text() != texto:
        raise SystemExit('FAIL: fixture diverge do oráculo independente')
    print(f'PASS: {len(casos)} casos sintéticos reproduzidos')
else:
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto)
    print(f'Gerados {len(casos)} casos sintéticos')
