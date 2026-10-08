import { ReactNode } from 'react';
export interface TagProps { children?: ReactNode; onRemove?: () => void; }
export function Tag(props: TagProps): JSX.Element;
