# FOOD06 P3, etapa A — persona paciente (PUX)

**Síntese editorial do coordenador** a partir do retorno da instância; preserva IDs, prioridades, tipos e aceites. Etapa A, só plano,
base `91241b1`, entrada: `brief.md` (partes comum e do paciente). Persona fictícia: não é paciente real, teste visual, leitor de
tela, validação clínica nem pesquisa com pessoas.

## Pontos positivos

Estado em texto e não só cor; vazio que evita falsa segurança sem culpa; falha de rede que não afirma sucesso; nome da pessoa
selecionada no topo e em cada confirmação; estados dos pedidos em linguagem simples com a explicação da equipe; paciente pede
correção em vez de alterar.

## Dúvidas prováveis

Diferença entre alergia e intolerância; "você evita" na tela do filho; pedido de outra pessoa sem botão de cancelar; o que fazer
enquanto a informação errada "continua valendo".

## Achados

| ID | Prio. | Tipo | Cenário / problema | Sugestão | Aceite verificável |
| --- | --- | --- | --- | --- | --- |
| PUX-01 | P1 | Risco plausível (exige validação clínica) | "Até lá, siga as orientações que você já recebeu" pode ser lido como "pode continuar comendo" um alimento recém-informado | Texto definido pela clínica e pelo jurídico; ex.: "Em caso de dúvida ou de sintomas, fale com quem faz seu acompanhamento" | Texto aprovado na validação clínica e entendido no teste de compreensão |
| PUX-02 | P2 | Hipótese de fricção | Representante lê "seu acompanhamento" na tela da mãe | Trocar o pronome pelo nome da pessoa | Representantes identificam de quem é cada tela e envio |
| PUX-03 | P2 | Risco plausível | Selo "por você" atribui a quem não fez; "Cancelar" some sem explicação em pedido alheio | Selo neutro; "Pedidos sobre {nome}"; "Pedido feito por outra pessoa que acompanha {nome}" | Nenhum texto atribui envio a quem não fez; falta do botão explicada |
| PUX-04 | P2 | Hipótese de fricção | Rita não sabe classificar "passa mal com leite" | Ajuda curta por opção e "Não sei dizer"; rótulo visível e exemplo | Quem não sabe classificar envia sem escolher ao acaso |
| PUX-05 | P2 | Risco plausível | Erro que mistura conflito e limite; texto perdido ao recarregar | Mensagens separadas; preservar o texto digitado | Cada causa com sua ação; texto sobrevive ao erro |
| PUX-06 | P2 | Risco plausível | "Cancelar" × "Sim" na confirmação de cancelar | "Sim, cancelar pedido" / "Não, manter pedido"; foco no que não destrói | Rótulos fazem sentido fora de contexto |
| PUX-07 | P2 | Sugestão | Selos longos repetidos cansam e confundem pendente com confirmado | Selos curtos + legenda única; confirmados antes dos pendentes | Quem só passa os olhos distingue confirmados de pendentes |
| PUX-08 | P3 | Hipótese de fricção | "Você é representante" pouco claro | "Você acompanha como responsável" | — |

Acessibilidade: anunciar troca de pessoa e levar o foco ao início; grupos como títulos navegáveis e itens em lista com o selo no nome
acessível; contador anunciado perto do limite; links descritivos ("Informar uma restrição para {nome}"); data só quando houver;
erros e confirmações anunciados com foco; 400% sem rolagem horizontal.

Perguntas: mostrar gravidade (a persona tende a não mostrar); "equipe de atendimento" × "seu atendimento" (sugere "quem faz seu
acompanhamento"); aviso ao paciente quando um pedido for decidido.

Conclusão da persona: um P1 (PUX-01) dependente de validação clínica; demais P2 resolvidos com texto testável; sem P0.
