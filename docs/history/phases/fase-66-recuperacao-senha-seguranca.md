# Fase 66 - Recuperacao de senha e seguranca

## Entregue

- Criado o fluxo publico de recuperacao de senha sem enumerar contas.
- Adicionada a tabela `tokens_redefinicao_senha` com token em hash SHA-256, expiracao de 1 hora e uso unico.
- Adicionados endpoints:
  - `POST /auth/recuperar-senha`
  - `POST /auth/recuperar-senha/validar`
  - `POST /auth/redefinir-senha`
- Adicionado envio de e-mail com link de redefinicao usando o adaptador de e-mail existente.
- Adicionadas telas web:
  - `/esqueci-senha`
  - `/recuperar-senha?token=...`
- Adicionado link "Esqueci minha senha" na tela de login operacional.

## Decisoes de seguranca

- A resposta de solicitacao e sempre generica: `Se os dados estiverem corretos, enviaremos um link de redefinicao de senha.`
- O token real nunca e persistido, apenas seu hash.
- Token usado, expirado ou revogado nao pode ser reutilizado.
- A nova senha exige no minimo 8 caracteres.
- Falha de SMTP/Gmail nao revela existencia de conta para o usuario; o erro fica registrado no payload do token para auditoria operacional.

## Variaveis relevantes

- `OCTACLIN_WEB_URL`: URL usada pelo backend para montar o link de redefinicao.
- `EXPOR_LINK_RECUPERACAO_SENHA`: quando `true`, retorna o link na resposta para homologacao. Em producao, manter desativada.
- `OCTACLIN_BACKEND_URL`: backend usado pelo BFF publico da web quando ainda nao existe sessao.

## Validacao esperada

1. Abrir `/login` e clicar em "Esqueci minha senha".
2. Informar API, tenant e e-mail.
3. Receber a resposta generica.
4. Abrir o link recebido por e-mail ou exposto em homologacao.
5. Definir uma nova senha.
6. Entrar novamente pelo login com a senha nova.
