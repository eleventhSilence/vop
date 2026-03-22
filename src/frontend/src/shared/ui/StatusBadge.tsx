import { formatStatus } from '@/shared/lib/format';

export const StatusBadge = ({ status }: { status: string }) => {
  return <span className="badge">{formatStatus(status)}</span>;
};
