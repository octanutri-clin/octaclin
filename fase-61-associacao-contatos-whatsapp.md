# Fase 61 - Associacao manual de contatos WhatsApp

## Objetivo

Permitir que a equipe vincule uma conversa WhatsApp sem paciente a um paciente existente, tornando a inbox operavel mesmo quando o telefone recebido nao bate automaticamente com o cadastro.

## Implementacao

- Backend adicionou `POST /comunicacoes/whatsapp/associar-contato`.
- A associacao recebe:
  - contato WhatsApp;
  - paciente;
  - opcao para salvar o telefone no cadastro do paciente quando o contato ainda estiver vazio.
- O backend normaliza telefone por digitos e atualiza mensagens WhatsApp recentes do mesmo contato.
- Mensagens atualizadas recebem:
  - `pacienteId`;
  - `payload.contatoAssociadoManualmente`;
  - `payload.contatoAssociadoEm`.
- A acao registra auditoria `comunicacoes.whatsapp.associar_contato`.
- A API BFF do web encaminha `/api/comunicacoes/whatsapp/associar-contato`.
- A Inbox WhatsApp exibe o bloco de associacao quando a conversa selecionada ainda nao tem paciente.
- Depois de associar, a tela recarrega a inbox e a conversa passa a aparecer agrupada pelo paciente.

## Validacao

- `pnpm exec jest --runInBand src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts`: passou.
- Backend `pnpm typecheck`: passou.
- Web `pnpm typecheck`: passou.
- Web `pnpm build`: passou.

## Proximo passo

Publicar em staging e validar com uma conversa sem paciente:

1. abrir `/comunicacoes`;
2. selecionar uma conversa WhatsApp sem vinculo;
3. escolher o paciente;
4. manter ou desmarcar a opcao de salvar telefone no paciente;
5. clicar em `Associar`;
6. confirmar que a conversa passa a aparecer com o nome do paciente.
