# Fase 279 — PB-10: filtros protegidos do perfil de cadastro

## Decisao e escopo

Risco R4: filtros de pacientes podem revelar PII ou informacao clinica; a fase
acrescenta indices derivados e migration. O proprietario confirmou em
2026-09-25 filtros **exatos** para tag, origem e categoria, sem busca parcial.
Os valores continuam exclusivamente em `pacientes_perfis.operacao_criptografada`.
O banco recebe apenas indices cegos HMAC-SHA256 derivados da chave ja usada
pela busca PII, com separacao por tenant, campo e valor normalizado. A
correspondencia ignora caixa, acentos e espacos repetidos; nao faz
stemming, prefixo ou substring. Ausencia de valor nao vira filtro irrestrito.

Filtros protegidos seguem no corpo de POST autenticado, sem query string,
historia do navegador, filtros salvos em `jsonb`, cache, auditoria generica ou
telemetria. O resultado reaproveita a listagem de pacientes, com carteira do
profissional, tenant, paginacao e demais filtros atuais. Exportacao CSV e
visoes salvas nao incluem estes tres criterios nesta fase; a interface deve
impedir exportacao enganosa enquanto um deles estiver ativo.

## Entregas e checkpoints

1. **Indice e escrita atomica**: testar a derivacao HMAC por tenant/campo,
   valores equivalentes e dominios diferentes. Migration aditiva cria uma coluna
   de hashes em `pacientes` e indice GIN. Atualizar o bloco operacional
   cifra o payload e substitui os indices na mesma transacao; limpar campos
   remove os hashes. Verificar que o DTO nao devolve hashes.
2. **Busca autorizada**: testes positivos para filtro exato individual e
   combinado; negativos para tenant, carteira, campo ausente, valor parcial e
   permissao. Endpoint POST valida corpo, usa tenant do JWT e preserva os
   filtros existentes. O BFF verifica sessao/permissao antes de ler o corpo.
3. **Interface e contrato**: campos de filtro na lista, sem inserir valores
   protegidos na URL; comunicar busca exata e impossibilidade de exportar com
   esses filtros. Testar BFF e browser em desktop/mobile.
4. **Legado e rollout**: backfill fora de banda, idempotente e com banco alvo
   confirmado, decifra o bloco operacional em lotes por tenant e preenche os
   indices sem imprimir valores. Incluir prova no banco efemero do CI. Rodar
   typecheck, build, suites focadas, authz, `git diff --check` e
   `pnpm security:secrets`; solicitar revisao cruzada de tenancy.

## Limites operacionais e rollback

Nenhuma migration ou backfill sera executado em staging/producao pelo agente.
Aplicacao futura exige ambiente, banco, branch, role owner e chave HMAC/AES
coerentes com o runtime confirmados pelo proprietario, conforme runbook.
Migration antes do codigo e aditiva; rollback de codigo deixa colunas sem uso.
Apos backfill, nao usar `migration:revert` em banco com dados. Troca da chave
de indice exige reindexacao coordenada. Ate o backfill terminar, registros
legados podem nao aparecer nos novos filtros; isso deve ser declarado no
handoff e no rollout, nunca tratado como busca completa.

## Procedimento de ativacao fora de banda

1. Confirmar ambiente, projeto, branch de banco, nome do banco e role owner;
   comparar `current_database()` e `current_user` com o alvo autorizado. Nao
   copiar a URL nem o material criptografico para logs ou PR.
2. Confirmar que a chave de indice HMAC (ou a chave AES usada como base) e a
   mesma do runtime alvo. Executar `migration:show`, aplicar a migration
   `1720000001055` com a role owner conforme o runbook e confirmar o schema.
3. Definir `CONFIRMAR_BANCO_BACKFILL` com o nome exato do banco previamente
   verificado e executar `pnpm --dir octaclin-backend backfill:indices-perfil`
   em janela coordenada. O script processa lotes de 100 por tenant, em
   transacoes curtas, com locks para serializar atualizacoes concorrentes;
   nao registra valores do perfil ou hashes.
4. Confirmar o total atualizado, repetir o backfill para prova de idempotencia
   (esperado zero alteracoes) e verificar busca exata com dado sintetico e
   carteira autorizada antes de liberar a interface. Se falhar, parar o
   rollout e corrigir/reexecutar o backfill; nao usar `migration:revert`.

O agente nao executou este procedimento em staging ou producao nesta fase.
