# Parecer NUX — FOOD06 P3-6, etapa B

Instância distinta do runtime desta sessão, com o papel `octaclin-nutricionista-ux` fornecido como prompt (sha256 `6259b40a…af6d`),
0 chamadas de ferramenta, sem ver o parecer da outra persona. Transcrição editorial fiel do parecer entregue.

**Contexto e limitações.** Só texto renderizado e observação visual descrita; sem tela, leitor de tela ou pessoas; BFF simulado.
Cenários: (A) titular de clínica que delega antes de férias; (B) autônomo iniciante que cadastra a mãe de um adolescente na
consulta; (C) colaboradora com carteira delegada, no celular, alternando pacientes.

**Pontos positivos.** Textos claros sobre abrangência e limite da delegação; confirmação em toda ação de dar ou tirar acesso com
saída neutra; registro só depois de escolher como conferiu; "não encontrado" único com próximo passo; foco no campo inválido;
mensagem clara para quem não é titular.

| ID | Prioridade | Achado | Sugestão / aceite |
| --- | --- | --- | --- |
| NUX-01 | P1 | A página de representantes não mostra o nome do paciente; risco de registrar no prontuário errado | Nome do paciente no cabeçalho e no texto da ação. Aceite: a 320 px, o nome aparece sem rolar e no botão de registrar |
| NUX-02 | P2 | Conta mascarada mesmo depois de digitar o e-mail completo; não dá para conferir digitação | Repetir no cliente o valor digitado ("Você buscou"), sem mudar a resposta do servidor |
| NUX-03 | P2 | Contas mascaradas parecidas difíceis de distinguir ao remover | Diferenciador (verificação e data) também na confirmação |
| NUX-04 | P2 | 409 mistura "mudou" e "limite" | Separar os casos; manter o e-mail ao recarregar |
| NUX-05 | P2 | Cota no meio da consulta, sem prazo | Tempo aproximado, e-mail mantido no campo, opção de registrar depois |
| NUX-06 | P2 | "Outro" sem complemento enfraquece o registro | Descrição curta obrigatória com "Outro" |
| NUX-07 | P2 | Botão desabilitado sem explicação | Motivo visível e associado ao botão, ou validar no envio |
| NUX-08 | P2 | Delegação difícil de encontrar (só pela página de representantes) | Atalho na área da conta para o titular, em até 2 cliques |
| NUX-09 | P2 | Ao remover delegação, não diz o que acontece com pendências da colaboradora | Mostrar quantidade e destino das pendências |
| NUX-10 | P2/P3 | Estados não descritos no brief: sem colaboradores, sucesso, lista longa | Definir textos; vazio explica como convidar |

**Oportunidades.** Voltar ao prontuário depois de registrar; manter o e-mail após falha; titular ver quem da equipe adicionou cada
representante.

**Perguntas.** (1) O nome do paciente aparece no desktop? (2) A delegação deve ficar acessível com a área do portal desligada?
(3) Há feedback depois de registrar? (4) A cota da clínica é compartilhada em tempo real?

**Conclusão.** Fluxo seguro e bem escrito; sem P0. Resolver NUX-01 e testar NUX-03, 05 e 07 antes de ligar a flag.
