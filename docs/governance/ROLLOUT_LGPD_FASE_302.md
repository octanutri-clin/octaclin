# Rollout dos detalhes LGPD cifrados — Fase 302

Procedimento **fora de banda**. Nenhum agente deve aplicar a migration ou
executar o backfill em staging/produção sem identificar o ambiente, banco,
branch Neon, role owner e autorização aplicável. Não imprimir a URL, a chave
ou o texto de pedidos. Usar Node 22 e o checkout do PR integrado.

## Ordem obrigatória por ambiente

1. Confirmar no provider a branch e o banco alvo e que a role usada é a owner.
   Confirmar o valor literal `BANCO_EXECUTAR_MIGRACOES=false` no runtime.
   Preparar `DATABASE_URL` e `CRIPTOGRAFIA_CHAVE_AES_256` na sessão protegida,
   sem ecoar valores nem gravá-los no repositório. A chave deve ser a mesma
   usada pelo runtime do ambiente.
2. Com a URL owner, conferir a identidade da conexão (`current_database()`,
   `current_user`) e `pnpm --dir octaclin-backend typeorm -- migration:show`.
   Parar se houver pendência inesperada. A única nova migration desta fase é
   `CifrarDetalhesSolicitacoesLgpd1720000001062`.
3. Aplicar deliberadamente `pnpm --dir octaclin-backend migration:run` e
   repetir `migration:show`. Confirmar a coluna
   `consentimentos_lgpd.detalhes_criptografados` e o índice de protocolo;
   a tabela mantém a política de RLS/FORCE RLS vigente.
4. Publicar o runtime compatível com a coluna e confirmar que todas as
   instâncias antigas saíram. Verificar health e uma leitura sintética
   autorizada, sem copiar pedido real para logs ou screenshots.
5. Definir `CONFIRMAR_BANCO_BACKFILL` com o nome exato do banco e
   `CONFIRMAR_ROLE_BACKFILL` com o resultado de `current_user`. Executar
   `pnpm --dir octaclin-backend backfill:lgpd:detalhes`. O script exige
   `DATABASE_URL`, chave real e correspondência exata de banco e role;
   percorre tenants com `app.tenant_id`, cifra lotes de até 100 e remove a
   chave `detalhes` do JSON na mesma transação. É repetível e só imprime
   contagens agregadas. Interromper e investigar qualquer falha sem imprimir
   conteúdo protegido.
6. Em cada tenant, verificar que não restam eventos LGPD de solicitação ou
   tratativa com `metadados ? 'detalhes'`, usando conexão owner e contexto de
   tenant explícito. Verificar leitura autorizada no portal do paciente,
   Operações e portal da clínica, além da negativa de outro tenant/papel.
   Registrar evidências sanitizadas por ambiente, sem protocolos ou IDs.

O código é compatível com leitura legada durante a transição, mas o aceite
operacional da proteção exige resíduo zero no JSON após o backfill. Não
executar `migration:revert`: a coluna pode conter o único exemplar da
descrição. Depois do backfill, o runtime anterior deixa de ler o texto; em
incidente, desativar a nova superfície ou corrigir para frente preservando a
coluna. Staging/CI não provam produção.
