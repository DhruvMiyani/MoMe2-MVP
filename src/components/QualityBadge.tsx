import { AlertTriangle, CheckCircle } from 'lucide-react';
import { QualityFlags } from '../types';

interface QualityBadgeProps {
  quality: QualityFlags;
  size?: 'sm' | 'md';
}

export default function QualityBadge({ quality, size = 'md' }: QualityBadgeProps) {
  const issues = Object.entries(quality)
    .filter(([_, value]) => value)
    .map(([key]) => key);

  const hasIssues = issues.length > 0;

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (!hasIssues) {
    return (
      <div className="inline-flex items-center space-x-1 text-green-500">
        <CheckCircle className={iconSize} />
        <span className={textSize}>Good</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center space-x-1 text-yellow-500" title={issues.join(', ')}>
      <AlertTriangle className={iconSize} />
      <span className={textSize}>
        {issues.length} issue{issues.length > 1 ? 's' : ''}
      </span>
    </div>
  );
}
