'use client';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PlannedOrderPanel } from '@/components/desktop-planned/PlannedOrderPanel';
export default function PlannedOrderPage() {
  const { user } = useAuth(), params = useParams<{ id: string }>();
  if (!user || !params.id) return null;
  return <div className="mq-planned__route"><PlannedOrderPanel key={`${user.id}:${params.id}`} ownerId={user.id} id={params.id} assignedOnly /></div>;
}
