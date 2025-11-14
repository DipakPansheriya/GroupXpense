import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExpenseService } from '../expense.service';
import { Group } from '../models/group.model';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-balance-view',
  templateUrl: './balance-view.component.html',
  styleUrls: ['./balance-view.component.scss']
})
export class BalanceViewComponent implements OnInit, OnDestroy {
  currentGroup: Group | null = null;
  balances: Map<string, number> = new Map();
  settlements: { from: string, to: string, amount: number }[] = [];
  totalExpenses: number = 0;
  expensesByParticipant: Map<string, number> = new Map();
  
  private subscriptions: Subscription = new Subscription();

  constructor(private expenseService: ExpenseService, private router: Router , private authService :AuthService) {}

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadInitialData();
  }

  // Initialize all subscriptions for real-time updates
  private initializeSubscriptions(): void {
    // Subscribe to current group updates
    this.subscriptions.add(
      this.expenseService.currentGroup$.subscribe(group => {
        this.currentGroup = group;
        console.log('Current group updated in Balance page:', group);
        
        if (this.currentGroup) {
          this.calculateBalances();
        } else {
          // If no group is selected, redirect to groups
          setTimeout(() => {
            this.router.navigate(['/groups']);
          }, 100);
        }
      })
    );

    // Subscribe to expenses updates to recalculate balances when expenses change
    this.subscriptions.add(
      this.expenseService.expenses$.subscribe(expenses => {
        console.log('Expenses updated in Balance page, recalculating balances');
        if (this.currentGroup) {
          this.calculateBalances();
        }
      })
    );

    // Subscribe to groups updates to handle group deletion
    this.subscriptions.add(
      this.expenseService.groups$.subscribe(groups => {
        console.log('Groups updated in Balance page');
        // If current group was deleted, redirect to main page
        if (this.currentGroup && !groups.find(g => g.id === this.currentGroup!.id)) {
          this.currentGroup = null;
          this.router.navigate(['/groups']);
        }
      })
    );
  }

  // Load initial data
  private loadInitialData(): void {
    this.currentGroup = this.expenseService.getCurrentGroup();
    if (this.currentGroup) {
      this.calculateBalances();
    } else {
      // If no group is selected, redirect to groups
      setTimeout(() => {
        this.router.navigate(['/groups']);
      }, 100);
    }
  }

  calculateBalances(): void {
    if (!this.currentGroup) return;

    console.log('Calculating balances for group:', this.currentGroup.name);
    
    // Get balances
    this.balances = this.expenseService.calculateBalances(this.currentGroup.id);
    
    // Get settlements
    this.settlements = this.expenseService.getSimplifiedBalances(this.currentGroup.id);
    
    // Get total expenses
    this.totalExpenses = this.expenseService.getTotalExpenses(this.currentGroup.id);
    
    // Get expenses by participant
    this.expensesByParticipant = this.expenseService.getExpensesByParticipant(this.currentGroup.id);

    console.log('Balances calculated:', {
      balances: Array.from(this.balances.entries()),
      settlements: this.settlements,
      totalExpenses: this.totalExpenses,
      expensesByParticipant: Array.from(this.expensesByParticipant.entries())
    });
  }

  formatCurrency(amount: number): string {
    return `${amount.toFixed(2)} ${this.currentGroup?.currency || 'INR'}`;
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

  // Get balance for a participant (positive = owed to them, negative = they owe)
  getParticipantBalance(participant: string): number {
    return this.balances.get(participant) || 0;
  }

  // Check if participant owes money (negative balance)
  participantOwes(participant: string): boolean {
    return this.getParticipantBalance(participant) < 0;
  }

  // Check if participant is owed money (positive balance)
  participantIsOwed(participant: string): boolean {
    return this.getParticipantBalance(participant) > 0;
  }

  // Get participants who owe money
  getDebtors(): string[] {
    return Array.from(this.balances.entries())
      .filter(([_, balance]) => balance < 0)
      .map(([participant, _]) => participant);
  }

  // Get participants who are owed money
  getCreditors(): string[] {
    return Array.from(this.balances.entries())
      .filter(([_, balance]) => balance > 0)
      .map(([participant, _]) => participant);
  }

  goBackToGroups(): void {
    this.router.navigate(['/groups']);
  }

  // Refresh data manually if needed
  refreshData(): void {
    if (this.currentGroup) {
      this.calculateBalances();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // In any component
goToMemberView() {
  this.router.navigate(['/member-view', this.currentGroup?.id]);
}

// In balance-view.component.ts - update copyMemberViewLink method
copyMemberViewLink(): void {
  if (!this.currentGroup) {
    alert('No group selected');
    return;
  }

  const currentUser = this.authService.getCurrentUser();
  if (!currentUser) {
    alert('User not logged in');
    return;
  }

  // Generate URL with userId and groupId
  const memberViewUrl = `${window.location.origin}/member-view/${currentUser.id}/${this.currentGroup.id}`;
  
  // Copy to clipboard
  navigator.clipboard.writeText(memberViewUrl).then(() => {
    this.showToast('Member view link copied to clipboard!');
  }).catch(err => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = memberViewUrl;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    this.showToast('Member view link copied to clipboard!');
  });
}

// Optional: Add toast notification method
showToast(message: string): void {
  // Remove existing toast if any
  const existingToast = document.querySelector('.share-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
}