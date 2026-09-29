/** Valida parâmetros vindos da URL antes de chegarem ao banco. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidOuNada(v?: string | null) {
  return v && UUID.test(v) ? v : undefined;
}

export function valorPermitido<T extends string>(v: string | undefined, permitidos: readonly T[] | Record<T, unknown>): T | undefined {
  const lista = Array.isArray(permitidos) ? permitidos : Object.keys(permitidos);
  return v && (lista as string[]).includes(v) ? (v as T) : undefined;
}
