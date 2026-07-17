import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div className={`rounded-lg bg-surface p-4 shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}
