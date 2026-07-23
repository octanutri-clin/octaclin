# Fase 119 - Exportacao LGPD completa por titular

Data: 2026-07-23

## Objetivo

Tornar a exportacao LGPD do portal do paciente robusta e auditavel, consolidando os dados do titular em um pacote estruturado por categorias.

## Entregas

- Exportacao passa a retornar o formato `octaclin.lgpd.exportacao_paciente.v1`.
- Pacote LGPD inclui escopo, origem, categorias exportadas e observacoes operacionais.
- Categoria `perfil` inclui dados cadastrais e preferencias de contato do titular.
- Categoria `consultas` inclui consultas visiveis ao paciente.
- Categoria `formularios` separa pendentes e respondidos.
- Formularios respondidos passam a ser exportados com perguntas, respostas e score quando disponiveis.
- Categoria `comunicacoes` inclui mensagens recentes e notificacoes do paciente.
- Categoria `acompanhamento` inclui tarefas, materiais enviados e diarios/check-ins recentes.
- Categoria `lgpd` inclui consentimentos, documentos legais e protocolos consolidados.
- Exportacao inclui `integridade.algoritmo = sha256` e hash hexadecimal do pacote.
- Campo legado `dados` foi preservado para compatibilidade com consumidores atuais.
- Portal mostra confirmacao de exportacao com hash curto de integridade.
- Regressao visual do portal cobre o novo retorno do endpoint.

## Decisoes

- A exportacao continua sendo gerada pelo portal autenticado do paciente, sempre a partir do `usuarioId` logado.
- O pacote exclui dados de outros pacientes/usuarios e mantem a garantia multi-tenant ja existente.
- O hash e uma prova simples de integridade do arquivo gerado, nao uma assinatura digital com chave privada.
- A fase nao muda o formato do arquivo baixado: continua JSON para facilitar suporte e auditoria inicial.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts`
- `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-portal-paciente.ts`
- `octaclin-web/lib/portal-api.ts`
- `octaclin-web/components/portal/portal-paciente.tsx`
- `octaclin-web/tests/visual/portal-paciente.spec.mjs`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
.\node_modules\.bin\jest.cmd --runInBand src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
cd octaclin-web; $env:E2E_WEB_URL='http://localhost:3105'; .\node_modules\.bin\playwright.cmd test tests/visual/portal-paciente.spec.mjs --reporter=list
```

## Pendencias para fases futuras

- Avaliar exportacao operacional por protocolo para equipe interna quando houver pedido assistido pelo suporte.
- Avaliar assinatura digital do pacote em producao se houver exigencia juridica.
- Definir politica de armazenamento temporario se algum dia a exportacao deixar de ser gerada sob demanda.
