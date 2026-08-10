# Fase 221 - Regressao E2E em producao isolada

Status: concluida em 2026-08-10.

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
- [x] `SuperAdmin` aprovado em sessao isolada depois do deploy da correcao de
  Google Agenda, com acesso ao console e Operacoes e bloqueio dos portais.
- [x] `Patient` aprovado em sessao isolada nas nove areas do portal e bloqueado
  no console; a conta sintetica registrou os aceites LGPD, Termos de Uso e
  Politica de Privacidade na versao `2026-07`.
- [x] Acesso `SuperAdmin` legado desativado, com sessoes e tokens de
  recuperacao revogados, somente depois da aprovacao do novo acesso.
- [x] Gates finais de formato, secrets, contrato e preflight aprovados.

## Defeito encontrado durante a validacao

O primeiro smoke do novo `SuperAdmin` encontrou HTTP 500 em
`GET /api/agenda/google/status`: o endpoint tentava resolver um perfil
profissional inexistente para o administrador. A correcao mantem a leitura do
status disponivel, devolve `podeGerenciar: false` ao `SuperAdmin` e limita
conectar/desconectar Google ao proprio `Professional`. A interface explica que
a conexao e individual e oculta os comandos indevidos.

O acesso administrativo legado nao podia ser descriptografado com a chave AES
atual. Depois da aprovacao do novo `SuperAdmin`, ele foi desativado e seus
refresh tokens e tokens de recuperacao foram revogados.

Na primeira tentativa de ativacao do `Patient`, a transacao criava o usuario e
tentava emitir a sessao em uma segunda transacao antes do commit. A FK de
`refresh_tokens` nao enxergava o usuario ainda nao confirmado e a ativacao
retornava HTTP 500 com rollback integral. O commit `b5293a9` passou a concluir
usuario, vinculo, consentimentos e convite antes de emitir a sessao. A regressao
unitaria confirmou essa ordem, a ativacao em producao foi aprovada e a sessao
inicial foi explicitamente revogada depois do smoke.

As quatro sessoes isoladas passaram sem HTTP 5xx, falha de rede real, excecao
de pagina ou erro de console. A falha de renovacao do token Gmail API observada
nos envios de recuperacao permanece como pendencia operacional independente da
autorizacao e da regressao desta fase.
