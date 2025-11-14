// member-view.component.ts
import { Component, OnInit } from '@angular/core';
import { Group } from '../models/group.model';
import { Expense } from '../models/expense.model';
import { Router, ActivatedRoute } from '@angular/router';
import { MemberViewService } from '../member-view.service';

@Component({
  selector: 'app-member-view',
  templateUrl: './member-view.component.html',
  styleUrls: ['./member-view.component.scss'],
})
export class MemberViewComponent implements OnInit {
  currentGroup: Group | null = null;
  currentUserName: string = 'Guest User';
  balances: Map<string, number> = new Map();
  userSettlements: { from: string; to: string; amount: number }[] = [];
  userTransactions: Expense[] = [];
  totalExpenses: number = 0;
  expensesByParticipant: Map<string, number> = new Map();
  isLoading: boolean = true;
  groupNotFound: boolean = false;
  dataLoaded: boolean = false;

  private groupId: string = '';
  private userId: string = '';

  constructor(
    private memberViewService: MemberViewService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.route.paramMap.subscribe((params) => {
      const userId = params.get('userId');
      const groupId = params.get('groupId');

      if (userId && groupId) {
        this.userId = userId;
        this.groupId = groupId;
        this.loadMemberViewData(userId, groupId);
      } else {
        this.handleGroupNotFound();
      }
    });
  }

  private loadMemberViewData(userId: string, groupId: string): void {
    this.isLoading = true;
    this.groupNotFound = false;
    this.dataLoaded = false;

    // Check if user data exists
    if (!this.memberViewService.hasUserData(userId)) {
      this.handleGroupNotFound();
      return;
    }

    // Load group data
    const group = this.memberViewService.getGroupById(userId, groupId);

    if (group) {
      this.currentGroup = group;
      this.calculateGroupData(userId, groupId);
    } else {
      this.handleGroupNotFound();
    }
  }

  private calculateGroupData(userId: string, groupId: string): void {
    if (!this.currentGroup) {
      this.handleGroupNotFound();
      return;
    }

    try {
      // Get expenses from user's storage
      const expenses = this.memberViewService.getExpensesForGroup(
        userId,
        groupId
      );

      this.userTransactions = expenses.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Calculate everything from the data
      this.calculateBalances(expenses);
      this.calculateSettlements();
      this.calculateExpensesByParticipant(expenses);
      this.totalExpenses = expenses.reduce(
        (total, expense) => total + expense.amount,
        0
      );

      this.isLoading = false;
      this.dataLoaded = true;
    } catch (error) {
      console.error('Error calculating member view data:', error);
      this.handleGroupNotFound();
    }
  }

  private calculateBalances(expenses: Expense[]): void {
    if (!this.currentGroup) return;

    this.balances = new Map<string, number>();

    // Initialize all participants with zero balance
    this.currentGroup.participants.forEach((participant) => {
      this.balances.set(participant, 0);
    });

    // Calculate balances from expenses
    expenses.forEach((expense) => {
      if (!expense.settled) {
        const amountPerPerson = expense.amount / expense.participants.length;

        // Add to paidBy
        this.balances.set(
          expense.paidBy,
          (this.balances.get(expense.paidBy) || 0) + expense.amount
        );

        // Subtract from participants
        expense.participants.forEach((participant) => {
          this.balances.set(
            participant,
            (this.balances.get(participant) || 0) - amountPerPerson
          );
        });
      }
    });
  }

  private calculateSettlements(): void {
    const transactions: { from: string; to: string; amount: number }[] = [];
    const balanceArray = Array.from(this.balances.entries()).map(
      ([name, balance]) => ({
        name,
        balance,
      })
    );

    // Sort: debtors (negative) first, creditors (positive) last
    balanceArray.sort((a, b) => a.balance - b.balance);

    let i = 0;
    let j = balanceArray.length - 1;

    while (i < j) {
      const debtor = balanceArray[i];
      const creditor = balanceArray[j];

      if (Math.abs(debtor.balance) < 0.01 && creditor.balance < 0.01) {
        break;
      }

      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

      if (amount > 0.01) {
        transactions.push({
          from: debtor.name,
          to: creditor.name,
          amount: parseFloat(amount.toFixed(2)),
        });

        debtor.balance += amount;
        creditor.balance -= amount;

        if (Math.abs(debtor.balance) < 0.01) i++;
        if (creditor.balance < 0.01) j--;
      } else {
        break;
      }
    }

    this.userSettlements = transactions;
  }

  private calculateExpensesByParticipant(expenses: Expense[]): void {
    this.expensesByParticipant = new Map<string, number>();

    expenses.forEach((expense) => {
      const currentPaid = this.expensesByParticipant.get(expense.paidBy) || 0;
      this.expensesByParticipant.set(
        expense.paidBy,
        currentPaid + expense.amount
      );
    });
  }

  private handleGroupNotFound(): void {
    this.groupNotFound = true;
    this.isLoading = false;
    this.currentGroup = null;
  }

  // ========== PUBLIC METHODS FOR TEMPLATE ==========

  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }

  formatCurrency(amount: number): string {
    return `${amount.toFixed(2)} ${this.currentGroup?.currency || 'INR'}`;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getParticipantCharged(participant: string): number {
    const expenses = this.userTransactions;
    let charged = 0;

    expenses.forEach((expense) => {
      if (expense.participants.includes(participant)) {
        charged += expense.amount / expense.participants.length;
      }
    });

    return charged;
  }

  getParticipantPaid(participant: string): number {
    return this.expensesByParticipant.get(participant) || 0;
  }

  getParticipantBalance(participant: string): number {
    return this.balances.get(participant) || 0;
  }

  getUserShare(expense: Expense): number {
    return expense.amount / expense.participants.length;
  }

  participantOwes(participant: string): boolean {
    return this.getParticipantBalance(participant) < 0;
  }

  participantIsOwed(participant: string): boolean {
    return this.getParticipantBalance(participant) > 0;
  }

  getDebtors(): string[] {
    return Array.from(this.balances.entries())
      .filter(([_, balance]) => balance < 0)
      .map(([participant, _]) => participant);
  }

  getCreditors(): string[] {
    return Array.from(this.balances.entries())
      .filter(([_, balance]) => balance > 0)
      .map(([participant, _]) => participant);
  }

  getAllParticipants(): string[] {
    return this.currentGroup?.participants || [];
  }

  // Navigation methods
  goBackToGroups(): void {
    this.router.navigate(['/login']);
  }

  // Read-only mode messages
  showReadOnlyMessage(): void {
    alert(
      'This is a read-only view. To edit expenses, please ask the group owner to share the main app.'
    );
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  refreshData(): void {
    if (this.userId && this.groupId) {
      this.loadMemberViewData(this.userId, this.groupId);
    }
  }

  shareReport(): void {
    if (!this.currentGroup) return;

    const currentUrl = window.location.href;

    navigator.clipboard
      .writeText(currentUrl)
      .then(() => {
        alert('Report link copied to clipboard!');
      })
      .catch((err) => {
        const textArea = document.createElement('textarea');
        textArea.value = currentUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Report link copied to clipboard!');
      });
  }

  markExpenseAsSettled(expense: Expense): void {
    this.showReadOnlyMessage();
  }

  markAsPaid(settlement: { from: string; to: string; amount: number }): void {
    this.showReadOnlyMessage();
  }

  isUserInvolvedInExpense(expense: Expense): boolean {
    return true;
  }

  hasData(): boolean {
    return this.dataLoaded && !this.isLoading && !this.groupNotFound;
  }
}
