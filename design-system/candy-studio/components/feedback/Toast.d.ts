export interface ToastProps { title: string; description?: string; tone?: 'success'|'error'|'info'; onClose?: () => void; }
export function Toast(props: ToastProps): JSX.Element;
