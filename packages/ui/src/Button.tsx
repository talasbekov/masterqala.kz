import type {ButtonHTMLAttributes} from 'react';
export function Button({variant='primary',loading=false,className='',children,disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'accent'|'secondary'|'white'|'danger';loading?:boolean}) {
  const colors={primary:'bg-primary text-white hover:bg-primary-hover active:bg-[#0A2535]',accent:'bg-accent text-primary hover:bg-accent-hover',secondary:'bg-fill-soft text-primary hover:bg-fill',white:'bg-surface text-primary hover:bg-fill-soft',danger:'bg-[#A62626] text-white hover:bg-[#831B1B]'};
  return <button type="button" {...props} disabled={disabled||loading} aria-busy={loading||undefined} className={`min-h-[52px] rounded-md px-4 py-3 text-base font-semibold leading-[1.4] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-[#E1E6E9] disabled:text-[#52616B] ${colors[variant]} ${className}`}>{children}</button>;
}
