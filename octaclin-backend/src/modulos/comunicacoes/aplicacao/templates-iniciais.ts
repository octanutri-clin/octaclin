import { EntityManager } from 'typeorm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

/** Conteúdo genérico e versionado. A clínica pode editar cada cópia após instalar. */
export const TEMPLATES_INICIAIS_EMAIL = [
  {
    codigoExterno: 'octaclin_inicial_boas_vindas',
    nome: 'Boas-vindas à clínica',
    conteudo: {
      assunto: 'Boas-vindas',
      corpo: 'Olá {{nome}}, seu acesso à clínica está disponível. Se precisar de ajuda, entre em contato com a equipe.'
    }
  },
  {
    codigoExterno: 'octaclin_inicial_consulta',
    nome: 'Consulta agendada',
    conteudo: {
      assunto: 'Sua consulta foi agendada',
      corpo: 'Olá {{nome}}, sua consulta foi agendada. Confira os detalhes no portal do paciente ou com a equipe da clínica.'
    }
  },
  {
    codigoExterno: 'octaclin_inicial_checkin',
    nome: 'Lembrete de check-in',
    conteudo: {
      assunto: 'Seu check-in está disponível',
      corpo: 'Olá {{nome}}, há um check-in disponível no portal do paciente. Responda quando puder ou fale com a equipe da clínica.'
    }
  },
  {
    codigoExterno: 'octaclin_inicial_plano_publicado',
    nome: 'Plano alimentar disponível',
    conteudo: {
      assunto: 'Seu plano alimentar está disponível',
      corpo: 'Há um novo plano alimentar disponível no portal da sua clínica. Acesse o portal do paciente para consultá-lo.'
    }
  },
  {
    codigoExterno: 'octaclin_inicial_material_nao_visualizado',
    nome: 'Material educativo disponível',
    conteudo: {
      assunto: 'Há um material disponível no portal',
      corpo: 'Um material educativo enviado pela equipe continua disponível no portal da sua clínica. Acesse o portal do paciente para consultá-lo. Se já o visualizou, você pode desconsiderar este aviso.'
    }
  }
] as const;

export const TEMPLATES_INICIAIS_WHATSAPP = [
  {
    codigoExterno: 'octaclin_plano_publicado',
    nome: 'Plano alimentar disponível',
    conteudo: {
      idioma: 'pt_BR',
      components: []
    }
  },
  {
    codigoExterno: 'octaclin_material_nao_visualizado',
    nome: 'Material educativo disponível',
    conteudo: {
      idioma: 'pt_BR',
      components: []
    }
  }
] as const;

/** Idempotente por tenant e código estável, inclusive sob duas solicitações concorrentes. */
export async function instalarTemplatesIniciaisNoTenant(
  gerenciador: EntityManager,
  tenantId: string
): Promise<{ criados: TemplateMensagemOrm[] }> {
  await gerenciador.query('select pg_advisory_xact_lock(hashtext($1))', [`templates-iniciais:${tenantId}`]);
  const repositorio = gerenciador.getRepository(TemplateMensagemOrm);
  const existentes = await repositorio.find({ where: { tenantId } });
  const codigosExistentes = new Set(existentes.map((template) => template.codigoExterno));
  const criados: TemplateMensagemOrm[] = [];

  for (const sugestao of [
    ...TEMPLATES_INICIAIS_EMAIL.map((template) => ({ ...template, canal: 'email' as const })),
    ...TEMPLATES_INICIAIS_WHATSAPP.map((template) => ({ ...template, canal: 'whatsapp' as const }))
  ]) {
    if (codigosExistentes.has(sugestao.codigoExterno)) continue;
    criados.push(await repositorio.save(repositorio.create({
      tenantId,
      canal: sugestao.canal,
      codigoExterno: sugestao.codigoExterno,
      nome: sugestao.nome,
      conteudo: { ...sugestao.conteudo },
      aprovado: false
    })));
  }

  return { criados };
}
