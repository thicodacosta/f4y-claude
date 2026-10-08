export interface KanbanCardProps { title: string; tag?: string; tagTone?: 'primary'|'success'|'warning'; assignee?: string; due?: string; }
export function KanbanCard(props: KanbanCardProps): JSX.Element;
