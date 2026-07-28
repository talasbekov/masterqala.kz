export interface PlannedBidMaster {
  id: string;
  name: string | null;
  experienceYears: number;
  completedCount: number;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
}

export interface PlannedBid {
  id: string;
  price: number;
  term: string;
  comment: string | null;
  createdAt: string;
  master: PlannedBidMaster;
}

export interface PlannedOrderMaster {
  id: string;
  name: string | null;
  phone: string;
  rating: number | null;
  reviewCount: number;
}

export interface PlannedOrderDetail {
  id: string;
  status: string;
  category: { name: string; slug: string } | null;
  description: string;
  address: string;
  district: string;
  slotStart: string;
  slotEnd: string;
  budget: number | null;
  master: PlannedOrderMaster | null;
  selectedBidId: string | null;
  workPrice: number | null;
  cancelReason: string | null;
  confirmDeadline: string | null;
  bids: PlannedBid[];
  review: { rating: number; comment: string | null } | null;
  photos: { id: string }[];
}
