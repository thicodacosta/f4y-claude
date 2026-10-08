import { ReactNode } from 'react';
export interface NavLink { label: string; href?: string; }
export interface NavbarProps { logo?: ReactNode; links?: NavLink[]; actions?: ReactNode; }
export function Navbar(props: NavbarProps): JSX.Element;
