import clsx from 'clsx';

interface ConfidenceChipProps {
  confidence: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
}

export default function ConfidenceChip({ confidence, size = 'md' }: ConfidenceChipProps) {
  const percentage = Math.round(confidence * 100);

  // Determine label based on confidence
  let label = 'Uncertain';
  let colorClass = 'bg-gray-600 text-gray-200';

  if (confidence >= 0.95) {
    label = 'Very High';
    colorClass = 'bg-green-600 text-white';
  } else if (confidence >= 0.85) {
    label = 'High';
    colorClass = 'bg-green-500 text-white';
  } else if (confidence >= 0.7) {
    label = 'Moderate';
    colorClass = 'bg-yellow-500 text-gray-900';
  } else if (confidence >= 0.5) {
    label = 'Borderline';
    colorClass = 'bg-orange-500 text-white';
  } else {
    label = 'Low';
    colorClass = 'bg-red-500 text-white';
  }

  const sizeClass = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  }[size];

  return (
    <div
      className={clsx(
        'inline-flex items-center space-x-1.5 rounded-full font-medium',
        colorClass,
        sizeClass
      )}
    >
      <span>{percentage}%</span>
      <span className="opacity-80">•</span>
      <span className="text-xs opacity-90">{label}</span>
    </div>
  );
}
