# Playbook De Ambiente

Este playbook descreve sintomas, diagnostico e alternativas. Nao transforma
peculiaridade de uma maquina em regra universal. Nunca imprima secrets, PHI, PII
ou connection strings ao diagnosticar.

## CRLF, patches e busca

Sintoma: busca ou patch nao encontra texto que parece existir. Diagnostico:
arquivo pode estar em CRLF localmente e LF no Git, ou o contexto pode ter mudado.
Alternativas: releia o trecho imediatamente antes do patch, normalize apenas a
comparacao quando necessario e aplique patch pequeno. Nao regrave arquivo inteiro
para resolver uma diferenca de fim de linha.

## PowerShell, Git Bash e globs

Sintoma: comando com chaves, curingas ou aspas falha de modo inesperado.
Diagnostico: PowerShell e Git Bash interpretam expansoes e quoting de forma
diferente. Alternativas: passe paths explicitamente, evite expansao de brace do
Bash em PowerShell e use a sintaxe do shell em execucao. Confirme o diretorio de
trabalho e prefira `rg` com argumentos claros.

## PATH e runtime ausente

Sintoma: `node`, `pnpm`, `git` ou ferramenta do pacote nao e reconhecida.
Diagnostico: PATH da sessao pode diferir do terminal interativo. Alternativas:
verifique o executavel disponivel, use o runtime empacotado quando aprovado e
instale dependencias com o lockfile antes de concluir que o projeto esta quebrado.

## Lockfile e dependencias

Sintoma: diff ruidoso ou CI falha com lockfile congelado. Diagnostico: versao
diferente do pnpm, install incompleto ou auto-merge textual. Alternativas: use a
versao declarada em `packageManager`, revise o diff do lockfile, execute install
congelado e faca rebase quando PRs concorrentes alterarem dependencias.

## Compilador e target

Sintoma: corrigir um erro revela muitos outros. Diagnostico: erro de configuracao
do compilador pode impedir a analise dos arquivos. Alternativas: resolva primeiro
o erro de configuracao, rode o compilador alvo contra `node_modules` real e so
entao avalie os erros de codigo restantes.

## Scripts, PTY e processos

Sintoma: script, servidor local ou processo filho falha ou permanece ativo.
Diagnostico: PTY, porta ocupada, shell incorreto ou processo filho sobrevivente.
Alternativas: use PTY apenas para interacao real, confira PID e linha de comando,
encerre somente processo do checkout e valide portas antes de novo servidor.

## CI e GitHub Actions

Sintoma: a listagem sugere CI concluido, mas checks ainda mudam. Diagnostico:
listagens podem ser paginadas e atrasadas. Alternativas: obtenha o ID do run,
espere pelo status desse ID e inspecione seus jobs. Nunca conclua sucesso pelo
nome do workflow ou por uma listagem parcial.

## Banco e migrations

Sintoma: boot tenta DDL, migration falha ou staging nao reproduz producao.
Diagnostico: URL, role, branch ou altura de migrations podem estar incorretas.
Alternativas: use `migration:show`, confirme a identidade do alvo, aplique com
role owner fora de banda e pare se houver pendencia inesperada. Runtime nao deve
receber privilegio de migration por conveniencia.
