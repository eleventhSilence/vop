import { formatStatus } from '@/shared/lib/format';

type StatusBadgeProps = {
  status: string;
  label?: string;
  tone?: 'default' | 'success' | 'danger' | 'accent' | 'neutral';
};

export const StatusBadge = ({ status, label, tone = 'default' }: StatusBadgeProps) => {
  return <span className={`badge badge--${tone}`}>{label ?? formatStatus(status)}</span>;
};
