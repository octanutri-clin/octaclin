# Relatorio de seguranca - PR 48 - Tooling de agentes

Data: 2026-08-31

Branch: `security/governanca-pr48-tooling-agentes`

Base verificada: `bc94ae7` (merge humano do PR GitHub `#174`, PR 47).

## 1. Escopo

Este PR audita e reduz o tooling versionado em `.agents` e `.claude`. Ele nao
altera runtime do SaaS, dependencias de produto, banco, migrations, providers,
deploy ou dados. Supply chain de pacotes e imagens permanece no PR 49.

Foram inspecionados 608 arquivos inicialmente versionados em `.agents`,
`.claude` e seus hooks; 22 skills em cada arvore, mais `fechar-fase` exclusiva
do Claude; scripts Python, JavaScript, shell e PowerShell; nove workflows
GitHub Actions; configuracao dos hooks; e exclusoes do scanner de secrets.

Nenhuma Action de Claude, Gemini, Codex ou GitHub AI Inference foi encontrada
nos workflows. Nao existe, neste snapshot, prompt de issue/PR chegando a agente
com token do GitHub dentro do CI.

## 2. Achados comprovados no baseline

### 2.1 Tooling operacional com PII e rede

As duas copias de `gmail-skill` podiam consultar Gmail/People API e imprimir em
stdout nomes, e-mails, telefones, enderecos, aniversarios e biografias. O OAuth
tambem reservava uma porta com bind amplo antes de iniciar o callback local.
Isso confirma os casos `SEC-PR37-006` e `SEC-PR37-008`.

As duas copias da skill `google` concediam comandos de leitura e escrita em
Gmail, Calendar, Drive, Docs, Sheets e Slides. Sua documentacao incluia
instalacao manual de binario remoto. Nenhuma dessas capacidades e necessaria
para construir ou testar o OctaClin.

### 2.2 Execucao arbitraria no servidor auxiliar

O servidor `brainstorming/scripts/server.cjs` aceitava
`BRAINSTORM_OPEN_CMD` e concatenava seu valor com uma URL antes de executar
`child_process.exec`. Embora a variavel dependesse do operador, o caminho
criava autoridade de shell desnecessaria em uma skill externa. O mesmo servidor
podia receber bind externo e expunha HTTP/WebSocket sem TLS nessa configuracao.

### 2.3 Evidencia historica de alertas refutados/mitigados

Antes da remocao, o alerta de senha em clear text foi refutado porque o sink
historico em `gmail_skill.py:421-437` imprimia somente o e-mail autenticado, nao
token ou client secret. O problema de minimizacao de PII sobreviveu no caso
separado acima.

O path traversal reportado em `brainstorming/scripts/server.cjs:267-604` tambem
foi refutado: a rota aplicava `path.basename`, recusava symlink/hardlink e
confirmava `realpath` dentro de `CONTENT_DIR`. HTTP/WebSocket sem TLS estava
mitigado apenas no bind loopback padrao, mas continuava desnecessario e foi
eliminado junto com a skill. A remocao nao reclassifica retrospectivamente os
alertas; apenas encerra sua superficie versionada.

### 2.4 Hooks com falha aberta e dependencia de plataforma

Os hooks eram PowerShell, usavam paths relativos e, em payload malformado,
alguns encerravam sem decisao. Ausencia de PowerShell, CWD diferente ou erro de
parse podia transformar a protecao em bypass. O typecheck pos-edicao nao
bloqueava a acao e criava uma aparencia de gate que o contrato do hook nao
garantia.

### 2.5 Scanner sem visibilidade sobre o proprio tooling

`scripts/scan-secrets.mjs` excluia globalmente `.agents` e qualquer diretorio
chamado `skills`. Um secret novo dentro do tooling versionado nao seria visto
pelo gate local nem pelo job de governanca.

## 3. Decisoes implementadas

### 3.1 Remocao de capacidades sem uso justificado

Foram removidas, nas duas arvores, `gmail-skill`, `google` e `brainstorming`.
Tambem sairam helpers placeholder sem funcao real de `api-rate-limiting` e
`jwt-authentication`. A integracao Google do produto continua no backend e nao
depende dessas skills.

### 3.2 Allowlist minima e verificavel

`config/agent-tooling-allowlist.json` declara toda skill e seu modo, proibe
PII/PHI, secrets e acesso operacional por skills, fixa caminho/capacidade/hash
dos dez executaveis restantes e lista os dois hooks permitidos.

`scripts/validar-tooling-agentes.mjs` falha quando encontra skill ou executavel
novo, hash divergente, symlink, path proibido, capacidade fora da politica,
hook diferente do contrato ou Action de IA no CI. Uma atualizacao legitima
exige revisar o codigo, atualizar o hash e passar por PR/checks.

Os helpers de UI allowlisted foram verificados sem `child_process`,
`subprocess`, `shell=True`, `eval`, listener de rede ou cliente HTTP. Um deles
escreve somente artefatos sinteticos de design e por isso recebe a capacidade
`workspace-write-synthetic`; os demais sao leitura local ou teste.

### 3.3 Hooks portaveis e decisao conservadora

Os hooks PowerShell foram substituidos por
`scripts/claude-hook-guard.mjs`. Um launcher Node resolve
`process.env.CLAUDE_PROJECT_DIR`, variavel oficial do Claude Code, sem depender
da sintaxe de expansao do shell. O comando foi exercitado com CWD externo ao
repositorio e funciona no shell real usado pelo teste; ausencia da variavel
encerra com exit `2`, o codigo bloqueante do contrato. A ativacao de plugin
global saiu do settings versionado: plugin instalado na maquina nao recebe
autoridade implicita do repositorio.

O hook responde `ask` a payload ambiguo, nega escrita em `.env` e paths
recusados pela governanca, nega download remoto encaminhado/encadeado a shell,
nega comandos evidentes de escrita em `.env` e exige aceite humano para `gog`
ou `gmail_skill.py`, mesmo se instalados fora do repositorio.

O typecheck automatico pos-edicao foi removido. Typecheck continua nos gates
reais de pacote/CI; o hook antigo nao era bloqueante e nao os substituia.

### 3.4 Scanner e CI

O scanner de secrets agora percorre `.agents` e `.claude`. Seis URLs de banco
em documentacao Playwright foram convertidas para senha sintetica `changeme`,
sem criar exclusao. `pnpm test:tooling-agentes` roda no job de governanca antes
do scanner.

## 4. Evidencia RED -> GREEN

RED no baseline: o teste nao carregava porque politica/validador ainda nao
existiam; depois de incluir o tooling no scanner, seis fixtures de documentacao
foram expostas e tratadas sem allowlist ampla. Na revisao adversarial final,
um teste negativo adicional provou que duplicidade de skill, root arbitrario e
metadado extra de hook ainda eram aceitos; o validador foi endurecido antes do
commit.

GREEN: executavel novo, hash adulterado, skill surpresa e path proibido sao
recusados; payload malformado produz `ask`; `.env`, traversal e download remoto
para shell produzem `deny`; Google/Gmail produz `ask`; comando local seguro
produz `allow`; secret sintetico sob `.agents/skills` e detectado; duplicidade,
root fora de `.agents`/`.claude` e autoridade extra no hook tambem sao
recusados.

## 5. Validacoes locais

- PASS - `pnpm test:tooling-agentes` - 11/11.
- PASS - `pnpm test:security`.
- PASS - `pnpm security:secrets` - zero achado real.
- PASS - inventario dos workflows - zero Action de IA.
- PASS - inventario dos executaveis restantes - dez helpers hash-pinned de UI.
- PENDENTE - checks remotos do PR GitHub.
- NA - testes/builds do produto, migration, deploy e smoke: runtime do produto
  nao foi alterado.

## 6. Riscos residuais e limites

- Hooks locais nao sao sandbox nem fronteira absoluta. Eles podem nao existir
  em outro agente e nao substituem CI, ruleset, revisao ou menor privilegio.
- Skills/plugins instalados globalmente ficam fora do repositorio e desta
  allowlist. Eles nao recebem autorizacao implicita para secrets, PII/PHI ou
  operacao externa.
- A allowlist garante integridade e revisao dos helpers Python, nao isolamento
  de processo. Eles so podem usar dados sinteticos e nenhuma credencial.
- O scanner local por padroes complementa, mas nao substitui, GitHub Secret
  Scanning/Push Protection.
- O PR 49 ainda deve fechar provenance, SBOM, licencas e dependencias.

## 7. Processo de atualizacao

1. justificar a necessidade da skill/helper;
2. tratar seu conteudo como nao confiavel e revisar todo codigo executavel;
3. negar rede, secrets, PII/PHI e operacao externa por padrao;
4. adicionar a menor capacidade e o SHA-256 atual;
5. adicionar teste negativo para o novo risco;
6. executar os tres gates deste PR;
7. integrar somente por branch, PR, checks e review humano.

## 8. Estado

Implementacao e validacao local concluidas. O PR 48 deve parar em review
humano; o PR 49 nao esta autorizado antes do merge confirmado.
