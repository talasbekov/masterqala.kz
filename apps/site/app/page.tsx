import {HomeView} from '../components/HomeView';import {getCategories} from '../lib/categories';import {getAppUrl} from '../lib/env';
export default async function HomePage(){return <HomeView categories={await getCategories()} appUrl={getAppUrl()}/>}
