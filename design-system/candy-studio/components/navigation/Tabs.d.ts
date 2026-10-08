export interface Tab { id: string; label: string; }
export interface TabsProps { tabs?: Tab[]; active?: string; onChange?: (id: string) => void; }
export function Tabs(props: TabsProps): JSX.Element;
