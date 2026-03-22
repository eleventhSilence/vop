import type { PropsWithChildren } from 'react';

export const PageSection = ({ children }: PropsWithChildren) => {
  return <section className="page-section">{children}</section>;
};
