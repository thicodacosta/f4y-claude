import { ReactNode } from 'react';
export interface SidebarItem { id: string; label: string; icon?: ReactNode; }
export interface SidebarSection { title?: string; items: SidebarItem[]; }
export interface SidebarProps { logo?: ReactNode; sections?: SidebarSection[]; activeId?: string; footer?: ReactNode; }
export function Sidebar(props: SidebarProps): JSX.Element;
