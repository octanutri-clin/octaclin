# Handoff — Fase 317

## Branch/base/worktree

`feature/fase-317-gamificacao`, base `origin/main a84921fb`, worktree
`/workspace/octaclin/.worktrees/docs-fase-317-planejamento`. Main com alteração
preexistente `octaclin-web/next-env.d.ts` preservada.316 pausada em worktree própria,
branch `research/fase-316-motores`, último commit de pausa `9b638613`; não herdar
código experimental nem retomar pesquisa daquela fase automaticamente.

## Objetivo autorizado

Planejar/analisar conquistas privadas **e comunidade** no console/portal para
adultos>=18. Implementação técnica autorizada pelo proprietário após o planejamento; piloto
continua desligado. Testes novos/regressões/banco descartável/gates autorizados.
Sem merge/deploy/migrations externas ou ativação.
[Plano/gaps/contratos](../docs/history/phases/PLANO_FASE_317.md),
[T00–T16](todo-fase-317.md),
[contrato draft](../docs/product/CONTRATO_PILOTO_GAMIFICACAO_FASE_317.md),
[inventário](../docs/history/phases/reviews/fase-317/source-inventory.json).
`tasks/plan.md`/`todo.md` históricos de outra fase ficam intactos.

## Concluído

- [x] Base fetch/módulo/API/UI/SQL/guards/cifra/padrões do portal inventariados.
- [x] D01 conquistas+comunidade, D02 console/portal/manual/aceite/sem avisos externos,
  D03>=18 confirmadas; respostas repetidas deduplicadas.
- [x] D04–11 adicionais incorporadas; D12 técnica de compatibilidade.
- [x]14 gaps estáticos, contrato/matriz de atores/rotas/estados/retenção e texto
  proposto do aceite, tarefas com dependências/aceites/verificações.

## Decisões e limites

D04 nomes visíveis em círculos privados;D05 publicação imediata e moderação após
denúncia;D06 comentários/curtidas;D07 gestor/SuperAdmin habilitam, profissional
conduz;D08 saída oculta conteúdo, novo convite requer aceite: CONFIRMADAS.
D09 nome de exibição confirmado/D10 identificar quem curtiu/D11 até90dias
com exceção legal: CONFIRMADAS. D12: piloto versionado, legado não escreve em
recursos317 nem expõe registros no portal; histórico preservado. Contrato e
limites técnicos documentados; falta autorização de implementação e revisão
operacional de termo/apoio à moderação antes de ativar.

## Pontos técnicos para o próximo executor

- Flags atuais são tenant-wide, false por ausência; Professional pode alterá-las.
  Client não possui `gamificacao.gerenciar`. Não ampliar acesso clínico para ativar.
- API atual é console; portal resolve próprio Patient, não recebe pacienteId livre.
- Concessão atual referencia badge mutável; novo compartilhamento exige snapshot.
- Ranking retorna participação crua e não revalida carteira de cada paciente.
- Moderador por4 palavras não é proteção de identidade/PHI; publicação nova é imediata por D05. Não chamar conteúdo de aprovado clinicamente
  nem publicar pendências do legado por mudança automática de status.
- Fundação já tem ENABLE/FORCE RLS por tenant; isso não é isolamento de carteira,
  garantia de FK composta ou evidência de que migration está aplicada no alvo.
- Ícones internos/escape/projeções explícitas; campos JSON/DTO TS não ocultam dado.
- Não tocar demais fases nem escolher migration1070 enquanto main não reconferida.
- Demo/global/a11y têm post, pontos e ranking legados; adaptar contratos/fixtures
  quando runtime autorizado. Não declarar smoke aprovado só por unitários novos.

## Validações

PASS: fetch/base, leitura,11 hashes do inventário,11 links locais e consistência
D01–12/T00–16; diff sem whitespace. Scanner de segredos confirmado ao finalizar. SKIPPED: runtime/testes/builds/CI/bancos/produção,
por escopo restrito a planejamento. Revisão independente não executada.

## Próxima ação exata

Apresentar contrato consolidado e obter autorização de implementação técnica.
Não iniciar T02–T16 automaticamente; adequação do termo, capacidade de moderação
e ativação são gates operacionais separados. Manter Sol6.1 médio no core R4.

Modelos: GPT‑6.1Sol médio para core R4/planejamento/revisão; Luna alto para slices
bem fechados de UI/DTO/BFF. Comunidade amplia risco, não prometer Luna sozinho
para todo core. Na troca, avisar destino e pausar para mudança manual.
