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

## Acompanhamento gestacional (Fase 313)

Condição gestacional, episódio, origem da referência, peso/altura, IG, risco e
classificação são PHI. Referências e snapshots ficam cifrados no banco; não vão
para auditoria, GitHub, telemetria ou providers externos. IDs de episódios,
referências e consentimentos são derivados protegidos, mesmo sem texto clínico.
As APIs usam sessão e `private, no-store`, sem Cache Storage clínico. O portal
recebe somente a projeção autorizada após liberação e aceite específico atuais;
notas internas e fingerprints não são projetados. Termo público e tabela MS/UFS
não contêm dados de pacientes. Testes/demo usam exclusivamente fixtures sintéticas.

## Restrições alimentares (FOOD06 P1b, migration 1083)

Todo conteúdo clínico, de convicção ou texto livre é PHI e fica só em `bytea` cifrado pelo codec
`codec-conteudo-restricao.ts`, com vínculo de campo, tenant, registro, revisão e paciente: natureza, subtipo, alvo,
gravidade, observação, justificativas, pedido do paciente, explicação ao paciente, justificativa interna, desfecho,
resultado da reconfirmação e evidência de mapeamento. Não existe campo de motivação religiosa (Q4). Nada disso vai a
log, auditoria, GitHub, telemetria ou provider externo.

Metadados operacionais ficam em claro (decisão R7 da revisão da #531). São **derivados protegidos**: indicam que o
paciente tem algum registro, mas não qual restrição. Ficam sob RLS FORCE por tenant e, a partir da P2, com autorização
por carteira e permissão. Nenhum deles vai a log ou telemetria com identificador do paciente.

| Campo | Por que fica em claro | Exposição mínima |
| --- | --- | --- |
| `avaliacoes_restricoes_pacientes.situacao` (e histórico) | Constraints de confirmação e vencimento; pendência de reconfirmação sem decifrar | Só a quem pode ver a avaliação do paciente; o portal recebe texto por chave, nunca o valor |
| `restricoes_pacientes_revisoes.motivo_inativacao` | `check` do Q3 (motivo obrigatório na inativação); auditoria da transição | Vocabulário fechado de 4 valores, sem texto livre; nunca vai ao portal |
| `restricoes_pacientes.origem` | Distinguir declaração do paciente e registro da equipe (Q11) | Vocabulário fechado; o portal recebe só a chave de texto |
| `solicitacoes_restricoes_pacientes.tipo` | `check` de inclusão sem restrição e de correção/remoção com restrição | Vocabulário fechado; conteúdo do pedido cifrado |
| `reconfirmacoes_restricoes.meio` | Q10 exige registrar o meio; não revela dado clínico | Vocabulário fechado; resultado cifrado |

Isto não é parecer jurídico: a base legal, a retenção e os direitos do titular continuam no ATV-2 (Q4).
