# QST-P05 — UX A, planejamento

Persona profissional fictícia, instância independente da escrita
`/root/qst_p04_ux_a`, retomada com papel explícito. Fonte persistente:
`.codex/agents/octaclin-nutricionista-ux.toml`. Sem interface nova examinada,
execução de testes própria ou validação com pessoas reais. Brief foi o escopo
ratificado pelo proprietário e o primeiro incremento de domínio ainda sem UI.

| ID | Cenário/objetivo | Hipótese e impacto | Sugestão e aceite | Prioridade/estado |
| --- | --- | --- | --- | --- |
| NUX-P05-01 | Duplicar durante consulta com edição pendente | Botão desabilitado sem explicação parece falha | Mensagem visível “Salve as alterações para duplicar esta pergunta”; motivos específicos para gravação/publicado/arquivado, acessíveis sem clicar no botão | P1 / AVALIAR na implementação de UI aprovada; execução pendente |
| NUX-P05-02 | Trabalhar na cópia após confirmar | Perder localização ou alterar original | Inserir após origem, selecionar cópia e focar enunciado; em falha manter estado original sem cópia parcial | P1 / JÁ COBERTO no planejamento; provas UI/DB pendentes |
| NUX-P05-03 | Adaptar configurações/opções | Cópia compartilhar referência, identidade clínica ou biblioteca | Novas identidades, objetos independentes, sem chave clínica e biblioteca; editar cópia sem alterar original | P1 / domínio testado; integração pendente |

Dúvida técnica registrada: mudança da versão salva entre leitura e confirmação.
Exigir revisão exata e não copiar silenciosamente outra versão. Não é novo
requisito clínico. Sugestões não mudam o escopo aprovado automaticamente.

Paciente N/A: preparação de perguntas no rascunho profissional; não altera
preenchimento do portal nem envios anteriores. B/C obrigatórias na primeira
interface e antes do aceite; D registrará aprendizados depois das provas.
