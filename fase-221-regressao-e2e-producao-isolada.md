# Fase 221 - Regressao E2E em producao isolada

Status: em validacao desde 2026-08-10.

## Objetivo

Validar, em sessoes novas e contra a web oficial de producao, que cada papel
acessa somente sua superficie autorizada depois das entregas das Fases 200 a
220. O smoke e estritamente de leitura: a unica mutacao permitida e o login.

## Cobertura

- `Professional`: dashboard, agenda, pacientes, formularios, comunicacoes,
  automacoes, IA assistida, metas/adesao e profissionais;
- `SuperAdmin`: os modulos do console e Operacoes, sem acesso aos portais;
- `Client`: portal do cliente;
- `Patient`: inicio, agenda, check-ins, plano, formularios, mensagens, perfil,
  privacidade e mais;
- uma rota de outro contexto e acessada por papel para confirmar o
  redirecionamento de autorizacao;
- qualquer HTTP 5xx, falha de rede real, excecao JavaScript, erro de console,
  retorno ao login ou mensagem de erro interno reprova a execucao;
- cancelamentos `net::ERR_ABORTED` causados pela troca deliberada de rota sao
  ignorados, mas todo outro motivo de falha de rede permanece bloqueante.

## Seguranca operacional

- execucao desabilitada por padrao e liberada somente com
  `E2E_PRODUCAO_READONLY=true`;
- URL limitada ao host HTTPS oficial `*.onrender.com`, sem caminho, query ou
  credencial embutida;
- senha recebida somente por variavel de processo temporaria e removida no
  `finally`;
- nenhum segredo, cookie, payload clinico, screenshot ou trace e versionado;
- nenhum botao de criacao, edicao, envio, arquivamento ou exclusao e acionado.

## Comandos

Contrato sem producao:

```powershell
pnpm test:producao:readonly:contrato
```

Execucao real, somente depois de confirmar papel e conta:

```powershell
$env:E2E_PRODUCAO_READONLY='true'
$env:E2E_WEB_URL='https://octaclin-web-producao.onrender.com'
$env:E2E_EMAIL='<email do papel validado>'
$env:E2E_PAPEL='<Professional|SuperAdmin|Client|Patient>'
$env:E2E_SENHA=Get-Clipboard
$codigo=1
try {
  pnpm --dir octaclin-web test:producao:readonly
  $codigo=$LASTEXITCODE
} finally {
  Remove-Item Env:E2E_PRODUCAO_READONLY,Env:E2E_WEB_URL,Env:E2E_EMAIL,Env:E2E_PAPEL,Env:E2E_SENHA -ErrorAction SilentlyContinue
}
exit $codigo
```

## Evidencias

- [x] Contrato local aprovado.
- [x] `Professional` aprovado em 2026-08-10: nove modulos, bloqueio de
  `/operacoes`, zero HTTP 5xx, falha de rede real, excecao de pagina ou erro de
  console.
- [x] `Client` aprovado em 2026-08-10 no portal do cliente e bloqueado no
  console.
- [ ] `SuperAdmin` aprovado em sessao isolada depois do deploy da correcao de
  Google Agenda.
- [ ] `Patient` aprovado em sessao isolada.
- [ ] Gates finais de formato, secrets e preflight aprovados.

## Defeito encontrado durante a validacao

O primeiro smoke do novo `SuperAdmin` encontrou HTTP 500 em
`GET /api/agenda/google/status`: o endpoint tentava resolver um perfil
profissional inexistente para o administrador. A correcao mantem a leitura do
status disponivel, devolve `podeGerenciar: false` ao `SuperAdmin` e limita
conectar/desconectar Google ao proprio `Professional`. A interface explica que
a conexao e individual e oculta os comandos indevidos.

O acesso administrativo legado nao pode ser descriptografado com a chave AES
atual. Ele deve permanecer ativo somente ate o novo `SuperAdmin` passar no
deploy; depois disso, deve ser desativado e ter seus refresh tokens revogados.

A fase somente pode ser marcada como concluida depois das quatro sessoes
isoladas passarem e da substituicao segura do acesso administrativo legado.
