import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExpenseService } from '../expense.service';
import { Group } from '../models/group.model';
import { Expense } from '../models/expense.model';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-member-view',
  templateUrl: './member-view.component.html',
  styleUrls: ['./member-view.component.scss']
})
export class MemberViewComponent implements OnInit, OnDestroy {
  currentGroup: Group | null = null;
  currentUserName: string = 'Guest User'; // Default name for non-logged in users
  balances: Map<string, number> = new Map();
  userBalance: number = 0;
  userSettlements: { from: string, to: string, amount: number }[] = [];
  userTransactions: Expense[] = [];
  totalExpenses: number = 0;
  expensesByParticipant: Map<string, number> = new Map();
  
  private subscriptions: Subscription = new Subscription();
  private groupId: string = '';

  constructor(
    private expenseService: ExpenseService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadInitialData();
  }

  private initializeSubscriptions(): void {
    // Subscribe to current group updates
    this.subscriptions.add(
      this.expenseService.currentGroup$.subscribe(group => {
        this.currentGroup = group;
        if (this.currentGroup) {
          this.calculateUserData();
        }
      })
    );

    // Subscribe to expenses updates
    this.subscriptions.add(
      this.expenseService.expenses$.subscribe(expenses => {
        if (this.currentGroup) {
          this.calculateUserData();
        }
      })
    );

    // Subscribe to route parameters for member view access
    this.subscriptions.add(
      this.route.paramMap.subscribe(params => {
        const groupId = params.get('groupId');
        if (groupId) {
          this.groupId = groupId;
          this.loadGroupById(groupId);
        }
      })
    );
  }

  private loadInitialData(): void {
    // For member view, we don't need user authentication
    // Just load the group from the route parameter
    this.route.paramMap.subscribe(params => {
      const groupId = params.get('groupId');
      if (groupId) {
        this.loadGroupById(groupId);
      } else {
        this.currentGroup = null;
      }
    });
  }

  private loadGroupById(groupId: string): void {
    const group = this.expenseService.getGroupById(groupId);
    if (group) {
      this.currentGroup = group;
      this.expenseService.setCurrentGroup(group);
      this.calculateUserData();
    } else {
      console.error('Group not found:', groupId);
      this.currentGroup = null;
    }
  }

  private calculateUserData(): void {
    if (!this.currentGroup) return;

    console.log('Calculating user data for group:', this.currentGroup.name);
    
    // Get all balances
    this.balances = this.expenseService.calculateBalances(this.currentGroup.id);
    
    // For member view, we don't calculate user-specific balance since user is not logged in
    // Instead, we'll show all balances and let the user identify themselves
    this.userBalance = 0;
    
    // Get all settlements (show all settlements in the group)
    const allSettlements = this.expenseService.getSimplifiedBalances(this.currentGroup.id);
    this.userSettlements = allSettlements; // Show all settlements
    
    // Get total expenses
    this.totalExpenses = this.expenseService.getTotalExpenses(this.currentGroup.id);
    
    // Get expenses by participant
    this.expensesByParticipant = this.expenseService.getExpensesByParticipant(this.currentGroup.id);
    
    // Get all transactions
    this.userTransactions = this.expenseService.getExpenses(this.currentGroup.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('Member view data calculated:', {
      totalExpenses: this.totalExpenses,
      settlements: this.userSettlements.length,
      transactions: this.userTransactions.length
    });
  }

  // Add this method to get absolute value for template
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
      day: 'numeric'
    });
  }

  getParticipantCharged(participant: string): number {
    const expenses = this.expenseService.getExpenses(this.currentGroup?.id || '');
    let charged = 0;
    
    expenses.forEach(expense => {
      if (expense.participants.includes(participant)) {
        charged += expense.amount / expense.participants.length;
      }
    });
    
    return charged;
  }

  getParticipantPaid(participant: string): number {
    return this.expensesByParticipant.get(participant) || 0;
  }

  // Since user is not logged in, we can't calculate user-specific shares
  // These methods are kept for template compatibility but won't be used meaningfully
  getUserShare(expense: Expense): number {
    return expense.amount / expense.participants.length;
  }

  isUserInvolvedInExpense(expense: Expense): boolean {
    // Since user is not logged in, we can't determine if they're involved
    // Return true to show all expense details
    return true;
  }

  markExpenseAsSettled(expense: Expense): void {
    // Disable this functionality for member view since users aren't authenticated
    alert('This feature is not available in member view. Please log in to mark expenses as settled.');
  }

  markAsPaid(settlement: { from: string, to: string, amount: number }): void {
    // Disable this functionality for member view since users aren't authenticated
    alert('This feature is not available in member view. Please log in to mark payments as completed.');
  }

  goBackToGroups(): void {
    // Redirect to login page instead of groups since user might not be logged in
    this.router.navigate(['/login']);
  }

  refreshData(): void {
    if (this.currentGroup) {
      this.expenseService.refreshAllData();
      this.calculateUserData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}