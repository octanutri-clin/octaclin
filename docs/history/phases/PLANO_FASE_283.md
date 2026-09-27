# Fase 283 - PB-29: onboarding guiado da clínica

## Objetivo

Oferecer ao profissional um guia não bloqueante de configuração inicial que
mostre etapas concluídas e pendentes, reconheça os dados existentes e abra a
funcionalidade correspondente.

## Escopo desta entrega

- Exibir o guia no painel do profissional, sem condicionar acesso às demais
  áreas da plataforma.
- Verificar o total de pacientes, formulários, modelos pessoais de plano e
  templates de comunicação usando as listagens existentes, com paginação mínima.
- Considerar “Cadastrar primeiro paciente” concluída somente quando a API
  informar pelo menos um registro.
- Permitir pular etapas opcionais, retomá-las e ocultar/reabrir o guia. Persistir
  apenas esses controles locais por tenant; não gravar dados clínicos no
  armazenamento do navegador.
- Direcionar aos fluxos já disponíveis para paciente, formulários, modelos de
  plano, comunicações e materiais.
- Apresentar Triagem de primeira consulta e Check-in semanal como cópias iniciais
  editáveis pelo editor de formulários. Modelos pessoais de plano seguem as
  capacidades atuais de edição.
- No Portal do Cliente, manter as etapas administrativas com chamadas para as
  configurações correspondentes e convite de profissionais.

## Limites

- Não adicionar CRUD, edição, exclusão ou alteração de API para mensagens,
  materiais ou outros tipos que ainda não ofereçam essas capacidades.
- Mensagens, convites, lembretes e materiais apenas reutilizam seus fluxos
  existentes; opções de edição variam conforme a integração e a funcionalidade.
- Qualquer nova capacidade de edição para essas áreas fica para uma fase futura.
- Sem migration, endpoint novo ou escrita em staging/produção.

## Critérios de aceite

- O painel continua utilizável enquanto o guia está visível, oculto ou com etapas
  pendentes.
- Estados de conclusão refletem dados reais disponíveis; falha de leitura não é
  apresentada como conclusão.
- Etapas opcionais podem ser puladas, retomadas e preservam o estado após
  recarregar a página; o guia pode ser reaberto.
- As ações apontam para as áreas existentes e os modelos de formulário podem ser
  copiados e editados pelos recursos atuais.
- Testes de browser cobrem estado real, navegação, persistência, retomada,
  ocultação/reabertura e layout desktop/móvel.

## Risco e rollback

Risco limitado ao painel profissional e ao Portal do Cliente. O navegador guarda
somente preferências de apresentação e etapas puladas, identificadas pelo slug
do tenant. A contagem de pacientes usa a resposta paginada da API com limite 1;
nenhum item de paciente é persistido pelo guia. Reverter a mudança remove o
componente sem alterar registros ou contratos existentes.

## Fechamento de código em 2026-09-27

PR #319 integrado em `main` (merge `19ade15`, confirmado no GitHub). O guia
permanece não bloqueante e usa os fluxos de edição já existentes. A entrega não
inclui uma biblioteca inicial de mensagens: esse gap foi tratado na Fase 284
(PB-22), em branch própria. Este registro não comprova deploy nem dados de
staging/produção.
