/** Monta um link de click-to-chat do WhatsApp (wa.me) a partir de um número
 * em qualquer formatação livre (o app não valida máscara no cadastro —
 * Contato.telefone/Candidato.telefone/whatsapp são texto livre). wa.me exige
 * só dígitos com código do país; assume Brasil (55) quando o número não
 * parece já ter um código de país (10-11 dígitos = DDD + número BR). */
export function waLink(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 8) return null;

  const comCodigoPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comCodigoPais}`;
}
