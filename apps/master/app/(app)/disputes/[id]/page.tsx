'use client';
import { useParams } from 'next/navigation';
import { DisputeDetailView } from '@/components/DisputeDetailView';

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <DisputeDetailView disputeId={id} />;
}
