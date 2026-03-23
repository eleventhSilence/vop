import type { PropsWithChildren } from 'react';

type PageSectionProps = PropsWithChildren<{
  className?: string;
}>;

export const PageSection = ({ children, className = '' }: PageSectionProps) => {
  return <section className={`page-section ${className}`.trim()}>{children}</section>;
};
