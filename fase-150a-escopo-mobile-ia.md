# Fase 150A - Escopo de dados em Mobile e IA

Status: entregue em 2026-07-28.

## Objetivo

Eliminar acesso horizontal a recursos clinicos nos modulos Mobile e IA. A
identidade autenticada e a fonte de autoridade; um `pacienteId` recebido em
DTO apenas identifica o recurso a validar e nunca amplia a sessao.

## Escopo entregue

- A politica compartilhada de escopo resolve `Patient` para o proprio paciente,
  `Professional` para os pacientes sob sua responsabilidade e `SuperAdmin` para
  o tenant. Perfil ausente ou vinculo inativo resulta em sentinela sem
  resultados; recurso fora do escopo retorna `NotFoundException`.
- No Mobile, diario rapido, midias e acompanhantes sao listados com filtro no
  banco. Uploads, escritas diretas e cada item de sincronizacao em lote validam
  o recurso antes de persistir ou gerar URL. `Collaborator` conserva somente o
  acesso Mobile ja admitido pelo contrato existente.
- A sincronizacao Mobile cria chave `idLocal` por paciente, trata registros
  legados somente quando pertencem ao paciente autorizado e recupera a corrida
  de reserva `23505` em nova transacao, buscando o vencedor ja validado. Erros
  internos, de persistencia ou criptografia retornam a mensagem estavel
  `Falha ao sincronizar item.`; o `NotFound` de escopo conserva
  `Paciente nao encontrado.` sem expor SQL, constraint ou stack.
- Na IA, listas de sentimento e reconhecimento sao filtradas no banco. Antes
  de chamar o provedor de sentimento, o servico valida sob locks na mesma
  transacao cada referencia opcional: `respostaCheckinId` por
  `id`/`tenantId`/`pacienteId`, e `transcricaoMidiaId` por `id`/`tenantId`
  seguido da confirmacao de que seu `arquivoMidiaId` pertence ao mesmo tenant
  e paciente. Ausencia ou divergencia retorna `NotFoundException` antes do
  fetch e da persistencia.
- O reconhecimento usa locks pessimistas e advisory lock, URL derivada da
  midia registrada e valida o SHA-256 bruto devolvido pelo provedor contra essa
  URL confiavel. Consulta, advisory lock e persistencia usam a mesma chave de
  cache SHA-256 namespaced por `pacienteId` + hash bruto. O `provedor` real
  devolvido continua persistido e nao e fixado na consulta, evitando a unique
  `(tenant_id, provedor, imagem_hash)` entre pacientes.
- O timeout do provedor de IA usa `AbortController`, aceita apenas 1 a 60
  segundos e assume 15 segundos para valor ausente ou invalido. Erros externos
  sao registrados de forma sanitizada e o cliente recebe erro generico.
- `Collaborator` continua negado na IA pela ausencia de `ia.executar`; a tabela
  de papeis e permissoes existente nao foi alterada.

## Compatibilidade e limites

Nao houve migracao de banco nem alteracao em DTO publico, Google Agenda,
frontend, rota ou permissao. Caches de reconhecimento IA com hash bruto
anteriores a esta fase podem somente deixar de gerar hit com a chave
namespaced; nao causam novo `23505`, nao sao reutilizados entre pacientes e nao
expoem dados.

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand  # 62 suites / 377 testes
pnpm --dir octaclin-backend typecheck         # ok
pnpm --dir octaclin-backend build             # ok
pnpm --dir octaclin-web test:authz            # 20 testes
pnpm validate:docs                            # ok
pnpm test:confiabilidade                      # 7 referencias criticas
pnpm security:secrets                         # nenhum secret real identificado
git diff --check                              # limpo
```

Os testes atuais cobrem escopo antes do provedor, referencias opcionais
autorizadas, de outro paciente, de outro tenant e ausentes, ownership da midia
sob lock, cache de provedor alternativo, isolamento namespaced,
serializacao concorrente, reproducao preventiva de `23505`, hash divergente,
logs e erros Mobile sanitizados e timeout. Eles usam dubles de transacao,
PostgreSQL e provedor; uma prova de integracao contra esses servicos reais
permanece fora desta fase.
