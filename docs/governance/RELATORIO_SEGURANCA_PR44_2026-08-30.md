# Relatorio de seguranca - PR 44

Data: 2026-08-30
Risco: R5 — bloqueador
Escopo: uploads e storage clinico (`docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`)
Branch: `security/governanca-pr44-uploads-storage-clinico`
Base: `origin/main` em `40570f280831a404447468bff3d14976ba77f863` (merge do PR GitHub `#166`,
que integrou o PR 43 — RLS e isolamento multi-tenant integral)

Nenhum banco, provider, secret real, PHI ou PII foi acessado. Nenhuma migration foi
criada nem executada. Nenhuma operacao foi feita em Render, Neon ou Backblaze B2
reais. Nenhum arquivo malicioso real foi usado — apenas fixtures sinteticas
(PNG/JPEG/WEBP construidos byte a byte em teste, e a assinatura padrao EICAR).

## 1. Baseline confirmado

```
git fetch origin
git rev-parse origin/main       -> 40570f280831a404447468bff3d14976ba77f863
git merge-base --is-ancestor bfcca6bb0bac8fdeec54edec939ea89fdc7229b3 origin/main -> ancestor (PR 42 / #165)
git merge-base --is-ancestor 40570f280831a404447468bff3d14976ba77f863 origin/main -> ancestor (PR 43 / #166)
```

Branch `security/governanca-pr44-uploads-storage-clinico` criada a partir de
`origin/main` nesse commit. PRs 42 e 43 nao foram reabertos, refeitos nem
ampliados — nenhuma REGRESSAO_DE_BASELINE foi encontrada neste ciclo.

## 2. Reconhecimento factual do fluxo existente (antes de qualquer mudanca)

| Papel | Arquivo |
| --- | --- |
| Cliente S3-compativel, magic bytes, hash, URL assinada | `octaclin-backend/src/infraestrutura/armazenamento/servico-armazenamento-objetos.ts` |
| Orquestracao de upload/confirmacao/download/exclusao, autorizacao por tenant/carteira/paciente | `octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.ts` |
| Entidade de metadata | `octaclin-backend/src/modulos/mobile/infraestrutura/arquivo-midia.orm.ts` (tabela `arquivos_midia`) |
| Endpoints autenticados | `octaclin-backend/src/modulos/mobile/apresentacao/controlador-mobile.ts` |
| Endpoint publico (formulario) | `octaclin-backend/src/modulos/questionarios/apresentacao/controlador-formularios-publicos.ts` |
| Series fotograficas clinicas (evolucao fotografica) | `octaclin-backend/src/modulos/pacientes/aplicacao/servico-evolucoes-fotograficas.ts` |
| Leitura para IA (reconhecimento alimentar) | `octaclin-backend/src/modulos/ia/aplicacao/servico-ia.ts` |
| BFF (proxy autenticado, sem key/bucket do cliente) | `octaclin-web/app/api/mobile/midias/uploads/**/route.ts` |

Fluxo: `browser -> BFF -> backend -> autorizacao (tenant/carteira/paciente) ->
metadata PostgreSQL -> URL assinada -> Backblaze B2 -> confirmacao -> validacao
-> disponibilizacao`.

Fatos confirmados no codigo, revalidados um a um:

- storage e S3-compativel, provider real e Backblaze B2 (`ARMAZENAMENTO_S3_ENDPOINT`
  documentado como `s3.us-east-00X.backblazeb2.com` nos testes e no runbook);
- bucket privado, credenciais nunca chegam ao navegador (`criarUploadAssinado`/
  `criarDownloadAssinado` devolvem so a URL);
- URLs assinadas existiam e sao preservadas (expiram em 300s, apontam para um
  objeto especifico);
- magic bytes existiam (`detectarMimeType`) e sao preservados;
- hash SHA-256 existia (`inspecionarObjeto`) e e preservado — mas agora sobre o
  objeto correto, ver secao 3;
- prefixo de pendentes (`pendentes/...`) existia; a promocao para
  `confirmados/...` existia via `CopyObjectCommand`;
- **quarentena, validacao de dimensao/decompressao, defesa contra polyglot,
  antimalware e remocao de metadado nao existiam** — este PR os introduz;
- tipos aceitos: `image/jpeg`, `image/png`, `image/webp` (imagem);
  `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/wav` (audio); `video/mp4`,
  `video/webm` (video); `application/pdf` (documento). **Nenhum tipo novo foi
  adicionado**;
- tamanho maximo: 25 MB (`LIMITE_ARQUIVO_BYTES`), inalterado;
- duracao da URL de upload e de download: 300s, inalterada;
- overwrite: bloqueado por `If-None-Match: *` quando o provedor suporta —
  **mas o provedor real (Backblaze B2) roda com
  `ARMAZENAMENTO_S3_IF_NONE_MATCH=false`** (documentado no proprio teste
  `servico-armazenamento-objetos.spec.ts`: "permite desativar escrita
  condicional em provedores S3 que nao a suportam"), o que torna a chave
  pendente reescrevivel pelo cliente durante a janela de validacao — ver
  achado ACH-01;
- origem da chave do objeto: sempre server-side,
  `pendentes/${tenantId}/${pacienteId}/${tipo}/${randomUUID()}`. O cliente
  nunca escolhe bucket nem key; `tenantId` vem do JWT/contexto server-side,
  `pacienteId` e validado contra a carteira antes de gerar a URL
  (`garantirPacientePermitido`/`garantirPacienteExistente`);
- hash: calculado no backend, sobre o conteudo lido do storage, nunca sobre o
  valor declarado pelo cliente (`inspecionarObjeto` ja ignorava o hash
  declarado antes deste PR — teste `confirma pelo objeto real e ignora
  tamanho e hash declarados anteriormente` preexistente);
- o backend **relia** o arquivo apos o upload (`GetObjectCommand` dentro de
  `inspecionarObjeto`) — nao ha streaming, mas o tamanho e checado por HEAD
  antes do GET, e o teto de 25 MB limita o custo de memoria;
- nao havia processamento de imagem, decode real, verificacao de dimensao,
  remocao de EXIF/GPS ou verificacao antimalware antes deste PR;
- PDFs sao aceitos e nao sao parseados estruturalmente (fora do escopo deste
  PR — nenhuma vulnerabilidade especifica de PDF foi comprovada, e o formato
  nao decodifica conteudo ativo por padrao no fluxo atual, que so gera URL
  assinada, nunca renderiza inline no backend);
- SVG e arquivos compactados **nao sao aceitos** e continuam nao aceitos;
- nenhum arquivo e renderizado inline pelo backend; o cliente busca a URL
  assinada e decide como exibir;
- exclusao: `DeleteObjectCommand` sem verificacao de que o objeto de fato
  deixou de existir — ver achado ACH-03.

## 3. Vulnerabilidades e lacunas comprovadas

### ACH-01 — TOCTOU entre inspecao e promocao (R5, confirmado)

- **Fonte:** cliente com a URL de upload assinada em maos (300s de validade,
  reutilizavel dentro da janela porque `ARMAZENAMENTO_S3_IF_NONE_MATCH=false`
  no provider real).
- **Sink:** `promoverObjeto` (S3 `CopyObjectCommand`), que copia o que
  **estiver la no momento da copia**, nao o que foi lido durante a inspecao.
- **Fluxo antigo:** `inspecionarObjeto(pendente)` (GET, magic bytes, hash) →
  **depois** `promoverObjeto(pendente → confirmado)`. Entre os dois passos, um
  segundo PUT do cliente para a mesma chave pendente troca o conteudo; a copia
  subsequente promove o conteudo **trocado**, mas o registro em banco grava o
  hash/tamanho/mime do conteudo **antigo**, que foi o unico validado.
- **Impacto:** um arquivo nunca inspecionado (tipo divergente, tamanho
  invalido, ou apos este PR, imagem-bomba/malware/polyglot) pode acabar sendo
  o que fica de fato em `confirmados/...` e e servido como se fosse o
  conteudo validado.
- **Prova:** `servico-armazenamento-objetos.spec.ts`, bloco "imutabilidade
  pos-promocao (TOCTOU)", contra um fake S3 em memoria que implementa PUT
  condicional, HEAD, GET, COPY e DELETE com semantica real (nao um retorno
  encenado): a copia promovida preserva os bytes de quando a copia foi
  executada, mesmo com uma escrita posterior na chave pendente.
- **Correcao:** inverter a ordem — `promoverObjeto` primeiro, `inspecionarObjeto`
  depois, sobre a chave **confirmada**. O cliente nunca recebeu URL assinada
  para escrever em `confirmados/...`; essa chave so passa a existir depois da
  copia e e imutavel para o cliente a partir dali. Validar sobre ela fecha a
  janela sem depender de escrita condicional do provedor.
- **Teste RED → GREEN:** `servico-mobile.spec.ts`, teste "confirma pelo objeto
  real e ignora tamanho e hash declarados anteriormente" — atualizado para
  provar que `promoverObjeto` e chamado **antes** de `inspecionarObjeto`
  (`invocationCallOrder`) e que a inspecao usa a chave confirmada, nao a
  pendente.

### ACH-02 — Nenhuma validacao de dimensao/decompression bomb (R4, confirmado)

- Nenhum codigo decodificava largura/altura antes deste PR. Uma imagem
  pequena em bytes com dimensoes declaradas absurdas passava pela unica
  checagem existente (tamanho em bytes via HEAD).
- **Correcao:** `sanitizacao-imagem.ts` le largura/altura reais da propria
  estrutura do arquivo (IHDR do PNG, marcador SOF do JPEG, VP8X/VP8/VP8L do
  WEBP) e rejeita acima de 12000px por lado ou 100 milhoes de pixels totais.
  Falha de extracao (formato nao reconhecido, JPEG sem SOF, WEBP com
  assinatura invalida) conta como rejeicao, nunca como "sem checagem".
- **Decisao deliberada de nao usar `image-size`:** o pacote foi avaliado e
  descartado. `docs/governance/MODELO_AMEACAS_E_TRIAGEM_SEGURANCA.md` e
  `docs/history/phases/fase-250-encerramento-divida-mobile-higiene-prs.md` ja
  documentam dois advisories altos sem versao corrigida
  (`GHSA-w3rx-r6r6-pgpr`, `GHSA-5p2g-fcmc-qvqq`, loop infinito nos parsers
  ICNS/JXL/HEIF) que mantêm o app mobile bloqueado por esse motivo. Adicionar
  o mesmo pacote vulneravel ao **backend**, justamente para se defender de
  DoS de imagem, seria contraditorio com o proprio risco que o programa de
  hardening ja registrou. O parser proprio deste PR so entende JPEG/PNG/WEBP
  (os tres formatos realmente aceitos) e nenhuma logica de ICNS/JXL/HEIF —
  os formatos vulneraveis nao existem neste codigo.
- **Teste RED → GREEN:** `sanitizacao-imagem.spec.ts`, "rejeita largura
  declarada acima do limite (decompression bomb sintetica)", "rejeita altura
  declarada acima do limite", "rejeita quantidade total de pixels acima do
  limite mesmo com largura/altura individualmente aceitas".

### ACH-03 — Metadado EXIF/GPS nunca era removido (R4, confirmado)

- Fotos clinicas de pacientes podem conter GPS, modelo do dispositivo,
  data/hora e outros metadados. Nada removia isso antes deste PR.
- **Correcao:** `removerMetadadosImagem` percorre a propria estrutura de
  segmentos/chunks (marcadores APPn/COM no JPEG, chunks `tEXt`/`zTXt`/`iTXt`/
  `eXIf`/`tIME` no PNG, chunks `EXIF`/`XMP ` no WEBP) e excisa esses blocos
  sem decodificar nem recodificar os pixels — os dados de imagem em si saem
  bit a bit identicos. Idempotente quando nao ha metadado a remover.
- **Efeito colateral aceito:** remover todo APPn no JPEG tambem remove
  perfil ICC embutido (APP2), quando presente — pode alterar levemente a
  interpretacao de cor em visualizadores que dependem dele. Nao e uma
  vulnerabilidade; e um trade-off deliberado a favor de nao deixar vetor de
  metadado sem cobertura.
- **Teste RED → GREEN:** `sanitizacao-imagem.spec.ts`, "remove segmentos
  APPn/EXIF e COM de um JPEG preservando os pixels", "remove chunks
  tEXt/eXIf/tIME de um PNG preservando IHDR/IDAT/IEND", "remove chunk EXIF de
  um WEBP estendido e corrige o tamanho RIFF", "mantem um JPEG sem metadados
  inalterado (idempotente)".

### ACH-04 — Nenhuma inspecao antimalware (R4, confirmado)

- Nenhum scanner existia. Nenhum servico SaaS externo foi introduzido (exigiria
  autorizacao humana e enviar conteudo clinico a terceiro, fora de escopo).
- **Correcao:** `ServicoAntimalware`, abstracao com um mecanismo de
  referencia que reconhece a assinatura padrao EICAR (arquivo de teste
  inerte, publico, definido pela industria — nao e malware real). Contrato:
  `clean` libera; `infected`, timeout (5s por padrao) ou erro do mecanismo
  **sempre** rejeitam. A interface `MecanismoAntimalware` existe para que uma
  integracao real (ClamAV local, por exemplo) substitua a referencia sem
  mudar quem consome o servico.
- **Limitacao registrada sem meias-palavras:** isto **nao e** um antivirus
  real. Ele so pega o arquivo de teste EICAR. Nenhuma alegacao de protecao
  contra malware real e feita neste relatorio.
- **Teste RED → GREEN:** `servico-antimalware.spec.ts` — libera conteudo sem
  a assinatura; rejeita com a assinatura presente em qualquer offset; falha
  fechado em timeout; falha fechado quando o mecanismo lanca erro; nunca
  inclui o conteudo inspecionado na mensagem de erro.

### ACH-05 — Exclusao sem prova de exclusao fisica (R3, confirmado)

- `excluirObjeto` so mandava `DeleteObjectCommand` e retornava — o S3 responde
  sucesso mesmo que o objeto nunca tenha existido, e um provedor com falha
  silenciosa poderia aceitar o DELETE sem remover o dado, com o backend
  marcando "excluido" no banco sem prova nenhuma.
- **Correcao:** `excluirObjetoVerificado`, usado nos dois fluxos de exclusao
  direta e permanente de arquivo (`ServicoMobile.excluirArquivoMidia` e
  `ServicoEvolucoesFotograficas.excluir`): manda o DELETE e so retorna
  sucesso apos um HEAD subsequente confirmar ausencia (`NotFound`/404). Erro
  de rede/permissao no HEAD de verificacao propaga em vez de ser interpretado
  como "objeto ausente" — o metodo antigo `excluirObjeto` continua existindo
  para os caminhos de limpeza best-effort (rejeicao de upload), onde uma
  falha nao pode travar o fluxo principal.
- **Teste RED → GREEN:** `servico-armazenamento-objetos.spec.ts`, bloco
  "excluirObjetoVerificado" (4 casos); `servico-mobile.spec.ts`, "nao marca o
  anexo como excluido quando a exclusao fisica nao pode ser confirmada";
  `servico-evolucoes-fotograficas.spec.ts`, "nao apaga os registros da serie
  quando a exclusao fisica do objeto nao pode ser confirmada".

### Achado da propria revisao (security-review): trava de concorrencia sem efeito real

Durante a implementacao, um advisory lock (`pg_advisory_xact_lock`) foi
adicionado no inicio de `confirmarUploadMidiaInterno` para reduzir trabalho
redundante em confirmacoes concorrentes. A revisao de seguranca sobre o
proprio diff (skill `security-review`) mostrou que `ExecutorTenant.executar`
abre uma transacao por chamada (`DataSource.transaction`); como o lock era
pego na primeira chamada (so leitura) e a transacao fechava antes do pipeline
de storage comecar, o lock **nao protegia a parte que importa** — daria uma
falsa impressao de protecao sem prover nenhuma. Removido. A propriedade de
seguranca real (nunca duas versoes "ativas" do mesmo anexo) continua valendo
sem ele, porque a chave `confirmados/...` e deterministica
(`arquivo.id`-based): confirmacoes concorrentes convergem para o mesmo
destino, e a ultima escrita bem-sucedida no banco e a que vale. O residual e
trabalho redundante de S3 num duplo clique, nao um risco de seguranca — a
justificativa completa esta comentada no proprio codigo
(`servico-mobile.ts`, acima de `confirmarUploadMidiaInterno`).

## 4. Nao encontrado / nao aplicavel neste PR

- **Polyglot com fixture dedicada:** nao foi criada uma fixture "polyglot"
  isolada porque o mecanismo de defesa contra polyglot **e** a combinacao
  ja existente de magic bytes + a nova validacao estrutural (SOF do JPEG,
  IHDR do PNG, VP8X/VP8/VP8L do WEBP): um arquivo que seja simultaneamente um
  ZIP/PDF valido E um JPEG valido so passa se o `detectarMimeType` reconhecer
  a assinatura JPEG no inicio do buffer E a estrutura de segmentos apos ela
  fizer sentido o bastante para `extrairDimensoesJpeg` encontrar um SOF real.
  Os testes de "estrutura invalida" (JPEG sem SOF, WEBP com assinatura
  incorreta, PNG truncado) cobrem esse mecanismo pela via negativa.
- **Trailing data suspeito:** nao implementado como checagem dedicada. Dados
  apos o `SOS`/fim de scan do JPEG nao sao inspecionados alem do que o hash
  SHA-256 sobre o objeto inteiro ja cobre (qualquer byte extra muda o hash e
  e preservado na copia, entao nao ha conteudo "invisivel" ao dado
  persistido — mas tambem nao ha rejeicao especifica de conteudo anexado
  apos o EOI). Registrado como risco residual (secao 7).
- **Zip/compressao:** arquivos compactados nao sao aceitos; a secao 17 do
  escopo nao se aplica.
- **Rate limiting:** ja existia (`ServicoProtecaoAbuso.consumirTentativa`) nos
  dois controllers, autenticado e publico, para solicitacao de upload. Nao
  precisou de mudanca.
- **Auditoria de upload/confirmacao/exclusao:** ja existia para os casos de
  sucesso. Este PR adiciona o evento de **rejeicao** (`mobile.midia.upload_
  rejeitado` / `formulario_publico.anexo.rejeitado`), que nao existia — ver
  secao 5.
- **BFF (`octaclin-web/app/api/mobile/midias/uploads/**`):** revisado, sem
  alteracao necessaria. Os quatro handlers sao proxies finos e autenticados
  (`requisitarBackendAutenticado`) que encaminham metodo/corpo/params ao
  backend e devolvem a resposta tal como veio; nenhum aceita bucket, key ou
  tenant do corpo da requisicao, nenhum expoe credencial, nenhum libera
  arquivo pendente por conta propria.
- **Frontend/Playwright:** nenhuma superficie de UI foi alterada por este PR
  (mudancas somente no backend). Nao ha teste Playwright novo — NA, nao
  SKIPPED, porque nao ha regressao possivel de UI que este PR poderia ter
  introduzido.
- **RLS/migration:** nenhuma tabela nova, nenhuma coluna nova. O estado de
  validacao ja existia como enum (`pendente`/`confirmado`/`excluido`) e o
  motivo de rejeicao entra no campo `metadados` (jsonb) ja existente, sem
  DDL. `MIGRATION: NA`.

## 5. Arquitetura final

```
solicitar upload
  -> autorizar paciente/carteira (server-side)
  -> gerar chave opaca pendentes/{tenant}/{paciente}/{tipo}/{uuid}
  -> URL assinada de PUT (300s, Content-Type travado, If-None-Match quando suportado)

confirmar upload
  -> promover pendente -> confirmado (copia S3; cliente nunca teve acesso de escrita a essa chave)
  -> inspecionar a copia confirmada: HEAD (tamanho real) -> GET -> magic bytes -> metadata S3 esperada
  -> se imagem: validar dimensao/pixels reais -> remover EXIF/GPS -> se mudou, reescrever a copia e recalcular hash
  -> inspecao antimalware (assinatura EICAR de referencia) sobre o conteudo final
  -> qualquer falha: apagar confirmado + pendente, marcar arquivo "excluido" com motivoRejeicao, auditar rejeicao
  -> sucesso: gravar hash/tamanho/mime finais, status "confirmado", apagar pendente, auditar confirmacao

download
  -> autenticar -> tenant do contexto -> carteira/paciente -> status == "confirmado" -> URL assinada de GET (300s)

exclusao
  -> autorizar (mesma carteira/tenant) -> DELETE no storage -> HEAD de verificacao -> so entao marcar "excluido" no banco
```

## 6. Seguranca por dimensao

- **Tenant:** nunca aceito do cliente. Vem de `usuario.tenantId` (JWT) ou do
  contexto do formulario publico resolvido a partir de um token opaco
  server-side. Toda query passa por `ExecutorTenant`, que aplica
  `app.tenant_id` na transacao (RLS do PR 43, inalterado).
- **Carteira/paciente:** `garantirPacientePermitido` (Patient so o proprio
  paciente; Professional so pacientes da propria carteira, resolvida
  server-side; SuperAdmin sem restricao adicional). Reaplicado a cada
  operacao (solicitar, confirmar, gerar acesso, excluir), nao so na
  solicitacao inicial.
- **Object key:** opaco (`randomUUID()`), gerado server-side, nunca
  recebido do cliente. O prefixo de tenant/paciente/tipo existe para
  auditoria/organizacao, nao para autorizacao — a autorizacao vem sempre da
  consulta ao banco por `tenantId`+`id` do registro, nunca por parsing da
  key.
- **Magic bytes:** preservado (`detectarMimeType`), agora aplicado sobre o
  objeto confirmado/imutavel em vez do pendente/mutavel.
- **Hash:** SHA-256, calculado no backend sobre o conteudo final (apos
  eventual sanitizacao de imagem), nunca sobre o valor declarado pelo
  cliente. O objeto que fica no bucket e o objeto cujo hash foi persistido —
  e exatamente essa correspondencia que ACH-01 fechou.
- **Limites:** 25 MB inalterado; dimensao e pixels novos (imagem apenas).
- **Polyglot:** ver secao 4.
- **Malware:** ver ACH-04, com a limitacao explicita registrada.
- **Metadado:** ver ACH-03.
- **Download:** exige `status === 'confirmado'`; um arquivo pendente,
  rejeitado ou excluido nunca gera URL assinada utilizavel — comportamento
  preexistente, preservado.
- **Exclusao:** ver ACH-05.
- **RLS:** nao houve alteracao de schema; os testes do PR 43
  (`rls-isolamento-tenant.integracao.spec.ts`) nao foram tocados e continuam
  fazendo parte da suite (SKIPPED neste ambiente por falta de Docker, ver
  secao 8, igual a antes deste PR).

## 7. Riscos residuais

1. `ServicoAntimalware` so detecta a assinatura EICAR — nao e um antivirus
   real. Um mecanismo real (ClamAV local ou similar) exige infraestrutura e
   decisao operacional fora do escopo/autoridade deste PR.
2. Validacao de dimensao cobre JPEG/PNG/WEBP por leitura de estrutura, nao
   decodificacao completa de pixels. Um arquivo estruturalmente valido cujos
   dados de pixel *comprimidos* expandissem para muito mais memoria do que a
   dimensao declarada sugere (um cenario diferente do "dimensao mentirosa"
   que este PR cobre) nao seria pego por este mecanismo. Mitigado
   parcialmente pelo teto de 25 MB no arquivo de entrada.
3. Conteudo apos o fim logico do JPEG (trailing data) nao e removido nem
   rejeitado especificamente — fica preservado como parte do hash/objeto.
4. PDF nao tem parser estrutural dedicado neste PR; a defesa e magic bytes +
   tamanho maximo.
5. `objetoAusente` (verificacao de exclusao fisica) reconhece os erros
   `NotFound`/`NoSuchKey`/404 do SDK AWS; o comportamento exato do Backblaze
   B2 real para HEAD apos DELETE nao foi validado contra o provider real
   neste PR (nenhuma operacao externa foi feita). Se o B2 usar um nome de
   excecao diferente para "nao encontrado", `excluirObjetoVerificado` passa a
   rejeitar exclusoes que na pratica funcionaram — falha no sentido seguro
   (nunca marca como excluido por engano), mas pode gerar falso-negativo
   operacional. Recomenda-se validar em staging antes do rollout (secao 9).
6. Este PR prova o comportamento do codigo com um fake S3 em memoria e com
   testes unitarios/de integracao dentro do processo Jest. Nao prova o
   comportamento do Backblaze B2 real, do Neon real nem de RLS em Postgres
   real (Docker indisponivel neste ambiente — SKIPPED, nao PASS, secao 8).

## 8. Gates executados

| Gate | Comando | Resultado |
| --- | --- | --- |
| Testes focados do PR 44 | `npx jest src/infraestrutura/armazenamento src/modulos/mobile src/modulos/pacientes/aplicacao/servico-evolucoes-fotograficas.spec.ts src/modulos/questionarios/apresentacao/controlador-formularios-publicos.spec.ts` | PASS — 8 suites, 83 testes |
| Suite completa do backend | `pnpm --dir octaclin-backend test` | PASS — 168 suites, 1313 testes; 3 suites e 26 testes skipped (Redis e RLS reais, exigem Docker — nao alterados por este PR) |
| Typecheck | `pnpm --dir octaclin-backend typecheck` | PASS |
| Build | `pnpm --dir octaclin-backend build` | PASS, `dist/main.js` validado |
| Lint | — | NA — o backend nao tem script de lint nem configuracao ESLint no repositorio (mesmo estado do PR 39/40) |
| `pnpm test:confiabilidade` | raiz | PASS — 20 referencias criticas (2 novas desta PR) |
| `pnpm security:secrets` | raiz | PASS — nenhum secret identificado |
| `git diff --check` | raiz | PASS |
| Semgrep local (arquivos alterados) | `semgrep/semgrep-rules@40b8c63`, `javascript`+`typescript`+`generic`+`problem-based-packs`, 436 regras | PASS — 0 achados (1 falso positivo de correcao — `no-stringify-keys` — resolvido extraindo uma variavel local, sem suprimir a regra) |
| CodeQL / Semgrep OSS / Trivy do PR (GitHub) | workflows do repositorio | Pendente — so roda apos o push e a abertura do PR; sera lido e triado (fonte → controle → sink) antes de declarar o PR pronto para merge |
| `test:rls:testcontainers` | `pnpm --dir octaclin-backend test:rls:testcontainers` | SKIPPED — exige Docker, indisponivel neste ambiente (`docker ps` falha: `dial unix /var/run/docker.sock: connect: no such file or directory`). Nao alterado por este PR |
| `test:abuso:redis-real` | `pnpm --dir octaclin-backend test:abuso:redis-real` | SKIPPED — mesma causa. Nao alterado por este PR |
| Prova real contra S3-compativel (MinIO) | — | SKIPPED — Docker indisponivel. Substituido por um fake S3 em memoria com semantica real de PUT condicional/HEAD/GET/COPY/DELETE (`servico-armazenamento-objetos.spec.ts`), que prova o comportamento de imutabilidade pos-promocao sem depender de rede ou infraestrutura externa. Nao e equivalente a testar contra o Backblaze B2 real |
| `pnpm --dir octaclin-web *` | — | NA — nenhum arquivo do web foi alterado |
| Playwright | — | NA — nenhuma superficie de UI foi alterada |

SKIPPED nao e PASS; nenhum dos SKIPPED acima foi declarado como aprovado.

## 9. Migration

`MIGRATION: NA`. Nenhuma tabela nova, nenhuma coluna nova. O motivo de
rejeicao (`motivoRejeicao`) e gravado no campo `metadados` (jsonb) que ja
existia em `arquivos_midia`.

## 10. Rollout futuro (nao executado)

Nenhum destes passos foi realizado neste PR. Ficam documentados para quando o
merge for aceito e uma operacao real for autorizada:

1. apos o merge, revisar o `RUNBOOK_PRODUCAO.md` atualizado (secao "Uploads e
   storage clinico (PR 44)");
2. validar em staging, com arquivo sintetico: solicitar upload, confirmar,
   baixar, excluir — e confirmar no log de auditoria os eventos
   `mobile.midia.upload_solicitar/confirmar/rejeitado/visualizar/excluir`;
3. validar especificamente o comportamento de `HeadObjectCommand` apos
   `DeleteObjectCommand` contra o Backblaze B2 real de staging (risco
   residual 5) — se o nome da excecao divergir de `NotFound`/`NoSuchKey`/404,
   ajustar `objetoAusente` num PR de correcao pontual antes de confiar na
   exclusao verificada em producao;
4. confirmar que a lifecycle rule de 1 dia sobre `pendentes/` no bucket real
   continua compativel — este PR nao muda em qual prefixo os objetos pendentes
   ficam, so a ordem promocao/inspecao;
5. deploy do backend;
6. smoke sintetico pos-deploy (upload/confirmacao/download/exclusao com
   arquivo sintetico, nunca com dado real);
7. rollback disponivel: reimplantar o commit anterior — sem migration, sem
   dado a reverter. Ver secao 11.

## 11. Rollback

Sem migration, sem alteracao de dados existentes. Reimplantar o commit
anterior. O formato do objeto no storage nao muda (mesmos bytes de imagem,
so sem metadado quando havia); a versao anterior do codigo continua lendo
qualquer arquivo ja confirmado normalmente. Nenhum dado fica ilegivel por
causa deste PR.

## 12. Skills

Skills do inventario do programa (`docs/governance/PROGRAMA_HARDENING_
SEGURANCA_PRS_36_56.md`, secao 4.1) relevantes a este PR:
`security-review`, `test-driven-development`, `nestjs-best-practices`,
`playwright-best-practices`, `gdpr-compliance`, `typeorm`,
`postgresql-table-design`, `database-migration`.

- **Carregada e usada:** `security-review`, aplicada ao diff completo do PR
  ao final da implementacao. Produziu o achado da secao 3 (trava de
  concorrencia sem efeito real), que foi corrigido antes deste relatorio.
- **Nao usadas porque nao se aplicaram:** `typeorm`, `postgresql-table-design`,
  `database-migration` — nenhuma migration ou alteracao de schema foi
  necessaria (secao 9). `playwright-best-practices` — nenhuma superficie de
  UI foi alterada.
- **`test-driven-development`:** ciclo RED → GREEN seguido com capacidade
  nativa (nao carregada como arquivo de skill), registrado na secao 3.
- **`nestjs-best-practices`:** padroes do modulo (DI via construtor,
  providers registrados no modulo, DTOs/guards existentes preservados) foram
  seguidos por consistencia com o restante do codebase, sem a skill
  carregada como arquivo.
- **`gdpr-compliance`:** nao carregada; a remocao de EXIF/GPS (ACH-03) segue
  o principio de minimizacao de dados sem que a skill tenha sido consultada
  como arquivo.
- Nao foram carregadas `gmail-skill`, `google` nem `brainstorming`, conforme
  a politica do programa para PRs de governanca de seguranca.

## 13. Definicao de pronto (autoavaliacao contra a secao 50 do escopo)

| Requisito | Estado |
| --- | --- |
| Arquivo nao validado nunca e servido | Sim — download exige `status === 'confirmado'`, atingido so apos toda a cadeia |
| Arquivo acima do limite e rejeitado | Sim — preexistente, preservado |
| Tipo divergente e rejeitado | Sim — preexistente, preservado |
| Magic bytes continuam funcionando | Sim — preservado, agora sobre o objeto imutavel |
| Parse invalido e rejeitado | Sim — `extrairDimensoesImagem` falha fechado |
| Decompression bomb e rejeitada | Sim, para JPEG/PNG/WEBP por dimensao/pixel real (ver risco residual 2) |
| Polyglot de teste e rejeitado | Parcial — via magic bytes + estrutura, sem fixture polyglot dedicada (secao 4) |
| Malware de teste e rejeitado | Sim — assinatura EICAR (nao e antivirus real, secao 3/ACH-04) |
| Falha do scanner nao libera | Sim — timeout e erro rejeitam |
| Metadata sensivel e removida quando aplicavel | Sim, para imagem (JPEG/PNG/WEBP) |
| Object key e server-side | Sim — preexistente, preservado |
| Usuario nao escolhe bucket/key | Sim — preexistente, preservado |
| Cross-tenant falha | Sim — preexistente (`ExecutorTenant`/RLS do PR 43), preservado |
| Professional fora da carteira falha | Sim — preexistente, preservado |
| Paciente errado falha | Sim — preexistente, preservado |
| Download exige autorizacao | Sim — preexistente, preservado |
| Delete exige autorizacao | Sim — preexistente, preservado |
| Exclusao e verificavel | Sim — ACH-05 |
| Overwrite/TOCTOU foi tratado | Sim — ACH-01 |
| Hash corresponde ao objeto validado | Sim — recalculado apos sanitizacao quando aplicavel |
| RLS do PR 43 continua passando | Sim — testes nao alterados, suite completa PASS (parte real com Postgres SKIPPED por falta de Docker, mesmo estado anterior) |
| Autorizacao do PR 42 continua passando | Sim — testes de autorizacao de objeto/funcao (`permissoes.spec.ts` etc.) nao tocados, suite completa PASS |
| PHI nao aparece nos logs novos | Sim — eventos de auditoria novos carregam so `recursoId`/`recursoTipo`/`acao`, nunca conteudo |
| Nenhum secret aparece no diff | Sim — `pnpm security:secrets` PASS |
| Nenhum provider real foi utilizado | Sim |

Este PR ainda **nao** esta integrado ao `main`. Implementacao concluida em
branch dedicada. Aguardando review humano, required checks (CodeQL, Semgrep,
Trivy, CI) e merge.
