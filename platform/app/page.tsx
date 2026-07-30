import { redirect } from "next/navigation";

// A raiz nunca renderiza conteúdo próprio — o middleware já decide entre
// /login e /dashboard conforme sessão; este redirect cobre o caso em que o
// middleware não interceptou (ex.: rota "/" explícita no matcher).
export default function RootPage() {
  redirect("/dashboard");
}
