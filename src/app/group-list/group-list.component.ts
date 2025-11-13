import { Component } from '@angular/core';
import { Group } from '../models/group.model';
import { ExpenseService } from '../expense.service';
import { Router } from '@angular/router';
import { Expense } from '../models/expense.model';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-group-list',
  templateUrl: './group-list.component.html',
  styleUrls: ['./group-list.component.scss']
})
export class GroupListComponent {
    groups: Group[] = [];
    expenses: Expense[] = [];
    showCreateForm = false;
    selectedGroup: Group | null = null;
    showExpenseForm = false;
    isEditingGroup = false;
    isEditingExpense = false;
    editingGroupId: string | null = null;
    editingExpenseId: string | null = null;
  
    newGroup: Omit<Group, 'id' | 'createdAt'> = {
      name: '',
      currency: 'INR',
      description: '',
      participants: [],
    };
  
    newExpense: Omit<Expense, 'id'> = {
      title: '',
      amount: 0,
      paidBy: '',
      participants: [],
      date: new Date(),
      settled: false,
      groupId: '',
      category: 'General',
    };
  
    newParticipantName = '';
    
    private subscriptions: Subscription = new Subscription();
  
    constructor(
      private expenseService: ExpenseService, 
      private authService: AuthService, 
      private router: Router
    ) {}
  
    ngOnInit(): void {
      this.initializeSubscriptions();
      this.loadInitialData();
    }
  
    // Initialize all subscriptions for real-time updates
    private initializeSubscriptions(): void {
      // Subscribe to groups updates - will update automatically when any group changes
      this.subscriptions.add(
        this.expenseService.groups$.subscribe(groups => {
          this.groups = groups;
          console.log('Groups automatically updated in UI:', groups);
          
          // If we have a selected group, update it with latest data
          if (this.selectedGroup) {
            const updatedGroup = groups.find(g => g.id === this.selectedGroup!.id);
            if (updatedGroup) {
              this.selectedGroup = updatedGroup;
            }
          }
        })
      );
  
      // Subscribe to expenses updates - will update automatically when any expense changes
      this.subscriptions.add(
        this.expenseService.expenses$.subscribe(allExpenses => {
          if (this.selectedGroup) {
            this.expenses = allExpenses.filter(exp => exp.groupId === this.selectedGroup!.id);
          } else {
            this.expenses = [];
          }
          console.log('Expenses automatically updated in UI:', this.expenses);
        })
      );
  
      // Subscribe to current group updates
      this.subscriptions.add(
        this.expenseService.currentGroup$.subscribe(group => {
          this.selectedGroup = group;
          console.log('Current group automatically updated in UI:', group);
          
          // Update expenses list when current group changes
          if (group) {
            const groupExpenses = this.expenseService.getExpenses(group.id);
            this.expenses = groupExpenses;
          } else {
            this.expenses = [];
          }
        })
      );
    }
  
    // Load initial data
    private loadInitialData(): void {
      const initialGroup = this.expenseService.getCurrentGroup();
      if (initialGroup) {
        this.expenseService.setCurrentGroup(initialGroup);
      }
      
      // Trigger initial data load
      this.expenseService.refreshAllData();
    }
  
    // Group Methods
    createGroup(): void {
      if (this.newGroup.name.trim() && this.newGroup.participants.length > 0) {
        try {
          const groupToSave: Group = {
            ...this.newGroup,
            id: '',
            createdAt: new Date()
          } as Group;
          
          const savedGroup = this.expenseService.saveGroup(groupToSave);
          this.selectGroup(savedGroup);
          this.resetForm();
          
          // No need to manually load groups - subscription will handle it
        } catch (error) {
          console.error('Error creating group:', error);
          alert('Error creating group. Please try again.');
        }
      }
    }
  
    updateGroup(): void {
      if (this.newGroup.name.trim() && this.newGroup.participants.length > 0 && this.editingGroupId) {
        try {
          const oldGroup = this.groups.find(g => g.id === this.editingGroupId);
          
          const updatedGroup: Group = {
            id: this.editingGroupId,
            name: this.newGroup.name,
            currency: this.newGroup.currency,
            description: this.newGroup.description,
            participants: this.newGroup.participants,
            createdAt: oldGroup?.createdAt || new Date()
          };
          
          // This will automatically notify all subscribers
          this.expenseService.updateGroup(updatedGroup);
          this.resetForm();
          
          // Update current group if it's the one being edited
          if (this.selectedGroup?.id === this.editingGroupId) {
            this.selectedGroup = updatedGroup;
            this.expenseService.setCurrentGroup(updatedGroup);
          }
  
          alert('Group updated successfully! All pages will reflect these changes.');
        } catch (error) {
          console.error('Error updating group:', error);
          alert('Error updating group. Please try again.');
        }
      }
    }
  
    editGroup(group: Group): void {
      this.isEditingGroup = true;
      this.editingGroupId = group.id;
      this.newGroup = {
        name: group.name,
        currency: group.currency,
        description: group.description || '',
        participants: [...group.participants]
      };
      this.showCreateForm = true;
    }
  
    selectGroup(group: Group): void {
      this.expenseService.setCurrentGroup(group);
      this.showExpenseForm = false;
    }
  
    isGroupSelected(group: Group): boolean {
      return this.selectedGroup?.id === group.id;
    }
  
    addParticipant(): void {
      if (
        this.newParticipantName.trim() &&
        !this.newGroup.participants.includes(this.newParticipantName.trim())
      ) {
        this.newGroup.participants.push(this.newParticipantName.trim());
        this.newParticipantName = '';
      }
    }
  
    removeParticipant(participant: string): void {
      this.newGroup.participants = this.newGroup.participants.filter(
        (p) => p !== participant
      );
    }
  
    resetForm(): void {
      this.newGroup = {
        name: '',
        currency: 'INR',
        description: '',
        participants: [],
      };
      this.newParticipantName = '';
      this.showCreateForm = false;
      this.isEditingGroup = false;
      this.editingGroupId = null;
    }
  
    deleteGroup(id: string): void {
      if (confirm('Are you sure you want to delete this group? All expenses in this group will also be deleted.')) {
        try {
          this.expenseService.deleteGroup(id);
          // No need to manually update - subscriptions will handle it
        } catch (error) {
          console.error('Error deleting group:', error);
          alert('Error deleting group. Please try again.');
        }
      }
    }
  
    // Expense Methods
    getTotalExpenses(): number {
      return this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    }
  
    getAmountPerPerson(): number {
      if (this.newExpense.participants.length === 0) return 0;
      return this.newExpense.amount / this.newExpense.participants.length;
    }
  
    toggleExpenseParticipant(participant: string): void {
      const index = this.newExpense.participants.indexOf(participant);
      if (index > -1) {
        this.newExpense.participants.splice(index, 1);
      } else {
        this.newExpense.participants.push(participant);
      }
    }
  
    isExpenseParticipantSelected(participant: string): boolean {
      return this.newExpense.participants.includes(participant);
    }
  
    selectAllExpenseParticipants(): void {
      if (this.selectedGroup) {
        this.newExpense.participants = [...this.selectedGroup.participants];
      }
    }
  
    addExpense(): void {
      if (
        this.newExpense.title.trim() &&
        this.newExpense.amount > 0 &&
        this.newExpense.paidBy &&
        this.newExpense.participants.length > 0 &&
        this.selectedGroup
      ) {
        try {
          const expenseToSave: Expense = {
            ...this.newExpense,
            id: '',
            groupId: this.selectedGroup.id
          } as Expense;
          
          this.expenseService.saveExpense(expenseToSave);
          this.resetExpenseForm();
          // No need to manually load expenses - subscription will handle it
        } catch (error) {
          console.error('Error adding expense:', error);
          alert('Error adding expense. Please try again.');
        }
      }
    }
  
    updateExpense(): void {
      if (
        this.newExpense.title.trim() &&
        this.newExpense.amount > 0 &&
        this.newExpense.paidBy &&
        this.newExpense.participants.length > 0 &&
        this.selectedGroup &&
        this.editingExpenseId
      ) {
        try {
          const updatedExpense: Expense = {
            ...this.newExpense,
            id: this.editingExpenseId,
            groupId: this.selectedGroup.id
          } as Expense;
          
          this.expenseService.updateExpense(updatedExpense);
          this.resetExpenseForm();
          // No need to manually load expenses - subscription will handle it
        } catch (error) {
          console.error('Error updating expense:', error);
          alert('Error updating expense. Please try again.');
        }
      }
    }
  
    editExpense(expense: Expense): void {
      this.isEditingExpense = true;
      this.editingExpenseId = expense.id;
      this.newExpense = {
        title: expense.title,
        amount: expense.amount,
        paidBy: expense.paidBy,
        participants: [...expense.participants],
        date: expense.date,
        settled: expense.settled,
        groupId: expense.groupId,
        category: expense.category || 'General'
      };
      this.showExpenseForm = true;
    }
  
    resetExpenseForm(): void {
      this.newExpense = {
        title: '',
        amount: 0,
        paidBy: '',
        participants: [],
        date: new Date(),
        settled: false,
        groupId: this.selectedGroup?.id || '',
        category: 'General',
      };
      this.showExpenseForm = false;
      this.isEditingExpense = false;
      this.editingExpenseId = null;
    }
  
    deleteExpense(id: string): void {
      if (confirm('Are you sure you want to delete this expense?')) {
        try {
          this.expenseService.deleteExpense(id);
          // No need to manually load expenses - subscription will handle it
        } catch (error) {
          console.error('Error deleting expense:', error);
          alert('Error deleting expense. Please try again.');
        }
      }
    }
  
    formatCurrency(amount: number): string {
      return `${amount.toFixed(2)} ${this.selectedGroup?.currency || 'INR'}`;
    }
  
    formatDate(date: Date): string {
      const today = new Date();
      const expenseDate = new Date(date);
  
      if (expenseDate.toDateString() === today.toDateString()) {
        return 'Today';
      }
  
      return expenseDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
    }
  
    onParticipantKeyPress(event: KeyboardEvent): void {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addParticipant();
      }
    }
  
    viewReport(): void {
      if (this.selectedGroup) {
        this.router.navigate(['/balances']);
      } else {
        alert('Please select a group first to view reports.');
      }
    }
  
    // Manual refresh if needed (usually not necessary)
    refreshData(): void {
      this.expenseService.refreshAllData();
    }
  
    ngOnDestroy(): void {
      this.subscriptions.unsubscribe();
    }

    // Add logout method
logout(): void {
  if (confirm('Are you sure you want to logout?')) {
    this.authService.logout();
  }
}
}
