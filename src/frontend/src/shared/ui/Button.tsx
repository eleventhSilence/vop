import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
};

export const Button = ({ children, className = '', variant = 'primary', fullWidth = false, ...props }: PropsWithChildren<ButtonProps>) => {
  return (
    <button
      className={`button button--${variant} ${fullWidth ? 'button--full' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
