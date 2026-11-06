# FOOD06 M04 receitas — UX B/C

## Método e limites

Papéis PR451/0d3382b6 consultados por referência explícita; execução por instâncias
independentes m04_nutricionista_ux_final e m04_paciente_ux_final. Não seleção TOML
nativa. Leitura dos componentes e inspeção própria das capturas sintéticas desktop
e mobile, sem edição/coautoria, interação própria, pacientes reais ou ratificação
clínica. Testes foram executados pelo coordenador. Portal direto N/A: consequência
indireta sobre o plano posteriormente publicado, sem novo compartilhamento.

As imagens versionadas são da build final, após reformulação de uma frase sem
mudança funcional. As personas viram as capturas da primeira build e foram
informadas da reformulação. Não atribuir a elas execução dos testes ou inspeção
adicional da build final. O coordenador repetiu os dois cenários visuais/axe,
com ampliação de fonte200% e rolagem horizontal pelo teclado no mobile.

## Nutricionista

Pontos positivos: agrupamento de receita, versão,1,5porções, base e destino;
ingredientes com unidade/gramas e denominador dos totais. Antes/depois/diferença
com desconhecidos explícitos. A separação entre biblioteca, rascunho e publicação
está expressa. Maior fricção potencial: reconferência após26linhas e compreensão
das duas ações de confirmação. Nenhuma dupla inserção observada pelas imagens;
a proteção foi examinada no código e testada pelo coordenador.

## Paciente

Impacto indireto: clareza de planejado versus ingerido, porções ajustadas e ação
que modifica o rascunho. Botões sem corte nas capturas móveis. A coluna Diferença
fica fora da largura inicial da tabela, sem demonstração de inacessibilidade:
há região com rolagem horizontal. Leitor de tela humano não foi testado.

## Consolidação e backlog

| ID | Origem | Problema / natureza / evidência | Prioridade | Proposta e critério de aceite | Estado |
|---|---|---|---|---|---|
| RUX-01 | Ambas | Duas confirmações; a legada fica desabilitada durante comparação. Imagem/código comprovam o estado; confusão é hipótese | P2 | Explicação visível e associada ao botão sobre confirmar impacto ou descartar; acompanha o estado | BACKLOG, sem nova decisão automática |
| RUX-02 | Ambas | Contexto distante da ação final, observado nas imagens; erro de confirmação é hipótese | P2 | Resumo de receita/versão/porções/destino junto à ação, derivado da mesma proposta | BACKLOG; retoma NUX-M04-01/PUX-M04-03 do relatório anterior |
| RUX-03 | Nutricionista | Recuperação após erro exige descartar comparação para retornar ao legado; hipótese por código, não reproduzida pela persona | P2 | Orientação contextual sobre descartar, preservando porções e sem inserir dados | BACKLOG |
| RUX-04 | Paciente indireto | Tabela ultrapassa viewport mobile; rolagem existente, descoberta é hipótese de fricção | P2 | Indicação breve de rolagem, sem ocultar colunas. Coordenador comprovou rolagem pelo teclado | BACKLOG de apresentação; não é falha demonstrada de acesso |
| RUX-05 | Paciente indireto | Cartão FOOD07 usa traço para ausência com aviso coletivo, tabela usa Desconhecido; código | P3 | Padronizar nomenclatura dos cartões sem converter ausência em zero | BACKLOG; não alterar contrato FOOD07 automaticamente |

Nenhum P0/P1 demonstrado nesta avaliação. Não representa consenso de usuários
reais, aprovação clínica, R4 ou encerramento integral da FOOD06. As sugestões
não foram incorporadas automaticamente; preservar seu histórico para a próxima
fase de UX. Confirmar estados e aprovações antes de ampliar escopo.
