import {Link} from 'react-router-dom';
import {CategoryBrowserView, useCategoryBrowser} from '@masterqala/ui';
import {api} from '../../../api';
export default function CatalogPage() {
  const state = useCategoryBrowser({api});
  return <CategoryBrowserView {...state} onRetry={() => {void state.retry();}} renderLink={({href, children, className, ariaLabel}) => <Link to={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
