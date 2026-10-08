import { ReactNode } from 'react';
export interface StatCardProps { label: string; value: string; delta?: string; deltaTone?: 'success'|'error'; icon?: ReactNode; }
export function StatCard(props: StatCardProps): JSX.Element;
