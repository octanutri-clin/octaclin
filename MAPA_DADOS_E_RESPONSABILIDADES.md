# Mapa inicial de dados e responsabilidades

## Revisao juridica obrigatoria

Esta matriz e operacional e deve ser validada para cada cliente e fluxo. O
papel de controlador ou operador nao e fixo para toda a relacao comercial.

| Operacao | Dados envolvidos | Papel inicial da consultoria | Papel inicial do OctaClin | Controle necessario |
| --- | --- | --- | --- | --- |
| Atendimento e acompanhamento de pacientes | cadastro, agenda, formularios, registros e dados sensiveis | controlador | operador, quando agir por instrucao | anexo de tratamento e instrucao documentada |
| Administracao da conta | administradores, usuarios, plano e faturamento | controlador dos proprios contatos | controlador independente ou operador conforme finalidade | politica e contrato aprovados |
| Seguranca e auditoria | logs, identificadores e eventos de acesso | corresponsavel por uso adequado | controlador para seguranca do servico, conforme analise | retencao e acesso restrito |
| Suporte | dados minimizados do chamado | controlador do proprio chamado | operador ou controlador conforme finalidade | sanitizacao e trilha de atendimento |
| Provedores tecnicos | dados estritamente necessarios ao servico | controlador ou instrutor conforme operacao | contratante do suboperador | inventario e contrato aplicavel |

## Responsabilidades propostas

- A consultoria define acessos do tenant e responde por instrucoes legitimas.
- O OctaClin aplica controles tecnicos, autentica usuarios, registra auditoria
  e opera provedores tecnicos aprovados para entregar o servico.
- Nenhuma parte deve coletar ou compartilhar dados alem do necessario.
- Incidentes, requisicoes de titulares e suboperadores seguem o anexo juridico
  final e o runbook operacional correspondente.
