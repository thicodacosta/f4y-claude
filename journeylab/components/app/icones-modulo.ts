import { Activity, ChartNoAxesCombined, DoorClosed, DoorOpen, HeartHandshake, MessagesSquare, ShieldCheck, Target, Users, type LucideIcon } from "lucide-react";

/** Ícone de cada produto — o mesmo no menu, no painel e nos cabeçalhos. */
export const ICONE_MODULO: Record<string, LucideIcon> = {
  crm: Users,
  onboarding: DoorOpen,
  feedback: MessagesSquare,
  pulse: Activity,
  pdi: Target,
  nr1: ShieldCheck,
  offboarding: DoorClosed,
  retencao: HeartHandshake,
  analytics: ChartNoAxesCombined,
};
