# Nutricionista — síntese editorial dos retornos A e B

Instância `/root/c2_f04_nux_a`, fork sem histórico, papel explícito. Nenhuma ferramenta usada pelo revisor. A: proposta; B: relato sanitizado de execução e captura vista pelo coordenador, sem inspeção/interação própria da persona. Não é pesquisa com profissionais reais nem R4.

| ID | Cenário / tipo | Impacto / recomendação | Aceite | Encaminhamento |
| --- | --- | --- | --- | --- |
| NUX-A01 | Consulta corrida; hipótese de descarte acidental | Ação segura inicial e lista de seções pendentes | Fechar/Escape/link concordam; continuar preserva entrada | JÁ COBERTO no plano; testar F04 |
| NUX-A02 | Falha parcial nas duas escritas de identificação; risco plausível | Informar o que foi confirmado e o que não foi | Nome/data confirmados não são reapresentados antigos; pendência restante preservada | JÁ COBERTO, refinamento técnico de reabertura em validação |
| NUX-A03 | Edição após envio; risco plausível | ACK não deve aparentar salvar edição posterior | Enviar A, editar B, confirmar A deixa B pendente | JÁ COBERTO; caso browser específico |
| NUX-A04 | Retomar consulta após cancelar saída; hipótese de fricção | Retornar foco e rolagem ao ponto anterior | Campo e contexto preservados ao continuar | JÁ COBERTO no escopo de acessibilidade |

O retorno usou prioridades Alta/Média; triagem do coordenador: integridade A02/A03 P1, clareza/retomada A01/A04 P2. Não há novo requisito de produto automaticamente aceito. B considerou favorável a distinção entre pendente/salvo e pediu provas específicas de ACK, retorno de foco e reabertura, sem presumir resultados não informados.

Positivos: confirmação contextual, ausência de save global enganoso e manutenção de entrada após falha. Oportunidade de produtividade: retomar o campo sem refazer a edição. Nenhuma automação clínica proposta.

## C — retorno da instância

Favorável dentro do escopo relatado da F04. A01/A02/A03 atendidos; A04 favorável no cenário de retorno ao campo. Base: relato do coordenador da rodada 42/42 e evidências específicas, sem execução própria. CI/build e leitor de tela manual não comprovados. Não aprova merge nem amplia escopo. Posteriormente o coordenador acrescentou prova explícita de presença do campo no viewport: foco DOM isolado não comprova visibilidade; ver adendo final no consolidado.

Adendo C final recebido: 44/44 PASS relatados; foco e visibilidade do campo comprovados pelo coordenador, sem garantia de scroll pixel a pixel. Navegação confirmada para destino negado não transportou edição. Persona manteve parecer favorável limitado, sem interação própria ou aprovação de merge.
