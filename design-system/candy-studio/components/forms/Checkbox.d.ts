import { InputHTMLAttributes } from 'react';
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label?: string; checked?: boolean; }
export function Checkbox(props: CheckboxProps): JSX.Element;
