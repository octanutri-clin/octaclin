import json,hashlib,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='Gera quadro documental candidato, sem uso clínico.')
parser.add_argument('--entrada',type=Path,required=True)
parser.add_argument('--vitaminas',type=Path,required=True)
parser.add_argument('--elementos',type=Path,required=True)
parser.add_argument('--saida',type=Path,required=True)
args=parser.parse_args()
j=json.loads(args.entrada.read_text())['fontes']
# Correspondências literais conferidas nos cabeçalhos; não há matching aproximado.
config=[('Cálcio','elementos','Calcium mg/day','mg','RDA'),('Magnésio','elementos','Magnesium mg/day','mg','RDA'),('Manganês','elementos','Manganese mg/day','mg','AI'),('Fósforo','elementos','Phosphorus mg/day','mg','RDA'),('Ferro','elementos','Iron mg/day','mg','RDA'),('Potássio','elementos','Potassium mg/day','mg','AI'),('Cobre','elementos','Copper μg/day','mcg','RDA'),('Zinco','elementos','Zinc mg/day','mg','RDA'),('Selênio','elementos','Selenium μg/day','mcg','RDA'),('Vitamina A','vitaminas','Vitamin A','mcg RAE','RDA'),('Tiamina','vitaminas','Thiamin mg/day','mg','RDA'),('Riboflavina','vitaminas','Riboflavin mg/day','mg','RDA'),('Vitamina B6','vitaminas','Vitamin B6 mg/day','mg','RDA'),('Niacina','vitaminas','Niacin mg/day (NE)','mg NE','RDA'),('Vitamina B12','vitaminas','Vitamin B12 μg/day','mcg','RDA'),('Folato','vitaminas','Folate μg/day (DFE)','mcg DFE','RDA'),('Vitamina D','vitaminas','Vitamin D','mcg','RDA'),('Vitamina E','vitaminas','Vitamin E','mg','RDA'),('Vitamina C','vitaminas','Vitamin C mg/day','mg','RDA')]
idades=['19-30y','31-50y','51-70y','>70y']
lines=['# FOOD06 — valores adultos candidatos para conferência','','Pesquisa documental de 2026-10-30. **Estado de ratificação: consultar a [ficha canônica](FICHA_VALIDACAO_CLINICA_FOOD06.md).** Sem uso no runtime.', '', 'Valores de referência por dia; M/F designam as populações das tabelas, não inferência de identidade.', 'Cada sequência segue **19–30 / 31–50 / 51–70 / 71+ anos**.', 'As duas colunas UL mostram números publicados; a aplicabilidade depende das notas da ficha.', 'ND = não estabelecido, nunca zero. Vírgula decimal pt-BR e sem separador de milhar.', '', '| Nutriente | Unidade da referência | Tipo | M | F | Unidade UL | UL M | UL F |','| --- | --- | --- | --- | --- | --- | --- | --- |']
def texto(vs):return ' / '.join('ND' if v is None else v.replace('.',',') for v in vs)
for label,src,nutrient,unit,tipo in config:
 vals=[]
 for grupo in ['Males','Females']:
  for col in ['RDA','UL']:
   vs=[]
   for idade in idades:
    rs=[r for r in j[src] if r['nutriente']==nutrient and r['grupo']==grupo and r['idade'].replace('–','-').replace(' ','')==idade and 'IU/' not in r['coluna'] and (r['coluna'].startswith('UL') if col=='UL' else r['coluna'].startswith(('RDA/AI','AI')))]
    if len(rs)!=1:raise ValueError((label,grupo,idade,col,len(rs)))
    vs.append(rs[0]['valor'])
   vals.append(vs)
 m,um,f,uf=vals
 ulunit={'Vitamina A':'mcg pré-formada','Niacina':'mg formas abrangidas','Folato':'mcg ácido fólico','Vitamina E':'mg formas suplementares abrangidas'}.get(label,unit)
 lines.append(f'| {label} | {unit} | {tipo} | {texto(m)} | {texto(f)} | {ulunit} | {texto(um)} | {texto(uf)} |')
lines+=['','## Limitações obrigatórias','','- Vitamina A: RDA em RAE; UL somente fração pré-formada abrangida, não RAE total.','- Magnésio: UL farmacológico/suplementar, não o magnésio alimentar natural.','- Niacina: RDA em NE; UL em mg das formas sintéticas abrangidas, não mg NE.','- Folato: RDA em DFE; UL em mcg de ácido fólico/formas abrangidas, não mcg DFE.','- Vitamina E: referência exige formas 2R compatíveis. Notas Health Canada e NIH diferem na redação sobre origem sintética versus todas as formas suplementares. A comparação UL fica bloqueada por falta de segregação/definição no total PA06.','- Vitamina C: números basais; proposta de acréscimo de 35 mg/dia para tabagismo confirmado precisa de ratificação e contexto explícito.','- Ferro: tabela assume dieta mista; não ajustar por dieta/menstruação sem contrato aprovado.','- Cobre: tabela está em mcg; PA06 usa mg. Conversão dimensional explícita é indispensável.','- B6 e selênio: valores UL DRI acima não são os ULs EFSA de 2023 (12 mg e 255 mcg, respectivamente). Não misturar autoridades nem apresentar abaixo de UL como garantia de segurança.','','## Origem e reprodução','','Extração por `headers` literais de células das páginas oficiais Health Canada de [vitaminas](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html) e [elementos](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html). Nenhum valor é extrapolado de outra idade. A extração exclui texto de sobrescritos, mas conserva seus vínculos; não usa posição de coluna como identidade.','','Comando executado sobre os HTMLs temporários:','','```sh','python research/food06/extrair_tabelas.py --vitaminas /tmp/food06-fontes/vitaminas.html --elementos /tmp/food06-fontes/elementos.html --saida /tmp/food06-valores-candidatos.json','```','','O extrator genérico não resolve automaticamente códigos clínicos nem notas de aplicabilidade. O quadro acima seleciona os 19 nomes literais correspondentes às referências candidatas; retinol/RE/niacina não-NE não ganham referência própria por inferência. Para vitamina A/D foi selecionada a coluna em mcg, nunca IU.','','Hashes dos bytes de entrada da extração desta rodada (diferem do manifesto de outra obtenção por HTML dinâmico):','']
for nome in ['vitaminas','elementos']:
 b=getattr(args,nome).read_bytes();lines.append(f'- {nome}: `{hashlib.sha256(b).hexdigest()}`.')
lines+=['','A concordância bibliográfica documentada a seguir é uma conferência pelo agente. Não constitui revisão clínica ou execução independente de testes. A conferência de extração tampouco concede direitos de uso comercial.']
args.saida.write_text('\n'.join(lines)+'\n')
