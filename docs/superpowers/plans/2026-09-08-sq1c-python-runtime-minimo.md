# SQ-1C — runtime Python minimo e proveniencia no SBOM

## Objetivo

Fechar somente os tres achados Python corrigiveis da imagem `ia-service`, sem
alterar as dependencias da aplicacao nem esconder os demais alertas da imagem
base que continuam sem correcao nesta fase.

## Estado observado no mesmo ciclo

- Base: `main` no merge `38ab752` do PR `#212`.
- Recaptura sanitizada em 2026-09-08: 219 Code Scanning, 2 Dependabot e 0
  Secret Scanning, totalizando 221 alertas abertos.
- Distribuicao do Code Scanning: 20 web, 20 backend, 176 IA e 3 Semgrep.
- Alertas-alvo:
  - `#353`, `msgpack@1.1.2`, `GHSA-6v7p-g79w-8964`, correcao `1.2.1`;
  - `#354`, `setuptools@70.3.0`, `CVE-2025-47273`, correcao `78.1.1`;
  - `#355`, `setuptools@70.3.0`, `CVE-2026-59890`, correcao `83.0.0`.
- O CycloneDX da imagem do run `34214246668` separa os componentes por camada:
  - `msgpack`, `setuptools`, `pip` e outros 16 componentes de tooling estao na
    camada `sha256:72a7471...b3fd9` herdada da imagem oficial;
  - as 22 dependencias resolvidas do OctaClin estao na camada
    `sha256:82f2eea...9d427`, criada pela instalacao com lock e hashes.
- `msgpack` e `setuptools` nao constam em `requirements.txt` nem em
  `requirements.lock.txt`; sao componentes vendorizados pelo pip da base. O
  runtime executa `uvicorn` diretamente e nao instala pacotes.

## Escopo minimo

1. No estagio final do Dockerfile da IA, remover os executaveis e o pacote
   global de pip depois de criar o usuario e antes de copiar `/install`.
2. Nao remover Python, `uvicorn`, as dependencias travadas nem os artefatos da
   aplicacao.
3. Configurar o harness para provar que `pip`, `pip3`, o pacote global de pip e
   seu metadata nao existem no container final.
4. Manter health real do servico IA e todas as provas de hardening existentes.
5. Atualizar estado, checklist e matriz com evidencia factual.

## TDD e implementacao

### RED

- Ampliar `scripts/validar-dockerfiles-runtime.spec.mjs` para exigir a limpeza
  do tooling Python no estagio final.
- Exigir que a matriz IA passe comandos e caminhos proibidos ao harness.
- Demonstrar que os novos contratos falham contra o Dockerfile atual.

### GREEN

- Adicionar a limpeza explicita ao `octaclin-ai-service/Dockerfile`.
- Configurar `comandos_ausentes` e `caminhos_ausentes` da IA em
  `.github/workflows/trivy.yml`.
- Fazer os contratos estaticos passarem sem relaxar regras anteriores.

### Gates locais

- `pnpm test:dockerfiles-runtime`;
- `pnpm test:lock-python`;
- `pnpm test:confiabilidade`;
- `pnpm test:workflows-seguros`;
- `pnpm validate:docs`;
- `pnpm security:secrets`;
- `git diff --check`;
- sintaxe do harness em Git Bash;
- harness real local: `SKIPPED` se Docker continuar indisponivel, nunca `PASS`.

### Gates da PR

- build da imagem IA e health real verdes;
- runtime non-root/read-only e ferramentas proibidas ausentes;
- SBOM final sem `pkg:pypi/msgpack@1.1.2` e
  `pkg:pypi/setuptools@70.3.0`;
- Trivy IA deve cair exatamente de 176 para 173 resultados;
- demais categorias devem permanecer 20 web, 20 backend e 3 Semgrep;
- todos os checks, revisao e threads resolvidos;
- merge humano.

## Risco e rollback

Risco R3: remover tooling do runtime pode quebrar importacao caso uma dependencia
da aplicacao use pip em tempo de execucao. A prova e o health real do container,
os testes do servico e a comparacao do SBOM. O rollback e reverter o commit da
limpeza; nenhum dado, schema, provider ou ambiente de producao e alterado.

## Fora de escopo

- Atualizar ou instalar `msgpack`/`setuptools` como dependencia da aplicacao.
- Trocar a imagem-base Python ou executar `apt upgrade` mutavel.
- Fechar ou dispensar os 173 achados restantes da IA.
- Alterar provider, logica clinica, tenancy, dados ou deploy.
