'use client';
import {NewOrderCreationStatusView} from '@masterqala/ui';
import type {ComponentProps} from 'react';
import Link from 'next/link';
export function NewOrderCreationStatus(props:Omit<ComponentProps<typeof NewOrderCreationStatusView>,'renderLink'>){
 return <NewOrderCreationStatusView {...props} renderLink={(href,className,label)=><Link href={href} className={className}>{label}</Link>}/>;
}
