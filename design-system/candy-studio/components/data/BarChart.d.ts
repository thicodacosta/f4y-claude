export interface BarChartDatum { label: string; value: number; }
export interface BarChartProps { data?: BarChartDatum[]; height?: number; }
export function BarChart(props: BarChartProps): JSX.Element;
