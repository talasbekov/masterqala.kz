import { api } from './api';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface OperatorMasterRow {
  id: string;
  categories: string[];
  orders: number;
  status: string;
  name: string | null;
  rating: number | null;
  reviewCount: number;
}

export function fetchCategories(): Promise<Category[]> {
  return api('/categories');
}

export function fetchMasters(category?: string, district?: string): Promise<OperatorMasterRow[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (district) params.set('district', district);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api(`/admin/masters${query}`);
}
