# OctaClin — Lessons Learned

> Status: ativo  
> Fonte de verdade para: incidentes de engenharia e regras permanentes derivadas deles

## 1. Regra principal

> **Não conclua a partir de algo adjacente à evidência. Conclua a partir da evidência.**

O objetivo deste documento não é punir erros. É impedir repetição.

Sempre que um incidente revelar uma regra reutilizável:

1. registre o incidente;
2. registre a correção;
3. transforme a prevenção em teste/gate quando possível.

## 2. Produção não é integração

### Erro

Inferir capacidade/permissão de produção a partir do banco de integração.

### Lição

Produção e integração podem utilizar roles e permissões diferentes.

### Regra

Antes de qualquer afirmação sobre um banco:

- confirme ambiente;
- confirme identidade de forma fail-closed;
- não imprima a connection string;
- execute a prova no ambiente sobre o qual está afirmando.

---

## 3. Resultado correto pelo motivo errado não é prova

### Erro

Uma constraint pareceu bloquear inserts, mas o erro real era de protocolo antes da avaliação da constraint.

### Regra

Valide código e nome da constraint/erro esperado.

Ao criar guarda, observe o RED e leia a mensagem.

---

## 4. `validado` exige gates nomeados

### Erro

Uma execução parcial foi tratada como validação completa.

### Regra

Liste cada gate executado e o resultado.

`skipped` significa não verificado.

---

## 5. Criar arquivo não significa registrar artefato

### Erro

Migration existia no repositório, teste próprio passava, mas não estava registrada no array explícito do TypeORM.

### Regra

Ao criar artefato, procure onde os irmãos são registrados.

Vale para:

- migrations;
- entidades;
- módulos;
- rotas;
- DTOs;
- providers.

Quando completude importa, prefira comparação exata de conjuntos a `arrayContaining`.

---

## 6. Número em prosa precisa de consulta

### Erro

Impacto quantitativo foi descrito por memória sem contagem real.

### Regra

Toda quantidade operacional relevante deve vir de comando/consulta fresca.

---

## 7. Rollout de DDL precisa provar cada camada

### Lição

Rollout de migration não é apenas “merge → deploy”.

Deve cobrir:

- ponto de retorno;
- ensaio coerente;
- aplicação com role autorizada;
- deploy;
- monitoramento.

Seguir sempre o `RUNBOOK_PRODUCAO.md` vigente.

---

## 8. Estado remoto deve ser relido antes da ação

### Regra

PR, merge status, CI e produção mudam.

Leia estado no mesmo ciclo da decisão.

---

## 9. Shell e edição automatizada podem mentir

### Incidentes

- CRLF/LF alterou matching;
- heredoc/`node -e` foi quebrado pelo shell;
- `sed` alterou backslashes;
- script fora do pacote não encontrou dependência;
- imports incompatíveis com configuração TypeScript;
- runtime presumido não existia.

### Regra

Leia `ENVIRONMENT_PLAYBOOK.md`.

Scripts de edição devem falhar explicitamente quando o trecho esperado não for encontrado.

---

## 10. Não aguarde CI por listagem aproximada

### Erro

Loop baseado em `gh run list` concluiu incorretamente que a execução havia terminado.

### Regra

Espere pelo ID do run específico.

Exemplo:

```sh
until [ "$(gh run view <id> --json status --jq .status)" = "completed" ]; do
  sleep 30
done

gh run view <id> --json jobs --jq '.jobs[].conclusion'
```

---

## 11. Erro de configuração do TypeScript esconde erros seguintes

### Erro

Um bump do compilador revelou erros em série porque `tsc` parava no primeiro erro de configuração.

### Regra

Para bump de compilador, execute o compilador alvo contra o `node_modules` real antes de declarar compatibilidade.

Exemplo conceitual:

```sh
pnpm --package=typescript@<versao> dlx tsc --noEmit -p tsconfig.json
```

---

## 12. Bump que muda API não entra sozinho

### Erro

Dependência nova exigia adaptação de código e o bump isolado quebraria `main`.

### Regra

Quando versão e código são atomicamente dependentes, entram juntos.

---

## 13. Pnpm diferente pode gerar lockfile ruidoso

### Regra

Revise diff do lockfile e restaure alterações não relacionadas.

Nunca aceite mudança ampla de lockfile só porque o comando terminou com sucesso.

---

## 14. Auto-merge textual não prova lockfile válido

### Erro

PRs concorrentes no lockfile ficaram “clean” no Git, mas a combinação podia divergir do `package.json`.

### Regra

Rebase/regere lockfile contra a árvore combinada e rode modo equivalente ao `--frozen-lockfile` do CI.

---

## 15. Health check deve respeitar uso real

### Erro

Integração não utilizada degradou health global por configuração parcial e abriu incidente.

### Regra

Severidade deve refletir uso e impacto real.

Antes de mergear health check capaz de afetar status global, compare com configuração real do ambiente alvo.

---

## 16. DDL pode quebrar boot antes do aviso

### Erro

Produção tentou executar migration DDL no boot com role sem `CREATE`, gerando loop de deploy.

### Regra

Antes de mergear DDL, confirme que a configuração real de produção corresponde ao procedimento do runbook.

Não confie apenas no valor documentado.

---

## 17. Integração precisa estar na altura correta do schema

### Erro

Ambiente de integração tinha migration pendente além daquela sendo ensaiada.

### Regra

Antes de rollout, compare schema/migrations relevantes.

Se integração não representar o ponto de partida de produção, reconcilie antes do ensaio.

---

## 18. PowerShell/globs/patches amplos

### Incidentes

- expansão de glob incompatível;
- curinga passado literalmente;
- patch amplo encontrou contexto diferente.

### Regra

- passe arquivos explicitamente;
- releia contexto imediatamente antes de patch amplo;
- faça patches pequenos;
- falhe se o trecho esperado não existir.

---

## 19. PTY desnecessário em servidor local

### Erro

Servidor Next falhou em Windows ao ser iniciado com PTY.

### Regra

Use PTY apenas para comando realmente interativo.

Encerre processos filhos e confira portas antes de novo E2E.

---

## 20. Mock global deve respeitar contratos do shell

### Erro

Fallback genérico retornou shape incompatível para notificações e contaminou o RED.

### Regra

Mocks globais devem mapear contratos compartilhados antes dos fallbacks.

---

## 21. Playwright Locator é reavaliado

### Erro

Valor “anterior” foi lido após a interação a partir de locator dependente do estado atual.

### Regra

Congele o valor anterior antes da interação quando o locator for dinâmico.

---

# Registro de novos incidentes

Adicionar novos itens usando:

```md
## <título>

### O erro
Sintoma exato, mensagem/código/comando quando útil.

### A solução
O que efetivamente corrigiu.

### Como não repetir
Teste, gate ou verificação preventiva.

### Custo
Tempo, CI, deploy, incidente, risco ou impacto.
```

## Regra final

Se uma lição puder virar automação, ela deve evoluir de:

```text
memória
→ documentação
→ teste
→ linter/scanner
→ gate de CI
```
