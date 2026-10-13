# Fase 318 — checklist de planejamento e execução condicionada

Plano: [PLANO_FASE_318.md](../docs/history/phases/PLANO_FASE_318.md).
Só planejamento autorizado. T01–T03 exigem autorização de pesquisa/PoC/testes;
T04–T11 exigem GO de valor e autorização de implementação. Nenhum item futuro
marcado PASS por consequência do CI da317.

| Tarefa | Dependências | Arquivos / entrega | Critério objetivo |
| --- | --- | --- | --- |
| T00 planejamento/gaps | main atual | plano318, handoff, checklist, estado/roadmap | base8ea67a08; fontes reais; decisões confirmadas separadas de propostas |
| T01 corpus/rubrica | T00,D04,D06, autorização PoC | criar `scripts/research/fase318/corpus-sintetico.json`, `rubrica.json`, `README.md` |30 casos sem dados reais; fatos/ref/polaridade/unidades esperados; critérios congelados/hashes |
| T02 motor/direitos | T01,D02 | manifesto de fontes/artefatos da pesquisa, sem dependência runtime | fornecedor/modelo/contratos e política de dados verificados; API key segura; nenhuma chamada paga sem orçamento autorizado |
| T03 comparação GO/NO-GO | T01–02 | harness `scripts/research/fase318/avaliar-sinteticos.py`, relatório | mesmas entradas A/B/C; qualidade, omissão, revisão humana, tempo corrigido e tokens/custo; decidir G01/G02 sem auto-ratificação |
| T04 contrato HTTP/gates/contexto | GO,T03,D03–05, autorização implementação | móduloIA: novos DTOs/serviço318; catálogo de flag318 se aprovado; testes Jest | schema fechado, fontes selecionadas, limites20/12000/6000; gate legado sozinho não libera318; identidade/vínculo/geração revalidados |
| T05 adaptador de síntese | T04, licença aprovada | adaptador OpenAI e schemas318 no móduloIA/Nest; FastAPI legado preservado | Bearer do profissional só para OpenAI, timeout, resposta bounded, refs válidas, erro sanitizado, sem redirect/egress indevido/log de texto |
| T06 confirmação/provenance | T04–05,D05 | serviço318 chama construção compartilhada da evolução; migration somente se indispensável | contexto alterado409; autorização antes do replay; título180/conteúdo6000/privada; um nonce => uma evolução |
| T07 prova PG/RLS/concorrência | T06 | nova spec PG317-style, banco descartável; opcoes-typeorm só se nova migration | tenant/carteira, A→B→A, role/sessão/arquivamento/gate, fontes alteradas, duas confirmações, falha/crash/tombstone |
| T08 BFF | T04–07 | rotas318 sob `app/api/ia`, cliente tipado; registro authz | backend autoritativo, sessão/origem/no-store, payload allowlist, erros sem PHI; teste cruzado papel/tenant |
| T09 UI pré-consulta/evolução | T08 | novo componente pequeno em `components/pacientes`; integração no prontuário | prévia/seleção/fontes, editor manual, confirmação, falha sem perda do texto digitado, resposta tardia descartada |
| T10 interface/acessibilidade/regressões | T09 | harness BFF318 e Playwrightdesktop/mobile/axe | teclado/foco/leitor; trocar paciente/sair limpa rascunho; nenhuma execução/registro/publicação automática |
| T11 CI/revisão/PR única | T07–10 | relatório, status, handoff; PR de implementação única | typecheck/build/unit/PG/BFF/a11y/smoke/scans do HEAD; R4 quando viável, declarar autoria; bloqueios explícitos |
| T12 liberação piloto | T11,G01–04, autorização operacional | runbook e evidências do ambiente identificado | rede/role/modelo/config/retencão/rollback comprovados; flags por piloto; sem ativação automática |

## Interfaces a fechar antes de cada tarefa

- T01/T03: `ContextoSintetico318` e `SaidaSintetica318` definidos na seção4
  do plano. Assertion list: refs desconhecidas => rejeição; negação preservada;
  unidade/data/número iguais à fonte; fonte ausente não gera afirmação.
- T04: propor `ServicoRascunhosClinicosIa.gerar(usuario,pacienteId,dados)`;
  tenant não faz parte da entrada pública; DTO final e signature são checkpoint
  antes do RED. Não transformar proposta em endpoint implementado.
- T05: resposta estruturada/versionada com itens/ref/limitações, não entidadeORM.
- T06: `confirmar(usuario,pacienteId,dados)` só se D05/contrato de prova permitir;
  deve consumir exatamente a prévia/contexto autorizado e conteúdo editado.
  Desenho de capability/ledger/TTL depende da decisão, não inventar nesta tarefa.
- T08/T09: consumidor só usa DTO autorizado; identificadores/tokens permanecem
  nas fronteiras existentes; nunca passar secret para ClientComponent.

## Ciclo TDD exigido na implementação

Para cada T04–T10:

- [ ] Escrever teste com nome/caso/asserção do critério antes de alterar runtime.
- [ ] Executar e registrar RED do comportamento, distinguindo falha de ambiente.
- [ ] Implementar incremento mínimo dentro do contrato ratificado.
- [ ] Executar GREEN e regressões relacionadas; confirmar efeitos no banco real
      quando a propriedade não for demonstrável em mock.
- [ ] Revisar diff e registrar commit/resultado sem texto clínico/secrets.

## Cinco focos de revisão e tarefa proprietária

1. Primeira consulta/histórico truncado: T01/T04/T09, sem histórico inventado,
   janela e limite visíveis, source-by-source coverage.
2. Transferência A→B→A enquanto gera/confirma: T04/T06/T07, geração inválida
   monotonicamente; novo vínculo não restaura resposta/nonce/contexto antigo.
3. Texto adversarial/negação/decimal/unidade: T01/T03/T05, sem ferramentas,
   afirmação fora da fonte ou interpretação de dado como comando.
4. Timeout/confirmação incerta/two-tab: T05/T06/T07/T09, sem duplicata, sem
   sobrescrever edição humana; feedback claro e retry conforme nonce.
5. Modelo/fontes/flag/sessão mudam depois da prévia: T04/T06/T07/T08,409/refazer
   ou negar; autorização antes de qualquer retorno idempotente.

## Verificações futuras, não executadas neste planejamento

- `pnpm --dir octaclin-backend test --runInBand <spec318>`; typecheck/build;
  suíte ampla após correções; PG descartável com migrations completas/RLS.
- Teste Jest do adaptador HTTP/schema/credencial no backend; benchmark sintético
  só depois de T01/02, credencial e orçamento autorizados. FastAPI legado
  permanece em regressão no CI, sem rota nova ou chave BYOK.
- Web lint/typecheck/build, harness318 + `test:authz`, Playwrightdesktop/mobile,
  a11y, scanner/redação e workflow completo no HEAD da futura PR.

## Complemento BYOK obrigatório após D02 revisada

T02–T05 incluem fornecedor/modelo permitido, cadastro/substituição/revogação
cifrada da chave, escopo tenant/profissional, DTO sem segredo, endpoint oficial
allowlist e ausência de retry pago incerto. Testes negativos em T07/T08: outro
profissional/tenant/SuperAdmin não lê nem usa a credencial; chave revogada/trocada
não permite retorno antigo; segredo ausente/erro não vaza; sem URL arbitrária.
Chamadas reais sintéticas exigem credencial por canal seguro e orçamento; uso
clínico depende de contrato/finalidade/base legal. Não herdar consentimento317.

## Estado

- [x] T00 inspeção de base e análise dos gaps; D01–03 confirmadas.
- [ ] T00 fechar D04–06 e consolidar contrato de avaliação.
- [ ] T01–T12 não iniciadas, com checkpoints acima.
- [x] Nenhum runtime, migration, provider ou ambiente alterado na fase318.
