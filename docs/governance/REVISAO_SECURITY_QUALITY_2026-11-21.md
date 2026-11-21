# Revisão SQ — 21/11/2026, PR #566

## Estado e decisão necessária

**BLOCKED — ratificação do proprietário pendente.** A governança do HEAD
`f94ec88a` falhou corretamente por vencimento de `SQ-2026-004` em 20/11.
Não há defeito demonstrado no validador; regras, severidades e relógio preservados.

Validação local do coordenador: **73/73** testes dos quatro scripts do inventário
PASS, incluindo as provas do relógio. A CLI com relógio corrente continua **FAIL**
por vencimento. Não confundir sucesso dos testes do mecanismo com aceite do
inventário vencido. Nenhum assert ou workflow foi reduzido ou alterado.

A [revisão anterior](REVISAO_SECURITY_QUALITY_2026-11-11.md) determina:
“renovar a data so se o proprietario decidir aceitar o risco.” A autorização para
corrigir o CI permite diagnóstico, captura e preparação da solução; não foi
tratada como aceitação implícita de um conjunto de riscos ainda não apresentado.

Proposta concreta, **não aplicada ao inventário ativo**:

- Reconciliar a captura atual e manter os alertas visíveis, com cobertura exata.
- `SQ-2026-004`: 232 alertas da imagem IA, todos sem versão corrigida informada;
  manter severidade contextual `critical`, registrar `aguardando_upstream` e revisão
  até **28/11/2026**, somente após ratificação. Ausência de patch não é segurança.
- `SQ-2026-259`: 20 alertas OpenSSL Alpine `medium`, com correção disponível;
  `corrigir`, revisão até 28/11 e remediação técnica em PR própria de imagens,
  com runtime/SBOM/Trivy. Não classificar como bloqueados por upstream.
- Preservar os dois Dependabot minimatch e o Semgrep já triados nos seus estados.
- Retirar somente referências ausentes da lista atual de abertos, sem alegar
  correção técnica ou dispensar alertas por essa ausência.

O JSON [proposto](evidencias/2026-11-21-qst01/inventario-reconciliado-proposto.json)
passou na validação estrutural/255 referências. Esse PASS é da **proposta**, não
da governança ativa. `docs/governance/inventario-security-quality.json` e seu
prazo continuam intactos neste checkpoint; CI permanece FAIL até solução válida.

## Evidência autenticada

[Run 44894581678](https://github.com/octanutri-clin/octaclin/actions/runs/44894581678),
main `60bbe01f944d3c14a3dd30210bb4843b4187e356`, captura
`2026-11-21T10:29:37.744Z`.

- **Capturar snapshot: PASS**, job `136817417546`.
- **Aviso de vencimento: FAIL**, esperado pelo prazo vencido; run global FAIL.
- JSON reconstruído do eco: 31 partes, 68.961 bytes, SHA-256
  `d77758aa9defaffd7ab09ae21042cf8459bffc1c7845d8aca1e8dc81f87b554a`.
  Contagem, índices, bytes e hash conferidos; não foi usado snapshot parcial.
- [Captura bruta normalizada](evidencias/2026-11-21-qst01/inventario-capturado.json):
  253 Code Scanning, 2 Dependabot e zero Secret Scanning.
- Tentativa local: primeiro incompatibilidade do gh com `--slurp`; depois
  adaptação somente em memória confirmou HTTP 403 para Code Scanning. Nenhum
  privilégio/token/configuração foi alterado. Workflow oficial existente forneceu
  a captura completa com suas permissões de leitura já configuradas.

## Reconciliação

| Grupo | Observação atual | Proposta de destino |
| --- | --- | --- |
| Imagem IA Debian | 232 Trivy: 47 high, 109 medium, 67 low, 9 none; zero com `versaoCorrigida` | SQ-2026-004; critical contextual preservado |
| Backend/Web Alpine | 20 Trivy medium #640–659; libcrypto3/libssl3 3.5.9-r0 → patch informado 3.5.9-r1 | Nova SQ-2026-259, corrigir em PR própria |
| Semgrep | #555 ainda aberto; triagem histórica de fixture preservada | SQ-2026-258 |
| Dependabot | #172/#173 minimatch ainda abertos | SQ-2026-255 |
| Saíram da lista de abertos | Code Scanning #289/#400/#578 zlib1g; Dependabot #142 deepmerge | Retirar referências; aposentar SQ-2026-254 na proposta |

Contra a captura ativa de 11/11: 51 Code Scanning novos, 3 ausentes dos abertos;
31 novos da imagem IA e 20 de backend/Web. Nenhum dado do inventário foi usado
como prova de exploração, runtime produtivo, estado de deploy ou encerramento
com motivo específico dos alertas que deixaram de estar abertos.

## Limites e próximo passo

Revisão cruzada R4 independente, somente leitura, pelo subagente
`/root/qst01_governanca_r4`: sem achado adicional no escopo estático. Conferiu
bytes/hash, snapshot, cobertura bijetiva de 255 referências e executou o
validador da proposta nas datas 21/11 e 28/11 (PASS estrutural) e 29/11 (FAIL
esperado por vencimento). Confirmou o inventário ativo inalterado e seu FAIL
atual. Não executou scanners/build/runtime/produção nem autenticou o run por
conta própria; evidência de API/eco obtida pelo coordenador. Não ratifica risco.

Sem alteração de Dockerfiles, dependências, exceções, severidades, workflows,
permissões, produção ou infraestrutura. Não usar Python alpha para corrigir
imagem. Não remover o gate, o teste de relógio ou a cobertura bijetiva.

Após ratificação: aplicar a reconciliação, atualizar os testes de snapshot/255
referências e fronteira 28/11 → 29/11 mantendo asserts, executar gates e revisão
cruzada R4, enviar um novo HEAD e conferir a governança no CI. Ratificação não
autoriza merge/deploy nem declara corrigidos os alertas residuais.
