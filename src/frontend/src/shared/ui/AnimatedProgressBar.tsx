import type { CSSProperties } from 'react';

type AnimatedProgressBarProps = {
  progress: number;
  label: string;
};

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const getProgressRange = (progress: number) => {
  if (progress >= 100) return 0;
  if (progress < 25) return 25 - progress;
  if (progress < 50) return 50 - progress;
  if (progress < 75) return 75 - progress;
  return 100 - progress;
};

export const AnimatedProgressBar = ({ progress, label }: AnimatedProgressBarProps) => {
  const normalizedProgress = clampProgress(progress);
  const range = getProgressRange(normalizedProgress);
  const progressStyle = {
    '--progress': String(normalizedProgress),
    '--range': String(range),
  } as CSSProperties;

  return (
    <div
      className="animated-progress"
      style={progressStyle}
      role="progressbar"
      aria-valuenow={normalizedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="animated-progress__base" />
      {normalizedProgress < 100 ? <div className="animated-progress__pulse" /> : null}
    </div>
  );
};
