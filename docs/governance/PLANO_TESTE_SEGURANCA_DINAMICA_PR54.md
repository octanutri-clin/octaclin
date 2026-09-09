# Plano de teste de seguranca dinamica - PR 54

Status em 2026-09-08: **regras de engajamento e automacao implementadas; execucao externa pendente de autorizacao**.

## 1. Objetivo e autorizacao

Este plano cobre DAST passivo e probes ativos limitados no ambiente descartavel
do workflow `OctaClin staging E2E mutavel`. A execucao precisa ser iniciada
manualmente por `workflow_dispatch`, com `executar_seguranca_dinamica=true` e a
frase exata `DAST-FUZZ-STAGING-DESCARTAVEL`. A autorizacao vale somente para o
run que a registra.

O preflight aceita exclusivamente `http://127.0.0.1:3000` e
`http://127.0.0.1:3001`. Esses processos usam branch Neon descartavel, fixtures
dos tenants `octaclin-e2e-alfa` e `octaclin-e2e-beta`, Redis e MinIO efemeros.
A branch Neon e excluida em `if: always()`, inclusive quando um teste falha.

## 2. Regras de engajamento

Permitido:

- navegar passivamente pelas paginas publicas locais com OWASP ZAP Baseline;
- enviar no maximo 30 requisicoes ativas, uma por vez e com timeout de 10 s;
- criar dados exclusivamente sinteticos na branch descartavel;
- provar respostas de autenticacao, autorizacao, validacao, idempotencia e
  limites sem registrar os corpos retornados.

Proibido:

- testar producao, Render, dominios publicos, contas reais ou terceiros;
- executar DoS, carga, concorrencia, brute force irrestrito ou persistencia;
- explorar alem da prova minima, exfiltrar dados ou tentar elevar privilegio;
- publicar tokens, cookies, payloads, respostas brutas, PHI ou segredos;
- classificar `SKIPPED`, timeout ou erro operacional como `PASS`.

O ZAP usa a imagem oficial `2.17.0` fixada pelo digest do manifesto e o
`zap-baseline.py`, que faz spider curto e analise passiva, sem ataques ativos.
Referencia: [ZAP Baseline Scan](https://www.zaproxy.org/docs/docker/baseline-scan/).

## 3. Cobertura ativa

| Area | Prova positiva/negativa | Resultado esperado |
| --- | --- | --- |
| Auth | login sintetico, ausencia de token e JWT malformado | `200`, `401`, `401` |
| BFLA | Professional tenta ler `/operacoes/resumo` | `403` |
| BOLA | tenant Beta tenta ler e alterar paciente do Alfa | `404`, `404` |
| Mass assignment | criacao tenta injetar `tenantId` | `400` |
| Parser | UUID invalido, JSON truncado e entrada inerte em busca | `400`, `400`, sem `5xx` |
| Limites | corpo JSON acima de 100 kb | `413` |
| Upload | declaracao acima de 20 MB | `400` |
| Webhook | content type, assinatura, HMAC valido e replay | `415`, `403`, `200`, duplicado |
| Rate limit | seis falhas controladas numa identidade sintetica exclusiva | quinta `401`, sexta `429` |

As categorias seguem o [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x03-introduction/),
com foco em autorizacao por objeto/funcao, consumo de recursos, configuracao e
inventario das superficies exercitadas.

## 4. Triagem e evidencia

O relatorio bruto do ZAP fica apenas no runner efemero. O artefato de 30 dias
contem dois JSONs sanitizados: contagem/id/nome/risco dos alertas e
rotulo/categoria/status dos probes. URLs, query strings, evidencias, ataques,
parametros e corpos nao entram no artefato.

Alerta `high` bloqueia o run. Um falso positivo so deixa de bloquear se **todos**
os caminhos atingidos por aquele plugin estiverem no ledger
`security/dast-fuzz-falsos-positivos.json`, com decisao exata, justificativa,
evidencia em documento, owner e prazo vigente. Excecao parcial, expirada ou
malformada falha fechada. `critical/high` confirmado permanece bloqueador ate
remediacao, reteste ou aceite humano excepcional documentado.

## 5. Criterios de parada e rollback

Parar imediatamente quando o preflight divergir, algum status for inesperado,
o orcamento acabar, o ZAP tiver erro operacional, o relatorio estiver
malformado ou houver `high` sem decisao valida. Nao ampliar o teste durante o
run.

Rollback de codigo: reverter os scripts, o ledger e as etapas condicionais do
workflow. A execucao nao altera producao. O cleanup da branch Neon continua
obrigatorio e nao deve ser removido como forma de diagnostico.
