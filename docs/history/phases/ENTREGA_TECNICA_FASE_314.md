# Fase 314 — execução técnica controlada

## Autorização e fronteira

O proprietário autorizou desenvolvimento, testes sintéticos, PostgreSQL local descartável, commits e uma PR Draft. Essa autorização substitui os limites operacionais documentais anteriores e a sugestão P0 da REV5. Não autoriza ratificação clínica, direitos comerciais, ativação assistencial, merge, staging/produção ou deploy.

Risco R4: snapshots clínicos, tenancy, autorização e imutabilidade. Um escritor ativo; revisões prévias preservadas no commit `cee05f20`. Base remota conferida: `f8c5ab66f2708d4a73fc31d460f929a665bd6f08`. Sem acesso a dados reais.

## Estado técnico em execução

- Datas civis estritas, dias e meses estatísticos separados; convenção civil explícita para mês curto/29 de fevereiro. A ratificação da política clínica de aniversário continua pendente.
- Snapshot pediátrico v1 cifrado na estrutura de avaliações existente. Confirmação explícita, chave idempotente, lock por paciente e por chave; escopo revalidado antes de replay. Divergência cadastral impede novos registros, sem alterar anteriores.
- Registro de medidas parciais e contexto ausente/desconhecido. Quatro indicadores ficam bloqueados por ratificação; não há flag de cliente ou ambiente que os habilite.
- Endpoint paginado na transação tenant existente: ordenação por data, instante e UUID, cursor SQL preservando precisão. O cursor avança pelo último registro examinado antes de filtrar snapshots pediátricos. Nenhuma observação ou fingerprint na projeção.
- Console com registro, resultado de bloqueio, contexto preservado, tabela e gráficos de medidas originais; séries separadas quando contexto/técnica mudam. Sem novos fluxos de portal.
- Proteções de menores e dos seis métodos 18–19 pendentes individualmente. Resultados legados são lidos sem recálculo. Gestação mantém precedência.
- Candidatos matemáticos isolados: LMS direto/inverso/interpolação de parâmetros, caudas por configuração, quatro indicadores, normalização OMS proposta, flags/edema e política de prematuridade versionada. Não são consumidos pelo serviço assistencial, não incluem datasets comerciais não comprovados.
- Coeficientes INTERGROWTH somente no teste de investigação, excluído do build; sem código R copiado. Oráculos arquivados exclusivamente sintéticos. Concordância amostral não comprova fonte primária nem direitos.

## Evidências obtidas nesta execução (parciais; repetir no HEAD final)

| Verificação | Resultado observado |
| --- | --- |
| TDD datas/matemática | RED por módulos ausentes; depois 16 PASS |
| Domínio, proteção etária e regressão antropométrica | 63 PASS |
| Serviço pediátrico/DTO/serviço pacientes | 103 PASS |
| Backend completo intermediário | 285 suites PASS, 3 SKIPPED; 2574 testes PASS, 49 SKIPPED |
| PostgreSQL descartável baseline | 29 PASS, duas execuções; inclui 1068 local; não comprova staging/produção |
| PostgreSQL pediátrico adicional | 31 PASS antes da retomada: RLS, carteira/transferência, concorrência/replay, DELETE recusado e rollback seguro. Repetição final em andamento no ambiente retomado |
| INTERGROWTH investigação | 17 PASS; 14 casos, 28 resultados; 55 semanas permanece divergência semanal conhecida |
| Quatro indicadores com LMS sintético | 8 PASS; não valida clinicamente datasets ausentes |
| Política CL07 candidata | 4 PASS; não ratificada |
| BFF Fase314 | 1 teste composto PASS (sessão/permissão/cursor/limite/cache/erro) |
| Backend typecheck/build intermediário | PASS |
| Web typecheck intermediário | PASS após correção da propriedade `variante` |
| Web lint intermediário | PASS sem erros, 69 warnings; correções dos warnings novos em andamento |
| Playwright Fases313/314 + axe | 6 PASS desktop/mobile antes da retomada, após corrigir timeout de navegação e rolagem acessível. Repetição final pendente do build |
| Web build/authz completos | IN_PROGRESS |

Testes são locais e sintéticos. Oráculos independentes arquivados não constituem revisão independente do patch. Ainda não houve revisão cruzada humana.

## Rollback e ambientes

Desabilitar a entrada da interface/rota em rollback de aplicação preserva snapshots cifrados e o histórico. Nunca recalcular ou apagar registros para voltar código. Nova migration 1069 acrescenta proteção BEFORE DELETE para avaliações confirmadas. `down()` recusa com dados; legado e exclusão lógica preservados. Procedimento em `RUNBOOK_PRODUCAO.md`; 1068 não foi editada. A aplicação de 1068 fora deste PostgreSQL descartável permanece não verificada. Migrations de staging/produção exigem evidência externa do operador e autorização operacional separada.

## Gates

| Gate | Estado atual |
| --- | --- |
| G00 | Parcial: base/contratos locais PASS; fontes/direitos BLOCKED; operação externa 1068 BLOCKED/consulta SKIPPED |
| G01 | BLOCKED: origem/precisão primária IG, direitos concretos e fechamento integral OMS/55s |
| G02 | BLOCKED: CL01–10 sem ratificação humana específica |
| G03 | PASS para desenvolvimento; BLOCKED para ativação assistencial |
| G04 | IN_PROGRESS: suites e provas do HEAD final necessárias |
| G05 | BLOCKED: revisão R4/CI/ratificações/ambientes e autorização de merge/produção |


## Revisão de segurança e regressões

Superfícies revisadas: DTO, serviço, controlador, paginação SQL, projeções
executáveis, portal legado, candidatos sem consumidores assistenciais, build
e migration aditiva. Testes negativos cobrem autorização antes de replay,
transferência de paciente, tenant externo, cursor, conteúdo extra, acesso
revogado e bloqueio de compartilhamento pediátrico. Os resultados e contexto
estão cifrados; auditoria contém somente contagem, BFF usa private/no-store,
nenhum dataset/equação de direitos pendentes entra no runtime assistencial.

Defeito identificado e corrigido: o fluxo legado de peso e métricas poderia
publicar avaliações pediátricas. Leitura do portal agora exclui tais avaliações
e PATCH de compartilhamento as rejeita. TDD apresentou dois testes FAIL e,
após correção, 49 PASS nos serviços pediátrico/portal.

Limites: revisão realizada pelo mesmo autor, não independente. O fluxo formal
da skill security-diff-scan está SKIPPED porque seu recurso obrigatório
config-preflight não ficou disponível; leitura da skill não equivale a scan
formal aprovado. Não houve alteração externa de permissões, banco ou ambiente.
Snapshot ilegível não é parcialmente exposto. Dataset, cobertura/âncoras OMS,
coeficientes primários INTERGROWTH/55 semanas e direitos concretos permanecem
pendentes. Sem ratificação, a entrega permite medidas e histórico, sem
escore/classificação assistencial.

## Retomada de ambiente

A worktree e os arquivos foram preservados; logs/processos temporários do
ambiente anterior não foram transferidos. As suites foram reiniciadas;
resultados anteriores são intermediários, não prova do HEAD final. Node
22.23.3 e PowerShell 7.6.6 temporários tiveram SHA256 oficial conferido.
O launcher pnpm inicial do ambiente é 11.19; processos de teste usam Node 22.
A ferramenta temporária pnpm 11.25 foi instalada para os comandos seguintes,
sem modificar dependências ou lockfiles do projeto.
