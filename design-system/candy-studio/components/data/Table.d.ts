import { ReactNode } from 'react';
export interface TableProps { columns?: string[]; rows?: ReactNode[][]; }
export function Table(props: TableProps): JSX.Element;
