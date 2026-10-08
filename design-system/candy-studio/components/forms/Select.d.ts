import { SelectHTMLAttributes, ReactNode } from 'react';
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { children?: ReactNode; }
export function Select(props: SelectProps): JSX.Element;
