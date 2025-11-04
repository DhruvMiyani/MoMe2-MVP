import clsx from 'clsx';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { Episode } from '../types';

interface StatusBadgeProps {
  status: Episode['status'];
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = {
    auto_approved: {
      icon: CheckCircle,
      label: 'Auto-Approved',
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    approved: {
      icon: CheckCircle,
      label: 'Approved',
      className: 'bg-primary/20 text-primary border-primary/30',
    },
    denied: {
      icon: XCircle,
      label: 'Denied',
      className: 'bg-danger/20 text-danger border-danger/30',
    },
    needs_review: {
      icon: AlertCircle,
      label: 'Needs Review',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
  };

  const { icon: Icon, label, className } = config[status];

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <div
      className={clsx(
        'inline-flex items-center space-x-1.5 rounded-md border font-medium',
        className,
        padding
      )}
    >
      <Icon className={iconSize} />
      <span className={textSize}>{label}</span>
    </div>
  );
}
