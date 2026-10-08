import { ReactNode } from 'react';
export interface BadgeProps { children?: ReactNode; tone?: 'neutral'|'primary'|'success'|'warning'|'error'; dot?: boolean; }
export function Badge(props: BadgeProps): JSX.Element;
