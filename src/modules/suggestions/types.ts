import type { ProductSuggestionStatus } from "@prisma/client";

export type SuggestionStatus = ProductSuggestionStatus;

export interface PartnerSuggestionListItem {
  id: string;
  name: string;
  imageUrl: string;
  estimatedSellingPrice: number;
  estimatedPurchasePrice?: number | null;
  status: ProductSuggestionStatus;
  createdAt: string;
  updatedAt: string;
  partnerFeedback?: string | null;
  productId?: string | null;
  productName?: string | null;
}

export interface PartnerSuggestionDetail {
  id: string;
  name: string;
  imageUrl: string;
  images: string[];
  estimatedSellingPrice: number;
  estimatedPurchasePrice: number | null;
  description: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  supplierUrl: string | null;
  characteristics: string | null;
  targetAudience: string | null;
  partnerReason: string | null;
  additionalNotes: string | null;
  status: ProductSuggestionStatus;
  partnerFeedback: string | null;
  statusUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  productId: string | null;
  productCreatedAt: string | null;
  linkedProduct?: {
    id: string;
    name: string;
    slug: string;
    sellingPrice: number;
    stockQuantity: number;
    status: string;
  } | null;
  history: {
    id: string;
    previousStatus: ProductSuggestionStatus | null;
    newStatus: ProductSuggestionStatus;
    actorName: string | null;
    feedback: string | null;
    createdAt: string;
  }[];
}

export interface AdminSuggestionListItem {
  id: string;
  name: string;
  imageUrl: string;
  estimatedSellingPrice: number;
  estimatedPurchasePrice: number | null;
  description?: string | null;
  status: ProductSuggestionStatus;
  createdAt: string;
  updatedAt: string;
  partner: {
    id: string;
    code: string;
    displayName: string;
    phone: string | null;
  };
  productId: string | null;
  productName?: string | null;
  partnerFeedback: string | null;
  internalNotes: string | null;
}

export interface AdminSuggestionDetail extends AdminSuggestionListItem {
  images: string[];
  description: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  supplierUrl: string | null;
  characteristics: string | null;
  targetAudience: string | null;
  partnerReason: string | null;
  additionalNotes: string | null;
  statusUpdatedAt: string | null;
  statusUpdatedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  productCreatedAt: string | null;
  linkedProduct?: {
    id: string;
    name: string;
    slug: string;
    sellingPrice: number;
    stockQuantity: number;
    status: string;
  } | null;
  history: {
    id: string;
    previousStatus: ProductSuggestionStatus | null;
    newStatus: ProductSuggestionStatus;
    actorName: string | null;
    feedback: string | null;
    internalNotes: string | null;
    createdAt: string;
  }[];
}

export interface GlobalContributionMetrics {
  totalSuggestions: number;
  pendingReview: number;
  underReview: number;
  accepted: number;
  rejected: number;
  productsCreated: number;
}

export interface PartnerContributionMetric {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  phone: string | null;
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  productsCreated: number;
  acceptanceRate: number | null; // percentage e.g. 75.0, or null if denominator is 0
  linkedProducts: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  }[];
}

export interface ContributionAnalytics {
  global: GlobalContributionMetrics;
  partners: PartnerContributionMetric[];
}
