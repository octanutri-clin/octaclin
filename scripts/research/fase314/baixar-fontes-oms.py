"""Pesquisa opt-in: download público por manifesto e hashes; não altera runtime.
Uso: python baixar-fontes-oms.py --output /tmp/fontes
Retorna falha se qualquer planilha necessária faltar. TXT não finge PASS XLSX.
"""
import argparse, concurrent.futures, hashlib, json, pathlib, re
from https_research import fetch_https

ALLOWED_HOSTS = frozenset({"cdn.who.int", "raw.githubusercontent.com"})
ROOT=pathlib.Path(__file__).resolve().parents[3]
def fetch(item, output):
    name,url,expected=item
    try:
        # CDN WHO recusa o User-Agent padrão urllib; identidade explícita, sem contornar autenticação.
        raw, _ = fetch_https(url, allowed_hosts=ALLOWED_HOSTS,
                             headers={'User-Agent':'Mozilla/5.0 OctaClin-Reference-Research/1.0'}, timeout=30)
        actual=hashlib.sha256(raw).hexdigest()
        if actual!=expected:return {'arquivo':name,'url':url,'status':'FAIL_HASH','sha256':actual,'expected':expected}
        (output/name).write_bytes(raw)
        return {'arquivo':name,'url':url,'status':'PASS','sha256':actual,'bytes':len(raw)}
    except Exception as e:return {'arquivo':name,'url':url,'status':'BLOCKED_DOWNLOAD','erro':str(e)}

def main():
    a=argparse.ArgumentParser();a.add_argument('--output',type=pathlib.Path,required=True);arg=a.parse_args();arg.output.mkdir(parents=True,exist_ok=True)
    manifest=(ROOT/'docs/product/FONTES_ANTROPOMETRIA_FASE_314.md').read_text()
    items=[]
    for i,line in enumerate(l for l in manifest.splitlines() if '[planilha]' in l):
        items.append((f'oms-planilha-{i:02}.xlsx',re.search(r'\[planilha\]\((.*)\) \|',line).group(1),re.findall(r'`([a-f0-9]{64})`',line)[0]))
    for filename,url,expected in re.findall(r'\| (?:data-raw/growthstandards/)?([^|]+) \| \[fonte\]\((https://raw\.githubusercontent\.com/[^)]+)\) \| `([a-f0-9]{64})`',manifest):
        if filename.strip() in ['bfawho2007.txt','hfawho2007.txt','wfawho2007.txt']:
            name={'bfawho2007.txt':'who2007-bfa.txt','hfawho2007.txt':'who2007-hfa.txt','wfawho2007.txt':'who2007-wfa.txt'}[filename.strip()]
            items.append((name,url,expected))
        mapping={'oms2006_helper.R':'who-helper.R','oms2006_utils.R':'utils.R','oms2006_wfl.R':'who-wfl.R','oms2007_zscores.R':'anthroplus-zscores.R'}
        if filename.strip() in mapping: items.append((mapping[filename.strip()],url,expected))
    items.append(('assertions.R','https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/R/assertions.R','e09b9a0133578adec07e1bf841f9ea3b657bfad1f55fa443f90cea78738a78ab'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: result=list(pool.map(lambda item: fetch(item, arg.output),items))
    (arg.output/'downloads.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'PASS':sum(r['status']=='PASS' for r in result),'BLOCKED_OR_FAIL':sum(r['status']!='PASS' for r in result)},indent=2))
    if any(r['status']!='PASS' for r in result):raise SystemExit(1)

if __name__ == '__main__':
    main()
