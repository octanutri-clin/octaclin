# Parecer NUX — FOOD06 P3-3, etapa B

Instância distinta do runtime desta sessão, com o papel `octaclin-nutricionista-ux` fornecido como prompt (sha256 `6259b40a…af6d`),
0 chamadas de ferramenta, sem ver o parecer da outra persona. Transcrição editorial fiel do parecer entregue.

**Contexto e limitações.** Texto renderizado no celular (profissional e colaborador), observação visual descrita e os estados 409,
incerto, conferência iniciada e área desligada. Sem tela, leitor de tela ou pessoas; BFF simulado.

**Pontos positivos.** Registrar e confirmar separados e explicados; aviso "não gera alerta automático" no topo; diálogos repetem tipo
e alimento; justificativa obrigatória com erro claro; origem visível ajuda a priorizar; registro incerto não duplica; 409 recarrega e
pede nova conferência; colaborador avisado de que vê só os próprios.

| ID | Prioridade | Achado | Sugestão / aceite |
| --- | --- | --- | --- |
| NUX-01 | P1 | Item "Não sei dizer" aparece e é confirmado como "Outra restrição clínica": informação contraditória | Não usar o rótulo do tipo como fato no cartão e no diálogo; dizer que tipo e gravidade seguem não informados |
| NUX-02 | P2 | Diálogo de confirmar omite gravidade, origem e observação | Repetir os três no diálogo |
| NUX-03 | P1 | Conferência geral pode parecer concluída com itens pendentes; ajuda abstrata | Mostrar quantos pendentes no bloco; explicar o efeito de iniciar |
| NUX-04 | P2 | Registro duplicado ou parecido sem aviso (texto livre) | Aviso não bloqueante a quem tem permissão clínica; nada ao colaborador |
| NUX-05 | P2 | Formulário só no fim da aba | Atalho no topo com foco no formulário |
| NUX-06 | P2 | Aba pouco encontrável (fileira rolável) | Contagem de pendentes na aba ou visível sem rolar |
| NUX-07 | P1 | Perda da justificativa no 409; mensagem junta "mudou" e "limite" | Preservar o texto, identificar o item, separar as causas |
| NUX-08 | P2 | Gravidade escondida ao trocar para escolha | Nunca gravar escolha com gravidade |
| NUX-09 | P2 | Sem quem confirmou e quando; sem autor do registro | Mostrar dentro do que a permissão permite |
| NUX-10 | P3 | Confirmar e Rejeitar lado a lado no celular | Área de toque e espaçamento |
| NUX-11 | P3 | Inativas e rejeitadas juntas, sem motivo | Mostrar o motivo no cartão |

**Oportunidades.** Resumo no topo ("2 pendentes · 1 grave"); ordenar pendentes por gravidade.

**Perguntas.** (1) Iniciar a conferência com pendentes é permitido e o que fica registrado? (2) O colaborador vê a decisão sobre os
próprios registros? (3) No 409 e no incerto o texto é mantido?

**Conclusão.** Jornada coerente; sem P0. Testar NUX-01, 03 e 07 antes de ligar a flag.
