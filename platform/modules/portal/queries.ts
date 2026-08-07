import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_CRM, PAPEIS_ATS } from "@/lib/roles";

/** Usuario só guarda `empresaId` (não `contatoId` — uma empresa pode ter
 * vários contatos, cada um com seu próprio login de portal), então "este
 * contato específico já tem acesso?" só dá pra responder cruzando por
 * e-mail com auth.users — daí o SQL cru (mesma razão de
 * modules/portal/actions.ts#vincularUsuarioPortal). */
export async function getEmailsComPortalNaEmpresa(empresaId: string): Promise<Set<string>> {
  await requirePapel(PAPEIS_CRM);

  const linhas = await prisma.$queryRaw<{ email: string }[]>`
    select au.email
    from public.usuarios u
    join auth.users au on au.id = u.id
    where u.papel = 'cliente_portal' and u.empresa_id = ${empresaId}
  `;

  return new Set(linhas.map((l) => l.email));
}

export async function getCandidatoTemPortal(candidatoId: string): Promise<boolean> {
  await requirePapel(PAPEIS_ATS);

  const usuario = await prisma.usuario.findUnique({ where: { candidatoId } });
  return !!usuario;
}
