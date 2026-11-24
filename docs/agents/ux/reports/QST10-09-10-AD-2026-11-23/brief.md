# Brief A/D — entregas09 e10

Versão1 de planejamento; domínio09db4dbbc,08#59070deb06. Oito implementações
emPRs583–590, não oito merges. Nenhuma interface09/10nova foi apresentada.

09: listar/pausar/retomar com confirmação/CAS; preservar envios, links e rascunhos;
retomar só ocorrência futura, sem catch-up. Decisão D09-01 aprovada pelo dono:
antigos sem ator comprovável aguardam reconfirmação individual autorizada antes
de gerar novos envios; novos guardam ator e o worker revalida seu acesso. Não
inventar autoria, confundir autorização com estado operacional, desfazer pausa
ou reativar encerrado por simples reconfirmação. Sem novos canais/notificações,
reconfirmação em lote, ediçãoCron ou exclusão. Reutilizar auth/auditoria/cron.

10: comparação profissional de2retornos mesmo paciente/questionário; seleção
em memória entre páginas, limpa em contexto novo. IDs estáveis e snapshots reais;
sem definição histórica não inferir atual. Distinguir ausência/incompatibilidade,
preservar zero/falso; delta neutro, semdiagnóstico. Mudanças relevantes impedem
cálculo; mudanças visuais não. UI desktop/mobile, anexos autorizados existentes,
sem marcar revisado, modificar histórico ou criar relatório/portal novos.

Cenários sintéticos: pessoa da equipe regulariza agendamento legado pausado;
envio único passado; paciente continua formulário/rascunho anterior; profissional
seleciona retornos em páginas diferentes com ausência/mudança de unidade.

Modalidade: duas instâncias independentes do runtime com papel porprompt, sem
seleção nativaTOML comprovada. Só brief, sem ferramentas/dados reais/telas/medições.
Plano/tipos não são teste clínico, de segurança, humano, visual ou acessibilidade.
Sugestões não autorizam novo produto, merge/deploy/migrations. Avaliações B/C
aguardam interface real; R4 e testes técnicos são gates separados.
