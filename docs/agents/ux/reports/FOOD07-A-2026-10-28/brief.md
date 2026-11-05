# FOOD07 — brief sintético para os dois revisores, etapa A

Fonte: plano FOOD07 do commit local9dd9bd6d, branch docs/pos320-food07-planning. Nenhuma implementação/tela executável FOOD07. Leitura documental; passos são simulação, não métricas observadas. Nenhuma pessoa real, dado de paciente, segredo ou conta. Autorizações desta revisão abrangem processo e avaliação, não alteração do produto, clínica ou runtime. Decisões do proprietário abaixo estão aprovadas; propor melhorias sem as reverter por preferência.

## Contratos aprovados e desenho proposto

- Biblioteca existente tem receitas pessoais/clínica, categorias livres, alimentos/quantidades/unidades/pesos e instruções, edição com versão esperada e compartilhamento de cópia fixa (Fases234/310). Alterar biblioteca não altera planos nem envios anteriores. Portal autenticado e avisos externos genéricos; retirada esconde acesso conforme310.
- FOOD07 inclui tags internas, rendimento total de preparo em porções e tempo total opcionais; filtro categoria/tipo/escopo/tag e paginação completa. Tags não saem ao portal nem em mensagens externas.
- Ingredientes cadastrados com base explícita “receita inteira” ou “por porção”. Receita inteira requer rendimento total para calcular frações; por porção usa fator porções solicitadas, sem dividir novamente pelo rendimento total. Dados antigos sem base não são inferidos: opção de inserir/enviar quantidades cadastradas, sem escala.
- Aplicação ao plano e envio ao paciente podem escolher porções fracionárias (até3casas). Cálculo no backend, prévia e confirmação obrigatórios. Cada receita do lote de até10 pode ter porções diferentes e modo personalizado ou quantidades cadastradas.
- Proposta de limites técnicos: rendimento total inteiro1–1000; porções desejadas0,001–1000; tempo total inteiro1–10080min. Quantidades e pesos do alimento/aplicação0,001–10.000, até3casas; arredondar uma vez half-up, mostrar aproximação. Fora dos limites ou arredondado para0 bloqueia confirmação inteira e aponta linha, sem ajuste silencioso/clamp. Sem dado obrigatório, não inventar. Limites técnicos não são adequação clínica.
- Trocar base de uma receita preenchida propõe confirmação para reinterpretar valores atuais sem conversão automática. Texto das instruções e tempo NÃO são multiplicados: profissional deve revisar instruções. Campos/concentrações por100g não são multiplicados; os totais nutricionais são recalculados pelo motor sobre os pesos efetivos. Fase234 já tem catálogo/composição; sem nova tabela alimentar ou equivalência FOOD05.
- Editor: escolher receita/destino, prévia, confirmar e inserir itens no formulário; autosave60s/ACK/posse entre abas permanece. Nova receita pode ser criada a partir dos itens de uma refeição atual, cuja base não pode ser adivinhada. Cancelar não escreve. Reconfirmar se fonte/versão mudou; não alterar rascunho do profissional por resposta tardia.
- Envio personalizado: nova confirmação revalida receita/paciente/acesso/versão e porção; guarda cópia fixa das quantidades e parâmetros. Mesma chave idempotente com porção diferente é recusada; edição depois exige novo envio explícito. Envio agendado congela na confirmação e não recalcula no disparo. Na interface do paciente, não usar os termos snapshot, CAS, fingerprint como explicação.
- Portal mostra “Quantidades para X porções” separado de “Rendimento da preparação original”, se conhecido; instruções originais não são recalculadas. Só os dados públicos autorizados; tags, hashes/contexto interno não aparecem. Histórico enviado antigo continua igual e não é completado usando biblioteca atual.
- UI ainda NÃO está desenhada/implementada; estimativas de cliques e dificuldades devem ser rotuladas hipóteses. Código atual, consultado pelo coordenador: biblioteca receita tem edição, categoria, instruções e salva a partir da refeição; portal exibe instruções/quantidade/unidade da cópia recebida. Fonte de avaliação: plano, não experiência real.

## Cenários numéricos sintéticos (mesmo alimento/preparo, sem prescrição)

Receita fictícia “Mistura exemplo”, base inteira rende4porções, contém alimentoA500g e alimentoB200g. Base alternativa “por porção” contémA125g e B50g, rendimento total opcional4.

| Porções desejadas | Fator da base inteira | A/B efetivos (g) | Fator da base por porção |
| --- | --- | --- | --- |
|1|1/4|125 /50|1|
|1,5|3/8|187,5 /75|1,5|
|2,5|5/8|312,5 /125|2,5|

Unidade fictícia cadastrada confiável para A:1medida=125g. Assim A1/1,5/2,5medidas corresponde a125/187,5/312,5g. Não inferir densidade ou unidade doméstica se o cadastro não fornecer. Texto fictício de instrução “Misture500g de A com200g de B”; tempo20min. Avaliar a compreensão quando o envio for1,5porção, mas esse texto original permanecer. Paciente prepara/comparte? Não inferir público/família; levantar dúvida se pertinente.

Para verificar somente matemática, composição sintética A por100g:100kcal,10gproteína,10gcarboidrato,2ggordura; B:50kcal,2gproteína,8gcarboidrato,1ggordura. Totais para1/1,5/2,5porções:150/225/375kcal;13,5/20,25/33,75gproteína;16,5/24,75/41,25gcarboidrato;3/4,5/7,5ggordura. Só exemplos de interface, não recomendação alimentar. Esses números não provam qualidade clínica; a UI nutricional da prévia ainda precisa ser especificada/validada.

## Solicitação

Nutricionista: simular cadastro/edição/base, prévia e consulta corrida, aplicar plano, enviar receita personalizada, reenvio/retirada e localização. Paciente: simular aviso/entrada/receita no celular e preparo, interpretar1/1,5/2,5porções, diferenças entre rendimento original e enviado, unidades, instruções, envio antigo/substituído/retirado e acessibilidade. Considerar perfis variados sem estereótipos.

Cada um entrega parecer independente sem ver o outro, com achados completos, tipo/impacto/P0–P3/aceite específico, pontos positivos e limites. Sem ferramentas nem edição. Problemas já atendidos pelo plano podem ser JÁ COBERTO; hipóteses não viram defeitos observados. Não inventar teste visual, credenciais clínicas ou pesquisa real.
