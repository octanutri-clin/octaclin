# Piloto sintético BYOK318 — ficha para aceite e operação

Status: proposta de custódia para revisão humana; não equivale a parecer jurídico,
liberação clínica ou aprovação das condições comerciais da OpenAI.

## O que o profissional usará

- Casos inteiramente inventados e versionados, fornecidos pelo servidor. Não há
  acesso a prontuários, arquivos, pacientes ou texto clínico livre neste modo.
- Composição factual local não usa IA e não tem custo de API. Comparação OpenAI
  será opcional, com modelo permitido, modalidade e confirmação de cobrança.
- Chave individual de projeto cadastrada pelo próprio titular. HTTPS, cifra no
  backend e escopo de tenant/profissional/usuário; nunca leitura do valor na API.
  Não enviar a chave em conversa, suporte ou GitHub. Não compartilhar contas.
- A remoção no OctaClin não revoga a chave na OpenAI. Revogar/substituir no
  fornecedor em caso de incidente. O consumo é cobrado na conta do profissional.
- `store:false` não comprova Zero Data Retention. Não prometer retenção zero,
  região específica ou teto de cobrança do fornecedor sem contrato/configuração.
- Sem ferramentas externas, busca, arquivos ou retries pagos automáticos. Timeout
  ou falha podem ocorrer após o fornecedor ter recebido a solicitação e cobrado.
- Saída e notas ficam apenas na tela. Sair, ocultar a página, fechar a revisão ou
  mudar de sessão descarta a revisão. Não há gravação/confirmar em prontuário.
- Até cinco chamadas em quinze minutos e cooldown conservador de dois minutos;
  limite de saída máximo2048tokens, inferior se o modelo impuser menor limite.
  Esses controles não são uma garantia de gasto monetário total do fornecedor.
- Auditoria mínima registra solicitação e alterações de credencial, sem fontes,
  chave, provas, saída, notas de revisão ou custos individuais.

## Aceites que ainda precisam de evidência

1. Responsável institucional confirma que o desenho de custódia/uso da chave
   individual é permitido pelas condições atuais do fornecedor, finalidade,
   responsabilidades, resposta a incidentes e retenção aplicáveis ao piloto.
   Consentimento de produto não substitui essa verificação.
2. Titular confirma ciência da custódia, revogação e cobrança antes de cadastrar
   a chave e iniciar comparações. O checkbox por chamada confirma somente cobrança;
   não inventa um contrato institucional nem libera uso com pacientes reais.
3. Operação valida os IDs fornecidos pelo titular contra o vínculo autenticado,
   grants/RLS/role semBYPASSRLS e ambiente; habilita somente o alvo autorizado.
4. Equipe revisa os30casos:19de qualidade factual e11de contrato/segurança, com
   resultado por caso, omissões, afirmações sem suporte, correções e tempo.
   Teste automatizado do pipeline não equivale a aprovação clínica do modelo.

## Gates separados

- Composição local sintética: código/testes/CI, revisãoR4 e autorização de
  configuração restrita. Não depende de direitos de envio à OpenAI.
- Cadastro/chamada OpenAI sintética: além dos anteriores, custódia/condições
  ratificadas e catálogo candidato aprovado para ensaio. Bloqueado no backend.
- Uso com pacientes reais: gatesG01/G02/G05clínicos originais, base legal,
  privacidade, revisão dos casos e autorização operacional próprias. Não liberado.

Fontes científicas e preços são evidência técnica, não parecer jurídico.
As verificações públicas e suas limitações estão no relatório de execução.
