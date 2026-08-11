# Capacidade - Oferta comercial e ativacao assistida

Status: aceita na Fase 224 em 2026-08-11. A oferta nao pode ser divulgada nem
ativar cliente real antes dos gates legais de `PACOTE_JURIDICO_COMERCIAL.md`.

## Capacidade

O OctaClin deve permitir que a pessoa responsavel comercial venda e ative uma
clinica de forma assistida, aplicando o plano aprovado, convidando a equipe e
acompanhando o primeiro uso sem depender de gateway de pagamento ou acesso ao
banco de dados.

## Restricoes fixas

- A aplicacao tem os planos `gratuito`, `profissional`, `clinica` e
  `enterprise`, definidos em `octaclin-backend/src/modulos/clientes/dominio/planos-saas.ts`.
- `SuperAdmin` aplica o plano pelo painel `/operacoes`; o cliente apenas
  solicita upgrade ou revisao pelo portal. A operacao manual nao concede acesso
  a pagamentos nem a dados clinicos fora do tenant.
- Limites existentes: Profissional suporta 3 usuarios administrativos, 100
  pacientes, 1.000 mensagens/mes, 20 formularios ativos e 2 GB; Clinica suporta
  12, 500, 5.000, 80 e 10 GB. `Enterprise` e negociado e sem limites fixos.
- Bloqueio e suave: o tenant suspenso/cancelado ou no limite perde criacoes
  novas, mas preserva leitura, historico, exportacao e dados essenciais.
- Contrato, aceite, dados empresariais, preco e meio de pagamento nao podem ser
  inseridos em commits, logs, auditoria tecnica ou documentos publicos.
- WhatsApp, API publica, webhooks e IA ficam fora da oferta inicial, a menos
  que sejam habilitados e aceitos em seus respectivos gates operacionais.

## Oferta inicial proposta

### Perfil ideal de cliente (ICP)

- Profissional de nutricao ou consultoria de saude que hoje organiza agenda,
  acompanhamento e comunicacao em ferramentas separadas.
- Clinica pequena que precisa de mais de um usuario administrativo e de uma
  carteira compartilhada por profissionais autorizados.
- Primeiro piloto deve ter um responsavel operacional disponivel, poucos
  usuarios iniciais e disposicao para uma ativacao acompanhada de 48 horas.

### Pacote Profissional assistido

- Plano tecnico: `profissional`.
- Preco: R$ 99 por mes no pagamento trimestral antecipado, ou R$ 119 por mes
  no pagamento mensal manual antecipado.
- Inclui: agenda interna, Google Agenda opcional por profissional, pacientes,
  prontuario, formularios, check-ins, tarefas, materiais, portais, email e
  suporte assistido.
- Exclui por padrao: WhatsApp produtivo, API publica, integrações sob medida,
  white-label, suporte clinico e migracao sem avaliacao previa.

### Pacote Clinica assistido

- Plano tecnico: `clinica`.
- Preco: R$ 199 por mes no pagamento trimestral antecipado, ou R$ 249 por mes
  no pagamento mensal manual antecipado.
- Inclui o pacote Profissional e a capacidade adicional do plano para equipe e
  carteira maior.
- Requer que o cliente designe um administrador e um responsavel operacional
  antes de receber convites.

### Enterprise

- Nao e oferta de autoatendimento. Exige proposta individual, revisao juridica,
  limites, integracoes, seguranca e suporte acordados antes de ativar o tenant.

### Politicas comerciais aceitas

- Pagamento inicial: PIX/manual antecipado. Gateway permanece posterior a
  necessidade comercial comprovada.
- Demonstracao: somente ambiente com dados sinteticos. Nao existe teste com
  dados clinicos reais antes de dominio, juridico e seguranca estarem aceitos.
- Cancelamento: aviso de 30 dias; ao fim do periodo, a assinatura passa a
  `suspensa` e usa bloqueio suave. Dados permanecem acessiveis e exportaveis.
- Migracao: importacao CSV padrao esta incluida. Migracao assistida, limpeza de
  planilha ou integracao especifica exige escopo e valor separados.
- WhatsApp: fora da oferta inicial ate seu aceite operacional de producao.
- Suporte: ativacao assistida, acompanhamento reforcado de 48 horas e suporte
  operacional; nunca suporte clinico.

## Contrato de implementacao

### Atores e superficies

| Ator | Responsabilidade | Superficie |
| --- | --- | --- |
| Responsavel comercial | Qualificar, apresentar proposta e registrar aceite fora do Git. | Processo comercial externo aprovado. |
| SuperAdmin | Revisar gates, aplicar plano, acompanhar solicitacoes e escalar incidentes. | `/operacoes`. |
| Cliente administrador | Receber convite, configurar clinica, equipe e preferencias. | Portal do cliente. |
| Profissional | Configurar rotina e opcionalmente conectar a propria Google Agenda. | Console profissional. |
| Suporte | Acompanhar primeiros acessos e incidentes sem solicitar segredos. | `RUNBOOK_SUPORTE.md`. |

### Estados e transicoes

1. `qualificado`: caso se encaixa no ICP e tem responsaveis identificados.
2. `proposta_em_revisao`: plano, limites, preco, vigencia e exclusoes foram
   registrados no processo comercial externo.
3. `contrato_aceito`: contrato/anexos e versoes legais aplicaveis foram aceitos.
4. `pre_ativacao`: o checklist de onboarding e os gates tecnicos foram
   revisados; ainda nao enviar convites.
5. `ativo_assistido`: SuperAdmin aplicou o plano no tenant, configurou itens
   aprovados e enviou convite ao administrador inicial.
6. `primeiro_uso_validado`: administrador entrou, configurou equipe e executou
   uma jornada acordada sem falha P0/P1.
7. `acompanhamento_48h`: monitoramento e suporte reforcados; conclusao produz
   decisao de manter, corrigir ou pausar a expansao.

Transicoes para `suspensa` ou `cancelada` continuam usando o controle manual
da Fase 101 e os bloqueios suaves da Fase 102. Nao modificar plano por pedido
informal, print ou mensagem sem registro comercial autorizado.

### Sequencia operacional obrigatoria

1. Preencher `CHECKLIST_ONBOARDING_COMERCIAL.md` fora do Git, no processo
   comercial autorizado.
2. Validar contrato, privacidade, identidade e escopo das integracoes.
3. No portal operacional, aplicar somente o plano aprovado ao tenant correto.
4. Configurar limites/padroes apenas se estiverem previstos na proposta.
5. Convidar primeiro o administrador; ele cria os demais usuarios pela
   interface, sem compartilhamento de senha.
6. Executar jornada de primeiro uso e registrar evidencias minimas sem PII.
7. Acompanhar 48 horas usando monitoramento e `RUNBOOK_SUPORTE.md`.

## Dados e seguranca

- A proposta comercial, contrato assinado e informacoes de pagamento ficam no
  sistema comercial/contabil autorizado, nao em `tenant_configuracoes` nem em
  campos livres de auditoria.
- A aplicacao armazena somente estado tecnico de plano, limite e solicitacao
  comercial ja existente. Nunca registrar numero de cartao, senha, token ou
  credencial de terceiros.
- Aplicar principio de menor privilegio: o SuperAdmin opera plano; o cliente
  controla sua equipe; o profissional nao administra assinatura de terceiros.

## Nao objetivos

- Nao introduzir gateway, cobranca recorrente, nota fiscal, cupom ou dunning.
- Nao prometer WhatsApp, API publica ou integracoes nao aceitas.
- Nao automatizar criacao de tenant sem contrato, onboarding e seguranca
  aprovados.
- Nao substituir revisao juridica, contabil ou comercial.

## Decisoes operacionais ainda pendentes

1. Escolher o sistema comercial privado que guardara proposta, contrato e
   comprovante de pagamento.
2. Definir o reajuste anual antes da primeira renovacao; nao criar clausula sem
   revisao juridica.
3. Concluir identidade empresarial e dominio oficiais, que tambem condicionam
   comunicacoes transacionais e documentos finais.

## Handoff

O responsavel pelo produto deve registrar cada proposta em processo comercial
privado e seguir para Fase 225. A Fase 228 exercita este contrato com uma
clinica sintetica; a Fase 233 o aplica ao primeiro cliente real aprovado.
