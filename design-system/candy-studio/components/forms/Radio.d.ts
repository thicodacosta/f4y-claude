import { InputHTMLAttributes } from 'react';
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label?: string; checked?: boolean; }
export function Radio(props: RadioProps): JSX.Element;
