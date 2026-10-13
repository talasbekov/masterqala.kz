import {notFound} from 'next/navigation';import {getCategories} from '../../../lib/categories';import {getAppUrl} from '../../../lib/env';import {CategoryView} from '../../../components/PublicInfo';
export async function generateStaticParams(){return (await getCategories()).map(category=>({slug:category.slug}))}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params,category=(await getCategories()).find(item=>item.slug===slug);
 if(!category)notFound();return <CategoryView category={category} appUrl={getAppUrl()}/>;
}
