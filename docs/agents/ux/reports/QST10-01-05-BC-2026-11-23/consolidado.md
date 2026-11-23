# Consolidação B/C e aprendizado D

|ID|Origem/superfície|Evidência e hipótese|Prioridade|Solução/complexidade/arquitetura|Estado|
|---|---|---|---|---|---|
|NUX-BC-01|Profissional/02|Hipótese; nota real distingue busca e totais|P2|Texto existente/baixa/sem nova consulta|JÁ COBERTO|
|NUX-BC-02|Profissional/03/05|Hipótese; teste confirmação inválida focaliza pendências após fechar modal|P2|Foco existente/baixa/sem persistência|JÁ COBERTO|
|PUX-BC-01|Paciente/05|Hipótese; captura e teste mostram Confirmar envio|P2|Rótulo explícito/baixa/sem contrato novo|JÁ COBERTO|
|PUX-BC-02|Paciente/05|Risco plausível; testePWA distingue salvas neste dispositivo de enviadas apósACK|P1|Estado existente da fila/baixa/sem storage novo|JÁ COBERTO|

Sem nova sugestão de produto implementada. Não há consenso fabricado: pareceres
preservam pontos distintos, encerrados proporcionalmente pelas provas existentes.
D: manter alcance visível na08; estados pendentes não equivalem a sucesso;
review modal não implica submit; histórico não será inferido por semelhança.

Revisão técnica independente /root/qst10_front_review: estática favorável01–05
até4d9fb765, inclusive bloqueiosupload/ACK. Sem novos achados concretos; não
executou testes/typecheck. Não cobre06–10, banco, produção ou clínica.

Limites: Node22.21.1, Nextlocal16.3.8 diferente do manifesto^16.4.5; CI canônico
pendente. Lint0erros+warning preexistente no efeito de carga. Leitor de tela
manual/buildcompleto/RLSlocal SKIPPED, sem fronteira de banco alterada.
