import { ReactNode, ButtonHTMLAttributes } from 'react';
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'ghost' | 'primary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}
export function IconButton(props: IconButtonProps): JSX.Element;
