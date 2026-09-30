import { redirect } from "next/navigation";

/** Atalho: /pesquisas → /pulse (preserva ?action=create e ?tab=). */
export default async function PesquisasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(`/pulse${q ? `?${q}` : ""}`);
}
