import { ReactNode } from 'react';
export interface DialogProps { title: string; description?: string; children?: ReactNode; onClose?: () => void; footer?: ReactNode; }
export function Dialog(props: DialogProps): JSX.Element;
