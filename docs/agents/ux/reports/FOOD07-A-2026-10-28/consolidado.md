# FOOD07 — consolidação das personas, etapa A

Plano avaliado: commit local9dd9bd6d. Duas instâncias reais e separadas receberam brief sintético e instruções derivadas de seus papéis, sem histórico da conversa, ferramentas ou parecer da outra persona. Relatórios separados são sínteses editoriais: [nutricionista](nutricionista.md), [paciente](paciente.md). O [manifesto](execucao.json) distingue hashes de artefatos, atividade do runtime e limitações. Sem UI executada, pessoa real ou R4 clínica/segurança. Etapas B/C não executadas; D ocorrerá ao iniciar fase futura.

## Avaliação resumida

Nutricionista: duas bases e prévia podem reduzir retrabalho, mas precisam evitar confusão entre preparo inteiro, uma porção e quantidade aplicada. Destino, importação de refeição e revisão do lote devem ser visíveis. Paciente: quantidades enviadas devem ser inequívocas, com linguagem acessível e sem exigir que ele multiplique a lista ou decida entre números contraditórios.

A matemática sintética do brief é coerente: para1/1,5/2,5porções, A125/187,5/312,5g e B50/75/125g;150/225/375kcal. Essa conferência documental é independente da avaliação clínica e não prova precisão do runtime FOOD07, que ainda não existe.

## Matriz de propostas

| ID | Origem | Funcionalidade | Problema | Evidência/hipótese/tipo | Prioridade | Solução recomendada | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NUX-01 | Nutricionista | Prévia nutricional | Total sem denominador explícito | Risco plausível; apresentação não fechada no plano | P1 | Totais para quantidade solicitada com kcal/proteína/carboidrato/gordura, denominador explícito e ausente “—”; composição100g secundária | Média | Reusar motor/contratos; não calcular ausência como zero | APROVAR |
| NUX-02 | Nutricionista | Mudar base | Reinterpretação parece simples rótulo | Risco plausível; não houve UI | P1 | Mostrar antes/depois com valores e ação “Confirmar nova interpretação” | Baixa | Sem mudar fórmula/contrato aprovado | APROVAR |
| NUX-03 | Nutricionista | Instruções | Texto500/200g pode conflitar com187,5/75g | Risco plausível reproduzido no exemplo proposto | P1 | Revisão lado a lado; considerar texto específico da cópia enviada | Média | Texto deve ser revisado/confirmado, sem AI nem reescrever biblioteca/histórico | APROVAR |
| NUX-04 | Nutricionista | Captura/aplicação | Origem/base/destino pouco explícitos | Hipótese de fricção | P1 | Nome da refeição de origem, base confirmada e destino no resumo | Baixa | Revalidar destino/posse sem inferir base | APROVAR |
| NUX-05 | Nutricionista | Lote até10 | Conferência exige reabrir receitas | Sugestão de melhoria | P2 | Uma revisão nome/modo/porções/pendência por linha, preservando outras linhas | Média | Sem aplicar parte em falha; snapshot por item | APROVAR |
| NUX-06 | Nutricionista | Reenvio/histórico | Expectativa incerta de atualização/substituição | Risco plausível de comunicação; hipótese do brief confrontada com310 | P1 sugerido; sem novo bloqueio técnico | Preservar substituição já existente, informar efeito e data/porções | Baixa | Não criar novo modo de manter ambas ativas | JÁ COBERTO (semântica); AVALIAR apresentação |
| PUX-01 | Paciente | Preparo enviado | Duas quantidades concorrentes nas instruções/lista | Risco plausível; exemplo explícito | P1 | Instruções revisadas da cópia enviada, confirmação profissional, sem exigir decisão do paciente | Média | Novo texto opcional por envio é mudança de produto, exige aprovação e snapshot/idempotência/testes próprios | APROVAR |
| PUX-02 | Paciente | Porções | Pode multiplicar a lista já ajustada | Hipótese de fricção | P2 | “Os ingredientes abaixo já estão nas quantidades para1,5porções”; rendimento original secundário | Baixa | Não muda prescrição nem dá recálculo ao paciente | APROVAR |
| PUX-03 | Paciente | Unidades | Medida e gramas parecem somáveis | Hipótese de fricção | P2 | Nome real da medida e gramas agrupados como equivalência quando confiável | Baixa | Sem conversões inventadas; aproximação textual | APROVAR |
| PUX-04 | Paciente | Retirada/substituição | Aviso antigo parece falha do app | Risco plausível | P2 | Mensagem genérica autorizada e retorno à área de receitas | Baixa/Média | Não consultar estado de recurso não autorizado para diferenciar404; detalhe só se contrato seguro permitir | AVALIAR |
| PUX-05 | Paciente | Acessibilidade numérica | Unidade/precisão/contexto podem se separar | Risco plausível, não falha visual constatada | P2 | Vírgula decimal, zeros finais dispensáveis removidos, grupo semântico, aviso textual e teclado/zoom200% | Baixa/Média | Precisão interna preservada; medir posteriormente com interface real | APROVAR |
| PUX-06 | Paciente | Entrada após login | Perde destino após autenticação | Sugestão de melhoria; caminho real não auditado nesta rodada | P2 | Auditar310; só propor retorno autenticado se gap comprovado | Incerta | Não introduzir redirect arbitrário/open redirect ou tokens na URL | BACKLOG / AVALIAR gap |

APROVAR significa recomendação do coordenador ao proprietário; **nenhuma mudança de produto acima está autorizada por este relatório**. P0: nenhum. Não há defeito de implementação FOOD07 comprovado. Itens de segurança/fonte estão propostos para testes, não aprovados por persona.

## Confronto com código atual e divergência preservada

- Em `servico-compartilhamento-receitas.ts`, novo envio imediato marca os ativos anteriores da mesma receita/paciente como `substituido`; no agendamento, `processador-compartilhamento-receitas.ts` faz isso ao ativar. O revisor nutricionista levantou dúvida de comunicação; não usar sua hipótese para alterar a política310. Conteúdo histórico imutável não significa acesso simultâneo a todas as cópias.
- `obterPortal` busca apenas share ativo do paciente e retorna404 caso contrário. PUX-04 não autoriza revelar se um ID de outro paciente existe/foi retirado. Preferir “Esta receita não está disponível. Consulte suas receitas” sem motivo específico ou identificador interno. Se houver redesign de mensagens, respeitar resposta indistinguível para recurso inacessível.
- NUX-03 aceita explorar distinguir instruções originais das quantidades ajustadas; PUX-01 considera que isso pode deixar o paciente escolhendo entre números concorrentes. Os argumentos não são idênticos. Recomendação: não escalar texto automaticamente; permitir ao profissional revisar/adaptar **somente as instruções da cópia enviada**, mantendo origem intacta e snapshot final inequívoco. Isso é uma ampliação concreta ainda para aprovação; aviso genérico sozinho não foi tratado como solução validada.
- Q1–Q3/S1–S3 continuam válidas. O paciente não recebe controle de recalcular porções; biblioteca não se torna pública, FOOD05-MDL não entra, nenhum parecer substitui fonte/validação clínica.

## Decisões concentradas para o proprietário

1. **Prévia e confirmação profissional:** adotar NUX-01/02/04/05 — totais para a quantidade solicitada, antes/depois de base e resumo do lote/destino. Reusar os serviços existentes e manter bloqueios/ausências explícitos.
2. **Modo de preparo da cópia enviada:** aprovar campo de instruções específico do envio personalizado, pré-preenchido com original, revisado pelo profissional e congelado no envio, sem alterar biblioteca. Sem ajuste automático de números no texto. Exigirá estender fingerprint do conteúdo, comparação idempotente e snapshot do envio no plano antes de implementar.
3. **Apresentação paciente:** adotar PUX-02/03/05 e mensagem genérica segura dePUX-04; manter o auditável fluxo310. PUX-06 fica backlog condicionado à auditoria de gap, sem alteração automática de login.

Não pedir ao proprietário decisões sobre parser, hashes ou arquivos. Os grupos acima mudam/fecham experiência de produto e devem ser respondidos antes de alterar a implementação/plano autorizado FOOD07.

## Continuidade A/B/C/D

| Etapa | Estado neste piloto | Próximo critério |
| --- | --- | --- |
| A | Duas avaliações concluídas, consolidação pronta; decisões humanas PENDENTES | Registrar resposta do proprietário e só então alterar plano FOOD07 em sua branch própria |
| B | NOT RUN — não existe interface FOOD07 | Aplicar cenários1/1,5/2,5, origem/base/destino e instruções na primeira integração real; guardar evidência real |
| C | NOT RUN — não há implementação/CI FOOD07 | Reavaliar os itens prioritários após testes, citar HEAD e manter backlog fora do escopo |
| D | Procedimento versionado, não um teste já executado | Ao iniciar próxima fase, ler este consolidado e decisões/backlog relevantes |

Os artefatos do planejamentoFOOD07 não foram alterados nesta branch. A infraestrutura de agentes tem PR própria; ativação permanente nos demais checkouts depende da integração autorizada desses arquivos. Não houve merge, deploy, migrations ou acesso operacional aos provedores nesta tarefa.
