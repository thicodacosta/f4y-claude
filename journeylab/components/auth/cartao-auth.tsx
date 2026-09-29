import { Container } from "@/components/secao";

export function CartaoAuth({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <Container className="max-w-md py-12 sm:py-16">
      <h1 className="font-heading text-[32px] font-extrabold tracking-tight">{titulo}</h1>
      {descricao && <p className="mt-2 text-muted-foreground">{descricao}</p>}
      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-surface">{children}</div>
      {rodape && <div className="mt-6 text-center text-sm text-muted-foreground">{rodape}</div>}
    </Container>
  );
}
