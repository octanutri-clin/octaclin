# Pesquisa reproduzível REV11 — fora do runtime

Somente fontes públicas e entradas sintéticas. Não usar dados/credenciais de
pacientes. Nenhum script é dependência do produto ou habilita classificação.
Leia `docs/history/phases/VALIDACAO_FASE_314_REV11.md` para resultados e limites.
O pacote recebido permanece intacto; `integracao.json` resolve suas localizações.

## Reprodução

Na raiz do repositório, com Python3 e Node22:

```sh
python3 scripts/research/fase314/reproduzir-pacote-rev11.py --output /tmp/rev11-evidencias
python3 scripts/research/fase314/baixar-fontes-oms.py --output /tmp/rev11-fontes
python3 -m unittest discover -s scripts/research/fase314 -p 'test_*.py' -v
```

O transporte de ambos os scripts aceita somente HTTPS/443, sem credenciais,
fragmentos ou redirecionamentos; downloader limitado a cdn.who.int e
raw.githubusercontent.com, coletor limitado a intergrowth21.ndog.ox.ac.uk.
TLS usa ssl.create_default_context com CERT_REQUIRED e check_hostname explícitos. Mudança de host/redirect exige
revisão explícita da fonte; não ampliar allowlist para contornar falha de download.
Testes locais verificam rejeição antes da rede, fechamento de conexão, preservação
dos hashes e uso do transporte pelos dois scripts; executados na governança CI.

O segundo comando falha se houver downloads indisponíveis/hash divergente.
Nesta execução,403 do CDN foi resolvido com User-Agent explícito; os16 XLSX
e3 TXT foram reconferidos. Os TXT fornecem também12 âncoras de borda, sem
fingir que seus hashes substituem os hashes XLSX. O downloader inclui fontes R.
Não versionar datasets completos enquanto direitos não estiverem comprovados.

Instale `openpyxl==3.1.5` somente em venv temporário para ler XLSX. Não alterar
package.json, lockfile ou dependências do produto:

```sh
python3 scripts/research/fase314/preparar-grade-oms.py --fontes /tmp/rev11-fontes --output /tmp/rev11-grade.json
python3 scripts/research/fase314/preparar-oraculo-oms2007.py --fontes /tmp/rev11-fontes --output /tmp/rev11-r2007
python3 scripts/research/fase314/preparar-oraculo-oms2006.py --grade /tmp/rev11-grade.json --output /tmp/rev11-r2006
```

Os executores R usam **webR0.2.0/R4.3.0** somente como ferramenta descartável,
sem copiar fontes GPL para o produto. Obtenha o tarball NPM de `webr/0.2.0`,
verifique SHA512 antes de extrair com paths seguros:
`5GLKIzCoc7fih1/sPnq7KBIUOyYSWUn6XOXAEN0EdSMhFzRPleUxKCQjT8InyJcumypEHbXD1ZzWfU/SW1nEvg==`.
Leia LICENSE.md do tarball. As fontes R primárias são fixadas em commit/hash
no manifesto e nos executores; baixar só ao diretório temporário. O executor
recusa fontes divergentes antes de executar. Nenhuma calculadora é chamada
durante o funcionamento do OctaClin.

```sh
node scripts/research/fase314/executar-oms2007-oficial.cjs /tmp/webR/package/dist/webr.cjs /tmp/rev11-fontes /tmp/rev11-r2007
node scripts/research/fase314/executar-oms2006-oficial.cjs /tmp/webR/package/dist/webr.cjs /tmp/rev11-fontes /tmp/rev11-r2006
python3 scripts/research/fase314/coletar-oraculo-oxford.py --output /tmp/rev11-oxford
```

Oxford recebe somente medidas sintéticas. O coletor não executa HTML/JavaScript
remoto; parseia JSON numérico e verifica idade, ordem e doses. HTML bruto fica
temporário. Oráculos numéricos e hashes podem ser arquivados como evidência.

## Motor TypeScript real

Execute Jest no backend com estas variáveis apontando a arquivos locais:

- `G01_GRADE_OMS_LOCAL`: `/tmp/rev11-grade.json`.
- `G01_ORACULO_OMS2006_LOCAL`: CSV produzido por R2006.
- `G01_FONTES_OMS2007_LOCAL`: pasta dos3 TXT.
- `G01_ORACULO_OMS2007_LOCAL`: CSV produzido por R2007.
- `G01_RELATORIO_OMS_LOCAL`, `G01_RELATORIO_OMS2006_LOCAL` e
  `G01_RELATORIO_OMS2007_LOCAL`: destinos opcionais dos relatórios agregados.

```sh
node node_modules/jest/bin/jest.js --runInBand src/modulos/pacientes/dominio/validacao-rev11-investigacao.spec.ts src/modulos/pacientes/dominio/intergrowth-investigacao.spec.ts
```

Sem fontes locais, testes integrais são **SKIPPED**, nunca PASS presumido;
testes amostrais/oráculos Oxford arquivados continuam executáveis no CI.
Tolerâncias são declaradas previamente: quantis OMS2006 0,0005+1e-10 unidade,
Z oficial arredondado OMS2006 0,005+1e-10, OMS2007 1e-8 Z, Oxford1e-8 Z
e1e-6 pontos percentuais. A diferença semanal55s não foi tolerada artificialmente.
Concordância computacional não concede direitos nem autoriza ativação clínica.
