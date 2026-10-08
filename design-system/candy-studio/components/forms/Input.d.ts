import { InputHTMLAttributes, ReactNode } from 'react';
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: ReactNode;
}
export function Input(props: InputProps): JSX.Element;
