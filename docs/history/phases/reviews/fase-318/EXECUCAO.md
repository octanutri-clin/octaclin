# Ledger — plano: tasks/todo-fase-318.md

Base8ea67a08; planejamento atédfd19518; execução autorizada2026-10-13.
RiscoR4: PHI/credencial/tenant/schema. Nenhuma mudança externa autorizada.

Pre-flight: T04 fornece contexto/gates para T05/T06; contexto fora de lock durante
await exige revalidação monotônica. T06 usa builder transacional da evolução.
Ruling: scripts cloud da skill não têm caminho executor local; ledger versionado
neste documento e logs próprios em /tmp/f318-evidencias preservam decisões.
Ruling: espaço218MB impede Timescale local; PG deve ser comprovado no CI
com fixture descartável, sem usar bancos de staging/produção ou simular Timescale.
Ruling: catálogo assistencial sem modelos ratificados; default vazio.
Catálogo sintético injetado somente em teste, sem env de mock em produção.
G01/G02BLOCKED; permissões de produto não os fecham. Nenhum provedor real chamado.

## T01–T03
Corpus documental30casos disponível; executar harness com saídas sintéticas/mock
não valida qualidade de OpenAI nem revisão humana. Criar mecanismo reproduzível,
sem marcar comparação clínica comoPASS ou escolher modelo por plausibilidade.

## T04 em andamento
Domínio/provas/DTOs e testesRED antes do código. Próximo: contratos de fontes,
criptografia/contexto/limites e gate efetivo de provider bloqueado por padrão.

### Fundamentos comprovados
Node22.23.3 oficial/hash df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de.
Toolchain antigo ausente: primeira invocação pnpm falhou por ambiente, não RED.
Arquivo inicial removido; esqueletos compiláveis permitiram RED funcional antes
dos corpos: domínio14FAIL; schema2FAIL; adaptador5FAIL/1PASS. O teste de erro
externo tinha falso positivo no esqueleto e foi fortalecido para exigir rejeição;
não declarar esse1PASS como prova de sanitização. GREEN22tests antes da força
adicional; repetir na próxima rodada. Nenhum fetch real chamado.
Ruling: geração monotônica por triggersBEFOREUPDATE nos três escritores canônicos
(pacientes/profissionais/usuarios), protegendo contador contra downgrade e cobrindo
caminhos SQL/ORM. Migration1071 aditiva registrada; nenhuma migration externa.
Ruling: catálogo vazio e direitosBYOK false no provider de produção; injeção
sintética só nos testes. Variáveis/cliente não aprovam protocolo ou contrato.
Prova PG ainda pendente; testes de SQL/mock não fecham RLS/concorrência.
