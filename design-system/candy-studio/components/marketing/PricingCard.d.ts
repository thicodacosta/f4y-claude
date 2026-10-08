export interface PricingCardProps { name: string; price: string; period?: string; description?: string; features?: string[]; highlighted?: boolean; cta?: string; }
export function PricingCard(props: PricingCardProps): JSX.Element;
