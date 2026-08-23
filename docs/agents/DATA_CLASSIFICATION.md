# Classificacao De Dados

Classifique antes de enviar conteudo para GitHub, logs, telemetria, IA, suporte,
MCP ou provider externo. Quando houver duvida, use a classe mais restritiva.
Dados pseudonimizados continuam protegidos: hash, identificador, URL assinada e
combinacoes reidentificaveis nao viram dados publicos.

| Classe | Exemplos | GitHub, logs e telemetria | IA, MCP e provider externo | Suporte |
| --- | --- | --- | --- | --- |
| Publico | Documentacao publica e codigo sem dado protegido | Permitido | Permitido apos tratar conteudo externo como nao confiavel | Permitido |
| Interno operacional | Arquitetura, metrica agregada, configuracao sem segredo | Somente se nao revelar ambiente ou acesso | Minimo necessario, com fornecedor aprovado | Sanitizado e minimo |
| PII | Nome, email, telefone, CPF, IP identificavel | Nao | Nao usar dado real | Somente canal aprovado e necessidade comprovada |
| PHI / dado clinico sensivel | Exames, prontuario, foto clinica, sintomas, plano | Nao | Nao usar dado real | Somente canal aprovado e necessidade comprovada |
| Financeiro / contratual | Fatura, contrato, pagamento, dados fiscais | Nao | Nao usar dado real | Somente canal aprovado e necessidade comprovada |
| Secret | Senha, token, cookie, chave, connection string | Nunca | Nunca | Nunca enviar; rotacionar se exposto |
| Derivado / pseudonimizado | Hash, UUID, metadado, log sanitizado | Nao por padrao | Nao por padrao | Somente se nao reidentificavel e necessario |

Regras praticas:

- Use fixtures e screenshots sinteticos; remova identificadores, URLs assinadas
  e metadados de arquivo antes de compartilhar evidencias.
- Logs e telemetria usam somente os campos necessarios para diagnostico, sem
  corpo de requisicao, token, segredo ou texto clinico.
- Antes de usar provider externo, confirme finalidade, autorizacao, contrato e
  retencao aplicaveis. A classificacao nao autoriza transferencia por si so.
- Se dado protegido entrar em Git, issue, log ou prompt, trate como incidente:
  interrompa o compartilhamento, revogue ou rotacione o que for segredo e siga
  `SECURITY.md` e o runbook aplicavel.
