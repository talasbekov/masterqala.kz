import {redirect} from 'next/navigation';
/** Retain old bookmarks while keeping one canonical client order list. */
export default function DashboardPage(){redirect('/orders');}
