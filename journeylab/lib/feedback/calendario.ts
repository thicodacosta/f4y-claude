/**
 * Links para ADICIONAR o 1:1 ao Google Agenda ou ao Outlook — abrem a tela de
 * criação do evento já preenchida. Não é sincronização: nada é criado sem a
 * confirmação da pessoa no provedor. Só título e horário vão na URL (as
 * observações do 1:1 ficam fora, por privacidade).
 */
const compacto = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function linksCalendario(p: { titulo: string; inicio: Date; duracaoMin: number }) {
  const fim = new Date(p.inicio.getTime() + p.duracaoMin * 60_000);
  const detalhes = "1:1 agendado no JourneyLab.";
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE");
  google.searchParams.set("text", p.titulo);
  google.searchParams.set("dates", `${compacto(p.inicio)}/${compacto(fim)}`);
  google.searchParams.set("details", detalhes);
  const outlook = new URL("https://outlook.office.com/calendar/0/deeplink/compose");
  outlook.searchParams.set("path", "/calendar/action/compose");
  outlook.searchParams.set("rru", "addevent");
  outlook.searchParams.set("subject", p.titulo);
  outlook.searchParams.set("startdt", p.inicio.toISOString());
  outlook.searchParams.set("enddt", fim.toISOString());
  outlook.searchParams.set("body", detalhes);
  return { google: google.toString(), outlook: outlook.toString() };
}
