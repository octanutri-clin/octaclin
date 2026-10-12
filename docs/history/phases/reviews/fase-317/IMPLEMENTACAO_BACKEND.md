# Incremento backend da Fase 317 — evidência e segurança

Registro histórico do incremento anterior à interface. O estado posterior e as
correções estão em [segunda revisão R4](REVISAO_R4.md) e no handoff da fase.

Implementação técnica autorizada; nenhum ambiente externo alterado e nenhum
piloto habilitado. Esta evidência não é revisão independente nem liberação.
A worktree/branch e a próxima ação estão em `tasks/plan-fase-317.md`.

## Entrega do núcleo

- Configuração317 independente da legada, default false, gate operacional literal.
  Client da própria clínica e SuperAdmin podem configurar. Identidade, papel,
  sessão quando presente e alvo são reconferidos no banco.
- Conquistas manuais da sessão profissional atual, snapshot cifrado imutável,
  compartilhamento explícito por geração e consentimento do próprio Patient.
  Transferência não transfere automaticamente a autorização de compartilhamento.
- Círculos privados, convites de7dias, nome confirmado vinculado a DOB/usuário/
  profissional, aceite específico, saída/revogação e encerramento.
- Posts imediatos, comentários, edição/revisões, retirada e curtidas com nomes
  confirmados. Feed, comentários e nomes usam a mesma elegibilidade atual.
- Denúncias privadas com cópia cifrada; profissional da carteira atual decide.
  Contagem de denúncias não cria retirada ou classificação automática.
- Revogação e projeções próprias de privacidade continuam com flags desligadas;
  não revelam nomes, textos ou cadastro. Consentimentos antigos também revogáveis.
- Nenhuma rota aceita publicação em nome de paciente. Sem pontos, ranking,
  anexos, links automáticos, fotos ou notificações externas no modelo317.
- APIs legadas filtram modelo1; catálogo piloto não vira concessão legada.
  Campos novos sensíveis select:false nas entidades compartilhadas.

## Banco, concorrência e retenção

Migration1070 aditiva e registrada; seis tabelas novas com ENABLE/FORCE RLS,
relações compostas tenant/recurso, índices, estado/geração/versão e triggers de
concessão/revisão. NOT VALID preserva linhas legadas, mas valida novas escritas;
a validade histórica exige preflight posterior, não se presume.

Serialização por tenant no piloto limitado (5 círculos por profissional,
50 participantes por círculo), com locks de pacientes/usuários/profissional e
versão esperada. Ledger cifrado por usuário/chave/fingerprint; revalidar acesso
antes de replay. Quotas10/30/5 por minuto para conteúdo/reações/denúncias. Configuração
administrativa usa CAS de versão sem ledger: stale409 e nenhum segundo efeito.

Retenção90dias inicia na retirada/saída; revisões de comentários em posts de
outras pessoas também recebem prazo. Worker/all processa todos os tenants,
inclusive inativos, sem depender de flags. Erros da rodada usam mensagem fixa,
sem payload ou erro bruto. Prazos impedem leitura já no serviço; a deleção física
é periódica e precisa de worker/monitoramento operacionais.

Expurgo remove corpos, revisões, denúncias vencidas e relações de identidade da
comunidade quando os FKs permitirem. Hold vigente mantém apenas evidência cifrada
e os esqueletos de FK necessários, nunca republica. Gestor Client registra
necessidade legal explícita/cifrada e prazo de revisão de até90dias a partir do
registro; não obtém leitura clínica. Registro vencido não ganha hold retroativo.
Tombstone mínimo de nonce permanece; fingerprint e resultado expiram, evitando
recriação por retries antigos. Concessões clínicas/legado não são apagadas pelo job.

## Verificações e correções do ciclo

Resultados finais e hashes de fontes/logs constam em `backend-verification.json`.
Todos os dados de teste são sintéticos e PG usa container descartável com role
não owner, nosuperuser e nobypassrls. Nenhuma prova usa staging ou produção.

Correções encontradas e verificadas:

1. Listagem legada expunha círculos317: teste PG falhou, filtro de modelo e proteção
   de escrita aplicados; nova rodada passou.
2. Nome cifrado adulterado não deve integrar perfis; excluído da projeção e elegível
   para revogação/limpeza, sem expor erro de cifra.
3. Revisão protege também expurgo prematuro/null e IDs; COALESCE explícito evita
   a semântica NULL do PostgreSQL enfraquecer o trigger.
4. Fixture de revisão selecionava apenas prazoNULL depois de todos os autores
   terem saído: ajustada para revisão ainda não vencida. Não afrouxou o trigger.
5. Typecheck detectou rota administrativa posicionada no DTO: movida ao controlador
   Client e adicionada regressão de propriedade da rota.
6. Governança detectou metadados genéricos conquistas/comunidade não cobertos:
   nomes de flags explícitos; whitelist somente do booleano operacional novo.
7. Down sem dados deixaria schema e apagaria o ledger da migration: agora recusa
   também esse caso. Rollback é funcional e preserva schema/registro/histórico.

A suíte geral pula testes condicionais por ambiente; a prova RLS é executada
separadamente pelo script, que agora inclui o piloto317 no CI existente. Aviso
pg sobre queries concorrentes permanece em testes existentes; não é aprovado
como desaparecido nem justifica mudar dependência neste escopo.

## Limitações/gates de segurança

- R4: revisão independente NÃO executada; revisão do próprio implementador e
  testes não a substituem. G02 continua BLOCKED para liberação.
- HTTP real foi testado com autenticação/serviços simulados e guards/validação
  reais. JWT e serviços/RLS têm suites separadas; ainda não é E2E de navegador.
- Cobertura percentual não medida neste incremento; nenhuma declaração de95%.
- CI remoto, BFF/UI/demo/Playwright/axe ainda pendentes na fase.
- Termo final e capacidade/rotina de moderação precisam de revisão operacional.
- Aplicação/validação externa da1070 não autorizada/executada. Grants/owner/RLS,
  NOT VALID, possíveis órfãos e disponibilidade do worker precisam de preflight.
- A rodada física periódica não é garantia de exclusão dentro de SLO sem worker
  saudável, alerta e prova operacional. Flag desligada não suspende retenção.

## Rollback e ativação

Não usar migration:revert; down recusa e preserva o ledger. Rollback funcional:
flag317 false e gate operacional ausente/false, mantendo o código de isolamento
legado, revogação e retenção. Não restaurar uma imagem anterior às proteções
317 após existir dado do piloto: o legado antigo não conhece o isolamento novo.
Conservar schema, snapshots e tombstones. Nenhum job recalcula/reescreve legado.

Antes de piloto: UI/gates/CI final, revisão independente R4, termo/moderação,
preflight/migration fora de banda com autorização/alvo/role identificados,
validação de grants/FKs/worker/expurgo e autorização explícita de liberação.
Uma única PR da317 deve reunir backend e interface; merge/deploy não autorizados.
