import { redirect } from "next/navigation";

export default async function PesquisaAtalhoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab = typeof sp.tab === "string" ? `?tab=${encodeURIComponent(sp.tab)}` : "";
  redirect(`/pulse/${encodeURIComponent(id)}${tab}`);
}
