import { ReactNode } from 'react';
export interface FooterColumn { title: string; links: string[]; }
export interface FooterProps { logo?: ReactNode; columns?: FooterColumn[]; bottom?: ReactNode; }
export function Footer(props: FooterProps): JSX.Element;
