import { ReactNode } from 'react';
export interface TooltipProps { children?: ReactNode; label: string; }
export function Tooltip(props: TooltipProps): JSX.Element;
