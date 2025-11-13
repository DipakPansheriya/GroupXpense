export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  participants: string[];
  date: Date;
  description?: string;
  settled: boolean;
  groupId: string;
  category?: string;
  createdBy?: string; // Add this for user tracking
}

export interface Participant {
  name: string;
  balance: number;
}