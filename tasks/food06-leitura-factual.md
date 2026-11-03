# FOOD06 M05/M07 — leitura cifrada e comparação interna

## Estado e alcance

PR455 Draft, branch docs/food06-contratos-fontes. Base local0cedaccd/remota80f658c4,
árvore idênticaf4b5276d. CI41679598259 e scanners dessa base SUCCESS: migrations
completas, inventário RLS, role runtime, suite, Testcontainers, Backend, Web,
Mobile, AI, Demo e PR Gate. Fecha a falha do inventário de a56cf204; não valida o
novo delta deste leitor. M05/M07 continuam parciais; **37,5% administrativos**,
1concluída/7parciais/4pendentes. Direitos/DRI/G06 permanecem BLOCKED.

Entregue neste incremento: leitor versionado do conteúdo já registrado, acesso
interno autorizado e comparação de DOIS registros do mesmo paciente. **Não há
endpoint, BFF, UI ou carregador DB dos planos/versões/revisões de origem ainda.**
O callback de gravação não é aceito do cliente. Não declarar M05/M07 encerradas
ou análise clínica disponível em produção por esta infraestrutura interna.

## Contratos e reuso

- `lerRegistroAnaliseFactual` valida JSON limitado10MiB e motor/schema suportados.
  Reconstrói a consistência usando os mesmos fatos congelados e o construtorv1
  existente: não consulta catálogo atual, não altera porções nem grava resultados.
  Compara canonicamente o registro inteiro: campos extras, avisos, marcadores ou
  totais incompatíveis falham fechados. Retorna cópia congelada em profundidade.
- Usa PA06/cobertura e aritmética já existentes. Zero comprovado continua distinto
  de ausente; dados parciais não recebem totais completos. Sem motor paralelo.
- A razão exata `porcaoRegistroGramas` guardada pelo escritor é decodificada com
  BigInt e representação decimal exata, conferindo sua forma canônica. Não dividir
  por Number nem usar prévia arredondada. Razões não decimais/não canônicas são
  recusadas. Não amplia os limites do escritor nem aceita underflow por inferência.
- Contexto resolvido conservado, sem recuperar ou inventar nascimento. Data civil,
  tipos, enums, motivos, idade/população documentadas e coerência estrutural são
  conferidos; marcador contextual é reconferido pela mesma política canônica.
  **Não reconfirma fatos clínicos originais, não decide nova elegibilidade nem
  substitui ratificação humana.** Não utiliza UTC ou navegador para escolher a
  data clínica; usa exclusivamente a data já gravada, validada pelo helper civil.
- Engine/schema futuros desconhecidos retornam erro seguro, sem converter/regravar
  silenciosamente históricos. Alterações futuras de política exigem leitor próprio.

## Autorização e proteção de dados

`ServicoRegistrosAnaliseFactual.ler` e `comparar` são métodos internos, sem rota.
Tenant e identidade vêm do contexto autenticado; só Professional atual com ler.
Mantém ordem profissional FOR SHARE → paciente FOR SHARE e revalida ambos ativos.
Registros são procurados por tenant/paciente/id. Sem exceção para SuperAdmin,
Client, Collaborator ou Patient. Sem transação aninhada.

Comparação primeiro autoriza os DOIS registros na mesma transação; se um não
pertencer ao paciente, não decifra sequer o outro. Confere envelope e binding
id/tenant/paciente/profissional/usuário/chave e o escopo interno do corpo. Cipher,
JSON, versões ou conteúdo incoerente produzem422 genérico, sem stack/corpo clínico.
Ausência/cross-paciente produz404; papel/permissão/tenant divergente403.

O registro completo retornado pelo leitor continua **protegido para composição
server-side**, incluindo escopo/contexto/hashes; jamais serializar esse objeto
como resposta HTTP. A comparação reutiliza `compararVersoesFactuais`, com fatos
separados, deltas, cobertura e dimensões documentais, sem atribuição causal.
A projeção não inclui tenant/paciente/contexto/cifra/marcadores em claro.

Transferência revoga o acesso do anterior; o responsável atual legítimo pode ler
o histórico do paciente, inclusive registros produzidos pelo anterior. Não exigir
ser o autor para ler história clínica já autorizada. Não transformar o vínculo
original gravado em autorização atual. Fontes/proveniência da futura gravação
continuam responsabilidade do carregador autorizado ainda não implementado.

Nenhuma leitura/comparação altera registro, auditoria original, porção, snapshot,
publicação, estado de grupo FOOD04 ou histórico. Não consulta composição viva.
Nenhuma migração nova ou alteração da1081; rollback do código preserva seus dados.

## TDD e provas

| Verificação | Estado e limites |
| --- | --- |
| Decoder inicial | RED4FAIL/18PASS funcionais (stub compilado) → GREEN22/22 |
| Métodos PG | RED3FAIL/1PASS nos novos casos (1corruption já passava pelo stub422, não conta como RED) → positivos e negativos com banco real |
| Precisão/contextos |50unitários PASS: bases fracionárias, razão decimal exata, ausências/zero, contexto incompleto/menor/futuro/gestação/lactação, dados extras, fonte futura e conteúdo incoerente |
| Foco integrado final |142/142PASS:50leitor+32construtor+39comparador+18PG+3schema, zero skipped |
| PostgreSQL regressões |41/41PASS,3suítes reais FOOD04/receitas/1081, zero skipped |
| Backend completo final |4.055PASS/198SKIPPED;384suítesPASS/10SKIPPED. Skips não validam banco/provider;18PG do delta executados separadamente |
| Node22 |22.23.4 compatível; typecheck, build Nest e artefato dist/main.js finais PASS; governança auditoria/migrations37/37PASS |
| R4 independente |food06_reader_r4:78unitários+18PG próprios inicialmente; P3 de coerência reproduzido4RED e corrigido; re-revisão final favorável com82unitários próprios (50leitor+32construtor), sem repetir PG após patch localizado |
| Web/Playwright/UX B/C novos |N/A neste incremento sem interface; permanecem gates da futura jornada |
| CI/scanners do delta |PENDING até publicação e consulta do HEAD exato; base verde não é aceite do delta |
| Operação externa |NOT RUN: sem staging/produção/Neon/Render/migrations/deploy/merge |

### Falhas preservadas e correção da observação de concorrência

Foco130 anterior:129PASS/1FAIL; regressões PG anteriores40PASS/1FAIL no teste de
revogação, antes da correção do observador. Não reclassificar esses runs como verdes.
A transação owner podia reutilizar o snapshot de pg_stat_activity, não enxergando
o lock recém-iniciado. Priming explícito das estatísticas ANTES do concorrente
reproduziu deterministicamente1RED/17SKIPPED. Acrescentado pg_stat_clear_snapshot()
a cada poll para renovar a observação, sem mudar locks, dados,60×50ms, timeout
ou asserts. GREEN130/130 e PG41/41 depois. Não é relaxamento da autorização.

Setup de teste it.each corrigido para receber a razão como um argumento, não tupla
expandida. Outro caso tentava criar1e-999 que o escritor existente já recusa; esse
input não produz registro legítimo. Cobertura válida usa1e-99 e teste explícito
preserva a recusa1e-999. Nenhum limite/motor foi afrouxado. O backend anterior
com essa fixture falhou1/4.041PASS/197SKIPPED; posterior4.043PASS/198SKIPPED.
Erros de setup não foram chamados RED funcional do produto.

### Correção R4 de coerência contextual

P3, sem bypass auth/crypto: idade definida junto de motivo de nascimento futuro
ou ausente; dois motivos de nascimento simultâneos; idade_fora_do_escopo sem idade.
O resolver nunca produz essas combinações. Reproduzidos4RED com marcador canônico
coerente (não basta adulterar o hash para o teste falhar por outro motivo).
Leitor exige exatamente um motivo de nascimento sem idade, nenhum deles com idade,
e idade_fora_do_escopo somente com idade documentada menor de19. Não alterou
resolver, regra clínica, escritor ou registros. GREEN142focados/82próprios R4.
Contextos legítimos incompletos continuam aceitos e inelegíveis como registrados.

Cwd backend, Node22 explícito (somente dados sintéticos):

```sh
FOOD06_REGISTRO_TESTCONTAINERS=true node node_modules/jest/bin/jest.js --runInBand src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.spec.ts src/modulos/planos-alimentares/aplicacao/leitor-registro-analise-factual.spec.ts src/modulos/planos-alimentares/aplicacao/construtor-analise-factual.spec.ts src/modulos/planos-alimentares/dominio/comparacao-versoes-factuais.spec.ts
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
```

Daemon Docker local, PG15-alpine em cache com tmpfs, banco sintético
food06_registry_test, owner para fixture e role food06_runtime sem bypass/ownership.
Nenhuma configuração externa de banco. Wrapper oficial Testcontainers já inclui
1081. Logs em /tmp/food06-leitor-*.log; arquivos de teste versionados reproduzem
as provas. Não generalizar prova de grant/TRUNCATE para owner ou produção.

## Próximo incremento

1. Conferir CI/scanners do novo HEAD e corrigir falhas comprovadas.
2. Carregador de planos/versões/revisões reais, carteira e fontes/proveniência na
   mesma transação, materialização/editorial explícita, CAS/stale/concorrência e
   contexto/timezone canônico da clínica. Não usar valores/hashes do navegador.
3. API/BFF com projeções mínimas e payload controlado para registrar, consultar e
   comparar. Não devolver objeto interno do leitor. Depois UI/UX B/C e teclado,
   desktop/mobile, erros, paginação/cobertura e testes de jornada.
4. Referência comum/DRI só após os gates científicos/jurídicos próprios.
   Não iniciar FOOD05-MDL/D18 ou qualquer ação operacional automaticamente.

## Fechamento técnico do incremento

Node22.23.4: foco142/142PASS e backend4.055PASS/198SKIPPED após correção R4.
Typecheck e build/artefato Nest finais PASS; governança37/37PASS; diff-check e
scanner local de segredos PASS. R4 independente final food06_reader_r4 favorável,
82/82 testes próprios finais e18/18PG próprios no checkpoint anterior ao P3.
Root executou PG18/18 também depois do P3 no foco142; regressões41PG repetidas.
Sem nova migration, dependência ou exposição HTTP. CI do HEAD a publicar permanece
PENDING. Fonte real/versões/CAS e API/BFF/UI continuam pendentes explicitamente.

A primeira instância de revisão ficou pending_init, interrompida sem edição;
food06_reader_r4 realizou a revisão efetiva acima. Não contabilizar espera ou
inicialização de agente como revisão executada. PR455 continua Draft e G06/direitos
BLOCKED. Nenhuma operação externa ou mudança na FOOD05-MDL/FOOD05/FOOD07.
