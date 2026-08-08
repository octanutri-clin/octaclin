# Fase 217 - PWA do portal do paciente

Status: implementacao concluida em 2026-08-08. Nao exige migration.

## Objetivo

Tornar o portal instalavel e permitir check-in e finalizacao de formulario sem
anexo durante uma interrupcao de rede, sem manter dado clinico legivel ou uma
credencial de cifra persistente no dispositivo.

## Escopo entregue

- manifest do App Router, icones 192/512 e variante maskable;
- service worker proprio, tela offline neutra e botao de instalacao quando o
  navegador oferece `beforeinstallprompt`;
- indicador de conectividade, quantidade pendente e sincronizacao no portal;
- fila IndexedDB com payload AES-GCM e chave nao exportavel apenas em memoria;
- check-in offline com `idLocal`, serializacao por paciente e idempotencia
  persistente na tabela `sincronizacoes_mobile`; o `pacienteId` esperado impede
  sincronizacao sob outra conta se os cookies mudarem entre abas;
- finalizacao de formulario naturalmente idempotente pelo `envioId`, com lock
  pessimista e retorno da resposta ja criada em uma repeticao;
- limpeza da fila no logout e quando uma sincronizacao recebe HTTP 401;
- formulario com anexo explicitamente excluido da fila offline.

## Limites de privacidade

O Cache Storage recebe somente `/offline`, manifest, icones e arquivos
versionados de `/_next/static`. APIs, HTML protegido, dados do portal e
respostas clinicas nunca sao armazenados nele.

A fila privada suporta uma queda de rede enquanto a pagina permanece aberta.
A chave nao vai para `localStorage`, `sessionStorage`, cookie ou IndexedDB. Ao
recarregar/fechar o contexto, uma fila que perdeu a chave e eliminada. Isso e
intencional: persistencia clinica offline entre reinicios exige um cofre nativo
ou uma chave vinculada ao dispositivo e nao entrou neste MVP.

## Mobile existente

`octaclin-mobile` existe e permanece como aplicativo nativo separado. O PWA nao
consome `/mobile/sincronizacao/lote`: usa os endpoints do portal para preservar
os contratos de papel Patient, projecao segura e auditoria. Os dois fluxos
compartilham a tabela/padrao de idempotencia, sem duplicar o dado clinico.

## Validacao

- backend: suite completa com 107 suites e 773 testes aprovados;
- backend e web: typecheck aprovado;
- web: build de producao aprovado, com 118 paginas;
- contrato PWA: manifest, cache publico, fila cifrada, logout e idempotencia;
- Playwright: 6/6 em desktop e mobile, cobrindo manifest/SW, check-in offline,
  cifra no IndexedDB, sincronizacao unica, logout e formulario offline;
- `git diff --check` aprovado.

## Fora de escopo

- push notification e assinatura Web Push;
- leitura offline de plano, prontuario ou historico;
- formulario com upload offline;
- persistencia da fila depois de fechar ou recarregar o navegador;
- substituicao do aplicativo nativo existente.
