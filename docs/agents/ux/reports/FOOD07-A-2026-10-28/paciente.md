# FOOD07 A — avaliação octaclin-paciente-ux

Revisor: subagente real `/root/octaclin_paciente_ux`, instância nova sem histórico nem parecer do nutricionista. Modalidade: runtime com instruções do papel fornecidas; seleção nativa automática de TOML não exercitada. Apenas plano9dd9bd6d resumido no brief e cenários sintéticos. Nenhuma ferramenta/tela/interação/leitor de tela/pessoa real. **Síntese editorial do coordenador** dos seis achados; original na trilha do retorno da instância. Não é validação clínica, científica, jurídica ou pesquisa humana.

## Pontos positivos e dúvidas

Quantidades enviadas distintas do rendimento original, cópia preservada, ausência de conversão inventada e metadados internos protegidos são adequados. Na simulação mobile, dúvidas centrais: “a lista já está para1,5porção ou multiplico de novo?”, “qual número vale no preparo?” e “qual receita recebida está disponível?”. Autonomia não exige recalcular a prescrição.

## Achados completos

### PUX-01 — texto contra lista, P1

Cenário/objetivo: cozinhar1,5porção consultando receita rapidamente. Proposto: lista187,5g/75g e texto original500g/200g, a ser revisado pelo profissional. Dificuldade/impacto: ambos parecem instruções válidas; preparo diferente e interrupção. Tipo: **risco plausível que exige teste**; divergência sintética está no brief, efeito real não testado. Sugestão: revisão na confirmação com adequação das instruções para a cópia; se mantidas, definir referência pública inequívoca, sem delegar ao paciente a escolha entre números. Aceite: cópia final não apresenta números antigos como igualmente aplicáveis às quantidades ajustadas. P1 pela tarefa central de preparo, sem fundamento para P0.

### PUX-02 — porções e rendimento, P2

Cenário/objetivo: iniciante consulta no trabalho “1,5porções” e “rendimento original4”. Proposto: dois títulos separados. Dificuldade/impacto: pode multiplicar a lista outra vez ou pensar que ainda rende4. Tipo: **hipótese de fricção**, apresentação ainda aberta. Sugestão: “Os ingredientes abaixo já estão nas quantidades para1,5porções”, com rendimento original secundário e omitido quando desconhecido. Aceite: mesma explicação para1/1,5/2,5 e para base por porção sem rendimento conhecido; entendimento deve ser avaliado posteriormente com evidência real.

### PUX-03 — medida e gramas, P2

Cenário/objetivo: reconhecer1,5medidas e187,5g como representações equivalentes quando cadastradas. Proposto: escala de quantidade/peso sem inventar conversão. Dificuldade/impacto: campos separados podem parecer somáveis. Tipo: **hipótese de fricção**. Sugestão: “1,5medidas (187,5g)” no mesmo grupo com nome real da medida; ausente não ganha conversão. Aceite: equivalência confiável e aproximação textual junto ao número; nenhum valor doméstico estimado.

### PUX-04 — reenvio/retirada, P2

Cenário/objetivo: abrir aviso antigo após mudança de acesso e reconhecer orientação atual. Proposto: nova cópia/regras310 ou retirada. Dificuldade/impacto: não entender indisponibilidade ou confundir recebimentos. Tipo: **risco plausível que exige teste**, mensagens não definidas. Sugestão: data/identificação pública e mensagem neutra de indisponibilidade, caminho para área de receitas. Aceite: não expor conteúdo retirado, status de outro paciente nem IDs internos. Diferenciar substituído/retirado só se o backend puder autorizar essa informação; restrição apontada pelo coordenador.

### PUX-05 — precisão acessível, P2

Cenário/objetivo: em cenários separados, leitor de tela e texto ampliado durante preparo. Proposto: até3decimais e aproximação. Dificuldade/impacto: número separado da unidade, ícone sem texto e contexto distante prejudicam compreensão. Tipo: **risco plausível que exige teste**, não defeito observado. Sugestão: grupo semântico ingrediente/número/unidade, vírgula pt-BR, zeros finais dispensáveis removidos, aproximação textual. Aceite posterior: leitura coerente “A,187,5gramas”, teclado e conteúdo preservado a200%zoom; não declarar esses testes executados agora.

### PUX-06 — continuidade após login, P2

Cenário/objetivo: receber aviso rapidamente, autenticar e encontrar o conteúdo. Proposto: aviso genérico e portal protegido. Dificuldade/impacto: destino após autenticação não detalhado, procura/abandono. Tipo: **sugestão de melhoria**. Sugestão: preservar destino autorizado, mostrar nome/data depois de autenticar; indisponibilidade conformePUX-04. Aceite: acesso direto ou após login chega ao mesmo conteúdo autorizado, sem expor informação no aviso nem conteúdo retirado. Auditá-lo na310 antes de propor mudança; não implementar fluxo de autenticação nesta fase por inferência.

## Cobertura e limites

Preservação de envios, ausência de recálculo pelo paciente, autorização, aviso genérico e bloqueio de conversões inventadas já estão no plano. Dados nutricionais eventualmente mostrados ao paciente precisam denominador explícito, mas não foi proposta uma nova prescrição/autonomia de cálculo. Não houve contagem de cliques, pesquisa com pacientes, teste visual ou validação clínica. Sem achado P0.
