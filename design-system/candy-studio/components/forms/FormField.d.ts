import { ReactNode } from 'react';
export interface FormFieldProps { label?: string; hint?: string; error?: string; required?: boolean; children?: ReactNode; }
export function FormField(props: FormFieldProps): JSX.Element;
