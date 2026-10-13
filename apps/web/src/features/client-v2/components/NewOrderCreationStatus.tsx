import {NewOrderCreationStatusView} from '@masterqala/ui';
import type {ComponentProps} from 'react';
import {Link} from 'react-router-dom';
export function NewOrderCreationStatus(props:Omit<ComponentProps<typeof NewOrderCreationStatusView>,'renderLink'>){
 return <NewOrderCreationStatusView {...props} renderLink={(to,className,label)=><Link to={to} className={className}>{label}</Link>}/>;
}
