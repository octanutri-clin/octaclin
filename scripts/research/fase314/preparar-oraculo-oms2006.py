"""Pesquisa sintética WFL/WFH. A grade local já deve ter hashes verificados.
Não publica coeficientes completos; CSV de parâmetros permanece temporário.
Tolerância prospectiva: 0,005+1e-10 Z, pois R oficial arredonda duas casas.
"""
import argparse, csv, json, pathlib, importlib.util

ROOT = pathlib.Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('pesquisa', ROOT / 'docs/history/phases/reviews/fase-314-rev11/g01_engine_rev11.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
parser = argparse.ArgumentParser()
parser.add_argument('--grade', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
grade = json.loads(args.grade.read_text())['grade']
inputs = []
for kind, files, days in [('l', [7, 6], 730), ('h', [9, 8], 731)]:
    standards = []
    for sex, number in enumerate(files, 1):
        points = {r['x']: r for r in grade if r['arquivo'] == number}
        for x, r in points.items():
            standards.append({'sex': sex, 'length' if kind == 'l' else 'height': x,
                              'l': r['l'], 'm': r['m'], 's': r['s'], 'lorh': kind})
        for x, r in points.items():
            for fraction in [0, .5]:
                upper = points.get(round(x + .1, 1))
                if fraction and upper is None:
                    continue
                cm = round(x + fraction * .1, 2)
                p = tuple(r[k] if not fraction else (r[k] + upper[k]) / 2 for k in ['l', 'm', 's'])
                for z in [-5, -3, -2, 0, 2, 3, 5]:
                    if abs(z) <= 3:
                        kg = engine.who_lms_inverse(z, *p)
                    else:
                        sign = 1 if z > 0 else -1
                        kg = engine.who_lms_inverse(sign*3, *p) + sign*(abs(z)-3)*abs(engine.who_lms_inverse(sign*3, *p)-engine.who_lms_inverse(sign*2, *p))
                    inputs.append({'sexo': sex, 'dias': days, 'tecnica': kind, 'cm_original': cm, 'peso': kg})
        # Reverse technique, normalization and exact/outside endpoints.
        for cm in [min(points)-.001, min(points), 80, max(points), max(points)+.001]:
            for technique in ['l', 'h']:
                original = cm if technique == kind else cm + (-.7 if days < 731 else .7)
                inputs.append({'sexo': sex, 'dias': days, 'tecnica': technique, 'cm_original': original, 'peso': 12})
    with (args.output / f'parametros-wf{kind}.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=standards[0].keys())
        writer.writeheader()
        writer.writerows(standards)
with (args.output / 'entradas-oms2006.csv').open('w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=inputs[0].keys())
    writer.writeheader()
    writer.writerows(inputs)
print('Entradas sintéticas:', len(inputs))
