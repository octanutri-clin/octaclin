# RASCUNHO - Anexo de tratamento de dados pessoais

## Status e uso

Este e um roteiro de anexo contratual, nao um DPA final. A definicao de papeis,
bases legais, transferencia internacional e redacao final exigem revisao por
advogado habilitado antes de assinatura ou ativacao de cliente real.

## 1. Escopo do tratamento

| Item | Preencher na versao contratual |
| --- | --- |
| Controlador por operacao | `[contratante / OctaClin / ambos conforme matriz]` |
| Operador por operacao | `[identificar]` |
| Finalidades | uso da plataforma, suporte, seguranca, auditoria e demais finalidades aprovadas |
| Titulares | administradores, profissionais, colaboradores, pacientes e contatos autorizados |
| Categorias | cadastro, contato, autenticacao, agenda, formularios, comunicacoes, auditoria e dados de saude quando habilitados |
| Duracao | vigencia contratual e prazos de retencao legal/contratual aprovados |

## 2. Instrucoes e seguranca

- O operador trata dados somente segundo instrucoes documentadas do controlador,
  salvo obrigacao legal aplicavel.
- As partes adotam controles proporcionais de acesso individual, segregacao por
  tenant, auditoria, backup/restore, resposta a incidentes e minimizacao de
  dados, sem prometer certificacoes nao contratadas.
- A contratante nao deve instruir tratamento ilicito, excessivo ou sem base
  legal definida para a operacao.

## 3. Suboperadores e transferencias

- Manter anexo vivo com fornecedor, servico, categorias de dados, local/país de
  tratamento, funcao, contrato aplicavel e mecanismo de transferencia.
- Validar separadamente os provedores efetivamente habilitados: Render, Neon,
  Upstash, Google, Meta e SMTP/e-mail, alem de qualquer novo fornecedor.
- Transferencias internacionais devem usar mecanismo valido nos termos da LGPD
  e do Regulamento de Transferencia Internacional da ANPD (Resolucao CD/ANPD
  no 19/2024); a escolha do mecanismo e a clausula final sao decisao juridica.

## 4. Direitos dos titulares e incidentes

- Definir quem recebe, autentica, responde e registra requisicoes de titulares,
  inclusive quando o OctaClin atuar como operador.
- O operador deve informar o controlador sem demora indevida sobre incidente
  envolvendo dados tratados por sua conta, com as informacoes disponiveis para
  avaliacao e comunicacao regulatoria.
- O controlador define se ha risco ou dano relevante e conduz comunicacoes a
  titulares e ANPD quando cabiveis. O regulamento vigente da ANPD preve prazo
  de tres dias uteis para a comunicacao pelo controlador, ressalvada norma
  especifica aplicavel.

## 5. Encerramento

- Definir exportacao, prazo de acesso, devolucao/eliminacao e retencao legal.
- Registrar qualquer conservacao obrigatoria, com acesso restrito e finalidade
  documentada.
- Prever evidencias de exclusao ou bloqueio quando o caso exigir.

## 6. Pontos para aceite juridico

- [ ] Papel de cada parte definido por operacao.
- [ ] Bases legais de dados comuns e sensiveis aprovadas por fluxo.
- [ ] Inventario de suboperadores, regioes e transferencias concluido.
- [ ] Mecanismo internacional e clausulas contratuais aprovados.
- [ ] SLA de incidente e canal entre as partes aprovados.
- [ ] Retencao, eliminacao e exportacao compatibilizadas com contrato e lei.
