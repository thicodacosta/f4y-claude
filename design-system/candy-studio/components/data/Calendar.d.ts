export interface CalendarProps { month?: string; days?: number[]; events?: Record<number, boolean>; }
export function Calendar(props: CalendarProps): JSX.Element;
