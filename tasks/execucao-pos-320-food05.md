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

T03 focais47/47 PASS (4 suites), com casos energia/macros/base diferente,
zero/ausente, resíduos/edição, limites/avisos, simulação350→300 e comparação
com4000 casos independentes no motor. RED inicial por funções/módulo ausentes.
Nova política decimal é aditiva no motor; defaults legados não mudaram.

T04 prévia focada9/9 PASS. RED por serviço ausente, depois fonte real/preparo/base,
composição de catálogo manipulada ignorada, papel/permissão/tenant/carteira,
revisão vencida e resultado parcial por alternativa verificados. Nenhum save no
harness de leitura. Rotas/provider ainda não registrados; sem superfície liberada.
Ruling: não acrescentar campos à composição canônica de grupos antigos apenas
para preparo — FOOD04 compara snapshots JSON e isso invalidaria referências
legítimas. O resolver FOOD05 enriquece a sua própria projeção autorizada, mantendo
origem/base originais e contratos de grupo intactos. Custo: leitura adicional da
origem sob o lock já obtido, deduplicável por pedido; sem alterar biblioteca.

T05 focais54/54 PASS (4 suites). RED: medida ausente na projeção de prévia
(1 falha/9 PASS) e helper novo inexistente; GREEN após integração com resolução
FOOD01/medidas registradas e conversão exata. Caso real de DTO transformado
adicional reproduziu1 RED/10 PASS no serviço, corrigido sem abrir a allowlist.
Peso ao aplicar quantidade doméstica é recalculado e seu resíduo mostrado;
medida de revisão vencida fica indisponível. Referência preservada de histórico
será integrada/validada junto a T06/T07; não declarar M02 integral ainda.

T06 em consolidação; T07 iniciado pelas projeções e cópia histórica.
- RED de fingerprint: formatação decimal e porção explícita equivalente davam
  identidade diferente; normalização semântica corrigida. Focais45/45 PASS.
- Envelope3:2 RED/2 PASS antes do reader/writer;21/21 PASS após integração,
  preservando formatos1/2 e vínculo pai/filho/identidade.
- Projeção explícita: catálogo/manual vazavam campos internos (2 RED/6 PASS);
  allowlists corrigidas,29/29 PASS com envelopes/resolver.
- Writer:3 RED comportamentais iniciais (intenção ignorada/fingerprint sem
  validação), depois2 RED (fonte inativa e edição legada do SuperAdmin).
  Integração autoriza comandos somente ao responsável; mantém edição ordinária
  legada, snapshots, ACK estável e revisão pendente persistente.
- Regressão publicada:1 FAIL/118 PASS por leitura do cipher editorial ao invés
  dos filhos históricos; corrigido sem recalcular. Serviço completo119/119 PASS
  em t06-save-full-final.log. Não equivale ao backend inteiro nem RLS real.
- Negativos adicionais:2 RED/30 PASS reproduziram composição principal parcial
  aplicável indevidamente e reutilização de UUID de desvinculação em outro filho.
  Corrigidos:36/36 GREEN incluindo envelope (t06-negativos-{red,green}.log).
- Revisar/publicar bloqueiam equivalência pendente; omissão não desvincula,
  replay não ressuscita, fontes aplicadas conservam composição/micros.

Pendências T06/T07: cópia/reabertura; fonte principal preservada na materialização;
prévia com fonte/medida histórica inativa; captura de fatos após troca explícita;
marcador decimal por filho; cópias entre planos/modelos e regressões completas.
T08–T18 ainda não concluídos. Nenhum gate final ou clínico declarado PASS.

T07 parcial:
- Cópia de versão: a primeira tentativa do teste usava revisão anterior à ação
  Revisar e falhou no CAS correto (não é RED da cópia). Corrigido o teste para2,
  RED comprovou referência perdida. Nova versão FOOD05 conserva ciphers/chaves
  editoriais e revisão0 protegida; planos sem FOOD05 mantêm reconstrução legada.
- Fonte congelada na prévia e principal:3 RED/6 PASS incluindo cópia; ajustes
  reutilizam somente contexto autenticado e vínculo editorial correspondente.
  Serviço completo122/122 PASS em t07-save-full-green.log.
- Medida salva:1 RED/12 PASS, prévia dependia da biblioteca atual. Reutilizado o
  resolver FOOD01 com contexto cifrado da versão, sem novas conversões. Novo
  nonce exige autorização atual. Focais e regressões em t07-medida-green.log.
- Typecheck backend executado: PASS (t06-typecheck.log), antes dos últimos ajustes.
  Reexecutar no checkpoint consolidado. Nenhum teste PG/CI/UI concluído ainda.

T07 continuidade: teste RED1 comprovou que composição explicitamente trocada
não era preservada após a fonte ficar inativa. Captura `aplicados` cifrada separa
fatos atuais da matemática original; cálculo/resíduo original continuam imutáveis
com revisão pendente. Focais138/138 PASS (t07-troca-green.log).
Marcador por filho:1 RED comprovou que FOOD05 ainda dizia motor1; corrigido para
nutricao-decimal-v1 somente nos filhos FOOD05, sem trocar motor global legado.
Repetição consolidada em t07-final-green.log.

T08 iniciado: testes de contrato, serviço/CAS e migration escritos antes dos
módulos (RED por TS2307,0 testes; não é vulnerabilidade reproduzida). Após código,
21/21 PASS em t08-green.log. Dois campos em profissionais, JSON fechado, sem PHI,
CAS próprio e rollback conservador. Migration1079 registrada;1078 não alterada.
Não executada em banco externo. Provas PostgreSQL/RLS/role seguem para T14;
testes de migration até aqui inspecionam SQL e registro, não provam o banco real.
