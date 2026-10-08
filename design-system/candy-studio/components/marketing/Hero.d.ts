import { ReactNode } from 'react';
export interface HeroProps { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode; }
export function Hero(props: HeroProps): JSX.Element;
