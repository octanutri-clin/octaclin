# Pendência — perfil da conta profissional

Registrada pelo proprietário em2026-10-13. Não implementada nesta correção.

Objetivo: área própria para completar e revisar dados pessoais/profissionais,
alterar dados permitidos e consultar os identificadores da própria conta/clínica.

Antes de implementar: inventariar Conta, Profissionais e vínculo usuário/perfil;
definir quais campos o titular pode editar e quais exigem gestor/verificação.
Preservar responsabilidade por pacientes, registro profissional validado,
assinaturas e snapshots históricos (Fases312/313), chaves BYOK e consentimentos.
Mudança de email/senha requer confirmação/reatenticação e política de sessões;
permissões/tenant/carteira não podem ser alterados pelo formulário de perfil.

Não criar cadastro paralelo. Incluir autorização da própria conta, validação,
criptografia/minimização, acessibilidade e testes negativos/concorrência.
Escopo e sequência serão aprovados antes do desenvolvimento do módulo completo.

Nesta rodada: expor somente identificadores já autorizados no DTO da listagem
Profissionais; isso não libera edição ou acesso a outros recursos.
