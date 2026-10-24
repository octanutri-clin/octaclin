# Execução FOOD05 — plano tasks/plan-pos-320-food05.md

Autorização: proprietário “Pode seguir, sol médio”. T01–T18 autorizadas;
produção/infra/migrations externas não. Base e3b47da1, PR446 Draft, árvore limpa.

Ruling: uma PR funcional, commits pequenos — leitores/writers/UI precisam de
integração atômica; divisão3 ou1 já aprovada no plano. Custo: diff final maior,
mitigado com focados/commits e revisão distinta final.
Ruling: scripts de skill cloud não estão disponíveis no filesystem; usar este
ledger e logs /tmp/food05-exec, sem alegar execução de helpers inexistentes.

## Preflight

- T01→T04/T09: DTO leva documento/intenção, nunca fatos confiáveis do cliente.
- T02→T03/T05: razões exatas/half-up e porção0,001–10000g/3 casas.
- T04→T06: prévia sem escrita e save com revalidação/CAS no mesmo escopo.
- T06→T07/T11/T13: ACK devolve referência; pendência não recalcula;
  omissão/null/tombstone não apagam/ressuscitam contexto.
- T08→T10: preferência pessoal não guarda PHI nem altera valores persistidos.
- T10→T11/T12: painel/AbortSignal compartilhado, cancelar não modifica documento.
- T14→T18: banco local/CI não é liberação produtiva.

## Progresso

T01 em execução. Tentativa inicial de shell usou cwd do backend com paths de
root e não criou arquivos; não conta como RED de feature. Corrigido o cwd.

T01: focais23/23 PASS. RED inicial por módulos ausentes (TS2307,0 testes),
seguido de22 PASS; teste adicional pelo pipeline real class-transformer/validator
reproduziu1 RED/22 PASS: instância DTO era recusada como objeto não plano.
Validador adapta somente a raiz e mantém allowlist; repetição23/23 GREEN.
Logs t01-red/t01-green/t01-dto-red/t01-final em /tmp/food05-exec.
Cálculos/casos de base são exercitados em T02/T03; DTO não confere fatos autorizados.
T02: focais de aritmética+micros+DTO55/55 PASS, com4000 vetores Python Fraction
(seed314159,1000/alvo), sem tolerância float. RED por módulo ausente antes da
implementação. Parser decimal existente apenas exportado; sem semântica global nova.
Suite completa/build/CI ainda NOT RUN: focais não equivalem a feature concluída.
