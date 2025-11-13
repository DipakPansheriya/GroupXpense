export interface Group {
  id: string;
  name: string;
  currency: string;
  description: string;
  createdAt: Date;
  participants: string[];
  createdBy?: string; // Add this for user tracking
}