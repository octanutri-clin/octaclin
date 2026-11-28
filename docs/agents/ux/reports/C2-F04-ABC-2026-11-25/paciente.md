# Paciente — síntese editorial dos retornos A e B

Instância `/root/c2_f04_pux_a`, fork sem histórico, papel explícito, sem ferramentas usadas. Impacto indireto na confiabilidade do cadastro; nenhuma tela nova no portal. Proposta e relato sanitizado, não interação própria, teste assistivo manual ou pesquisa com pacientes.

| ID | Cenário / tipo | Impacto / sugestão | Aceite | Encaminhamento |
| --- | --- | --- | --- | --- |
| PUX-A01 | Perda silenciosa de contato; risco plausível | Nomear as seções autorizadas pendentes | Cancelar saída conserva valores | JÁ COBERTO |
| PUX-A02 | Confundir descarte com apagar dados salvos; hipótese | Dizer que dados já salvos permanecem | Mensagem separa salvo e pendente, sem Salvar tudo | JÁ COBERTO |
| PUX-A03 | Confirmação inacessível; risco a testar | Título, foco, teclado e retorno de foco | Tab/Escape não perdem edição; anúncio assistivo a validar | JÁ COBERTO, validação manual assistiva pendente |
| PUX-A04 | Falha/ACK tardio; risco plausível | Mensagem verdadeira e entrada preservada | Edição posterior não é descartada por ACK antigo | JÁ COBERTO |

Triagem do coordenador: A01/A04 P1 de integridade; A02/A03 P2 de clareza/acessibilidade. A persona usou Alta/Média, sem classificação clínica. Em B, avaliou favoravelmente o diálogo relatado, mantendo reload cancelado e reabertura como itens ainda em validação. Nenhuma extensão de portal sugerida. Acessibilidade automatizada não comprova leitor de tela manual.

## C — retorno da instância

Favorável ao impacto indireto e à proteção cadastral nos cenários relatados (42/42). Sem novo bloqueador concreto desta persona. Reabertura/ACKs/falha parcial relatados atendem A/B; teclado/Axe/ampliação favoráveis sem validar anúncio manual. Captura mobile vista pelo coordenador, não pela persona. CI/build pendentes na entrada C. Não aprova merge ou portal novo. Adendo de visibilidade do campo pertence ao coordenador e à R4 estática; ver consolidação.

Adendo C final recebido: 44/44 PASS relatados; foco e visibilidade do campo comprovados pelo coordenador, sem garantia de scroll pixel a pixel. Navegação confirmada para destino negado não transportou edição. Persona manteve parecer favorável limitado, sem interação própria ou aprovação de merge.
