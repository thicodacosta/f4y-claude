import { ReactNode, CSSProperties } from 'react';
export interface CardProps { children?: ReactNode; style?: CSSProperties; hoverable?: boolean; }
export function Card(props: CardProps): JSX.Element;
