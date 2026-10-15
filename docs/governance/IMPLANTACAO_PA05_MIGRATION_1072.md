# PA05 — plano de implantação da migration1072

Procedimento planejado, NÃO executado em staging/produção. A autorização de
desenvolvimento/teste local não autoriza migration externa, merge ou deploy.
A migração é aditiva na tabela `plano_alimentar_versoes` e não habilita flags.

## Pré-condições para o operador

1. Confirmar revisão/CI do HEAD final, incluindo o gate integral PostgreSQL
   Timescale e revisão R4 independente. A fixture PostgreSQL local da PA05 tem
   limites explícitos e não substitui esse gate.
2. Identificar e registrar ambiente, projeto/branch/banco, owner e role runtime
   efetivamente usada; obter autorização operacional correspondente.
3. Conferir migrations reais existentes, registro da1072 no artefato e política
   de backup/retenção. Não inferir aplicação pelo merge/CI.
4. Usar execução fora de banda com owner pelo runbook vigente. Runtime continua
   sem privilégio DDL, sem BYPASSRLS e sem migrations automáticas.

## Sequência por ambiente

- Ensaiar em staging autorizado, observar lock/tempo do ALTER aditivo e
  confirmar histórico e RLS. Colunas: bytea nullable; inteiro default0 CHECK>=0.
- Publicar backend compatível somente após confirmar schema; publicar Web com
  os contratos de apresentação/preview validados. Não permitir que um cliente
  parcialmente atualizado grave preferências e depois descarte CAS.
- Verificar registro da migration, colunas/constraint, FORCE RLS e role runtime
  por leitura. Depois testar os fluxos autorizados de configuração, save,
  revisão, publicação, portal e impressão com fixture sintética adequada.
- Produção requer evidência/autorização próprias após o ensaio; não copiar
  conclusões de staging. Registrar a liberação apenas após as verificações.

## Rollback e histórico

O down recusa retirar as colunas, evitando apagar snapshots ou depender de
visibilidade RLS do operador para decidir se há histórico. Preferir correção
aditiva. Reversão de código conserva a1072 e os dados; versão antiga pode ignorar
preferências visuais, portanto conferir apresentação/PDF antes de autorizar
qualquer entrega ao paciente após rollback. Nenhuma reversão apaga conteúdo,
quantidades, escolhas ou versões publicadas. Não editar migrations anteriores.

Evidências locais e limites:
[EVIDENCIAS_PA05_BACKEND_2026-10-14.md](EVIDENCIAS_PA05_BACKEND_2026-10-14.md).
