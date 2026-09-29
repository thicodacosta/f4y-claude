import { Container } from "@/components/secao";

export function PaginaLegal({ html }: { html: string }) {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <p role="note" className="mb-8 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <strong>Minuta em revisão jurídica.</strong> Este texto ainda não está em vigor.
      </p>
      {/* Conteúdo de arquivo versionado no repositório (não é entrada de usuário). */}
      <article className="prosa" dangerouslySetInnerHTML={{ __html: html }} />
    </Container>
  );
}
