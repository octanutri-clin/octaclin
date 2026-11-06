# FOOD06 — correção delimitada do CI de imagens

HEAD40e0e80d: Trivy/run42276784044 falhou no harness das imagens backend e Web antes de produzir SARIF. apk não encontrou zlib=1.3.2-r1; índice retornou zlib1.4-r0. Falta de SARIF é consequência do build interrompido, não scanner aprovado. Não é falha funcional da M11 nem comprovação de ausência de vulnerabilidades.

Consulta HTTPS ao índice oficial Alpine3.24/main em2026-11-06 confirmou1.4-r0, licençaZlib, parax86_64 e aarch64:

- https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/APKINDEX.tar.gz — SHA256 f976c7888999de04ae70250f872ad85bdc52309d2a5e06597a77f634f912d895.
- https://dl-cdn.alpinelinux.org/alpine/v3.24/main/aarch64/APKINDEX.tar.gz — SHA256 9a6918bdad9239435f2acb887b465c2c41ce121c5a745580cde569766f913540.

Hashes identificam a coleta do índice mutável, não tornam o repositório imutável. Não foi feita verificação independente das assinaturas APK nem declaração de direitos adicionais.

Mudança mínima nos Dockerfiles backend/Web: pin1.3.2-r1→1.4-r0 na base comum existente; digestNode/Alpine preservado, sem novo pacote ou alteração de estágios/hardening. Teste do contrato atualizado primeiro:1falha funcional RED; após pins,13/13PASS em Node22.21.1. Sem waiver, desativação de scanner ou redução de severidade.

`docker build --target base -t octaclin-food06-zlib-base-test -f octaclin-backend/Dockerfile octaclin-backend` foi executado; BLOCKED por TLS server certificate not trusted no acesso APK dentro do build local. Índice antigo da imagem ainda mostra1.3.2-r0; não representa a coleta HTTPS atual do host nem pacote instalável no build. Não houve bypassTLS ou alteração de certificados/infraestrutura. Build final das imagens, harness e Trivy dependem do novo CI; não declarar PASS antecipado. Não houve deploy ou alteração de ambiente externo.

Rollback de código devolve pin indisponível e reabre o buildFAIL; não é estratégia de publicação. Se o novo pin falhar no CI, investigar o log e a disponibilidade oficial; não usar pacote inferior ou ignorar scanners.
