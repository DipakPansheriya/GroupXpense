import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Expense } from './models/expense.model';
import { Group } from './models/group.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private readonly GROUPS_KEY = 'group-xpense-groups';
  private readonly EXPENSES_KEY = 'group-xpense-expenses';
  private readonly CURRENT_GROUP_KEY = 'group-xpense-current-group';

  // Centralized BehaviorSubjects for real-time updates across all pages
  private groupsSubject = new BehaviorSubject<Group[]>(this.getGroupsFromStorage());
  private expensesSubject = new BehaviorSubject<Expense[]>(this.getExpensesFromStorage());
  private currentGroupSubject = new BehaviorSubject<Group | null>(this.getCurrentGroupFromStorage());

  // Public observables for all components to subscribe to
  public groups$ = this.groupsSubject.asObservable();
  public expenses$ = this.expensesSubject.asObservable();
  public currentGroup$ = this.currentGroupSubject.asObservable();

  constructor(private authService: AuthService) { }

  // Private method to get current user ID with fallback
  private getCurrentUserId(): string | null {
    return this.authService.getCurrentUserId();
  }

  // Private method to get user-specific storage key
  private getUserKey(baseKey: string): string {
    const userId = this.getCurrentUserId();
    if (!userId) {
      throw new Error('No user logged in');
    }
    return `${baseKey}-${userId}`;
  }

  // Private methods to get data from storage with user isolation
  private getGroupsFromStorage(): Group[] {
    try {
      const userKey = this.getUserKey(this.GROUPS_KEY);
      const data = localStorage.getItem(userKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading groups from storage:', error);
      return [];
    }
  }

  private getExpensesFromStorage(): Expense[] {
    try {
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      const data = localStorage.getItem(userKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading expenses from storage:', error);
      return [];
    }
  }

  private getCurrentGroupFromStorage(): Group | null {
    try {
      const userKey = this.getUserKey(this.CURRENT_GROUP_KEY);
      const data = localStorage.getItem(userKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading current group from storage:', error);
      return null;
    }
  }

  // Public method to refresh all data
  refreshAllData(): void {
    this.refreshGroups();
    this.refreshExpenses();
    this.refreshCurrentGroup();
  }

  // Public method to refresh groups data
  refreshGroups(): void {
    const groups = this.getGroupsFromStorage();
    this.groupsSubject.next(groups);
    console.log('Groups refreshed:', groups);
  }

  // Public method to refresh expenses data
  refreshExpenses(): void {
    const expenses = this.getExpensesFromStorage();
    this.expensesSubject.next(expenses);
    console.log('Expenses refreshed:', expenses);
  }

  // Public method to refresh current group
  refreshCurrentGroup(): void {
    const currentGroup = this.getCurrentGroupFromStorage();
    this.currentGroupSubject.next(currentGroup);
    console.log('Current group refreshed:', currentGroup);
  }

  // Group Methods - All automatically notify subscribers
  getGroups(): Group[] {
    return this.getGroupsFromStorage();
  }

  saveGroup(group: Group): Group {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be logged in to save groups');
      }

      const groups = this.getGroupsFromStorage();
      
      if (group.id) {
        const index = groups.findIndex(g => g.id === group.id);
        if (index !== -1) {
          groups[index] = group;
        }
      } else {
        group.id = this.generateUUID();
        group.createdBy = userId; // Set the creator
        group.createdAt = new Date();
        groups.push(group);
      }
      
      const userKey = this.getUserKey(this.GROUPS_KEY);
      localStorage.setItem(userKey, JSON.stringify(groups));
      this.groupsSubject.next(groups); // Notify all subscribers
      console.log('Group saved, notifying subscribers');
      return group;
    } catch (error) {
      console.error('Error saving group:', error);
      throw error;
    }
  }

  deleteGroup(id: string): void {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be logged in to delete groups');
      }

      const groups = this.getGroupsFromStorage().filter(g => g.id !== id);
      const userKey = this.getUserKey(this.GROUPS_KEY);
      localStorage.setItem(userKey, JSON.stringify(groups));
      this.groupsSubject.next(groups); // Notify all subscribers
      
      // Also delete all expenses for this group
      this.deleteAllExpensesForGroup(id);
      
      // If current group is deleted, clear it
      const currentGroup = this.getCurrentGroupFromStorage();
      if (currentGroup && currentGroup.id === id) {
        this.clearCurrentGroup();
      }
      
      console.log('Group deleted, notifying subscribers');
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  getGroupById(id: string): Group | null {
    const groups = this.getGroupsFromStorage();
    return groups.find(g => g.id === id) || null;
  }

  // Expense Methods - All automatically notify subscribers
  getExpenses(groupId?: string): Expense[] {
    const allExpenses = this.getExpensesFromStorage();
    
    if (groupId) {
      return allExpenses.filter(expense => expense.groupId === groupId);
    }
    return allExpenses;
  }

  saveExpense(expense: Expense): Expense {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be logged in to save expenses');
      }

      const expenses = this.getExpensesFromStorage();
      
      if (expense.id) {
        const index = expenses.findIndex(e => e.id === expense.id);
        if (index !== -1) {
          expenses[index] = expense;
        }
      } else {
        expense.id = this.generateUUID();
        expense.createdBy = userId; // Set the creator
        expense.date = new Date();
        expenses.push(expense);
      }
      
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      localStorage.setItem(userKey, JSON.stringify(expenses));
      this.expensesSubject.next(expenses); // Notify all subscribers
      console.log('Expense saved, notifying subscribers');
      return expense;
    } catch (error) {
      console.error('Error saving expense:', error);
      throw error;
    }
  }

  deleteExpense(id: string): void {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be logged in to delete expenses');
      }

      const expenses = this.getExpensesFromStorage().filter(e => e.id !== id);
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      localStorage.setItem(userKey, JSON.stringify(expenses));
      this.expensesSubject.next(expenses); // Notify all subscribers
      console.log('Expense deleted, notifying subscribers');
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  // Delete all expenses for a group (when group is deleted)
  private deleteAllExpensesForGroup(groupId: string): void {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      const allExpenses = this.getExpensesFromStorage();
      const filteredExpenses = allExpenses.filter(expense => expense.groupId !== groupId);
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      localStorage.setItem(userKey, JSON.stringify(filteredExpenses));
      this.expensesSubject.next(filteredExpenses); // Notify all subscribers
      console.log(`All expenses for group ${groupId} deleted, notifying subscribers`);
    } catch (error) {
      console.error('Error deleting group expenses:', error);
    }
  }

  // Update expenses when group participants change
  updateExpensesForGroupParticipants(groupId: string, oldParticipants: string[], newParticipants: string[]): void {
    const expenses = this.getExpenses(groupId);
    let expensesUpdated = false;

    expenses.forEach(expense => {
      let shouldUpdate = false;
      
      // Check if paidBy participant was removed
      if (!newParticipants.includes(expense.paidBy)) {
        expense.paidBy = newParticipants[0];
        shouldUpdate = true;
      }
      
      // Check and update participants list
      const updatedParticipants = expense.participants.filter(participant => 
        newParticipants.includes(participant)
      );
      
      if (updatedParticipants.length === 0) {
        expense.participants = [...newParticipants];
        shouldUpdate = true;
      } else if (updatedParticipants.length !== expense.participants.length) {
        expense.participants = updatedParticipants;
        shouldUpdate = true;
      }
      
      if (shouldUpdate) {
        this.saveExpense(expense);
        expensesUpdated = true;
      }
    });

    if (expensesUpdated) {
      console.log('Expenses updated for group participant changes');
    }
  }

  // Current Group Management
  setCurrentGroup(group: Group): void {
    try {
      const userKey = this.getUserKey(this.CURRENT_GROUP_KEY);
      localStorage.setItem(userKey, JSON.stringify(group));
      this.currentGroupSubject.next(group);
      console.log('Current group set, notifying subscribers');
    } catch (error) {
      console.error('Error setting current group:', error);
    }
  }

  getCurrentGroup(): Group | null {
    return this.getCurrentGroupFromStorage();
  }

  clearCurrentGroup(): void {
    try {
      const userKey = this.getUserKey(this.CURRENT_GROUP_KEY);
      localStorage.removeItem(userKey);
      this.currentGroupSubject.next(null);
      console.log('Current group cleared, notifying subscribers');
    } catch (error) {
      console.error('Error clearing current group:', error);
    }
  }

  // Update methods with automatic notifications
  updateGroup(updatedGroup: Group): void {
    const oldGroup = this.getGroupById(updatedGroup.id);
    
    if (oldGroup) {
      this.saveGroup(updatedGroup);
      
      const oldParticipants = oldGroup.participants;
      const newParticipants = updatedGroup.participants;
      
      const participantsChanged = 
        oldParticipants.length !== newParticipants.length ||
        !oldParticipants.every((participant, index) => participant === newParticipants[index]);
      
      if (participantsChanged) {
        this.updateExpensesForGroupParticipants(updatedGroup.id, oldParticipants, newParticipants);
      }
    } else {
      this.saveGroup(updatedGroup);
    }
  }

  updateExpense(updatedExpense: Expense): void {
    this.saveExpense(updatedExpense);
  }

  getAllExpenses(): Expense[] {
    return this.getExpensesFromStorage();
  }

  // Balance Calculation Methods
  calculateBalances(groupId: string): Map<string, number> {
    const expenses = this.getExpenses(groupId);
    const group = this.getGroupById(groupId);
    
    if (!group) {
      return new Map();
    }

    const balances = new Map<string, number>();

    group.participants.forEach(participant => {
      balances.set(participant, 0);
    });

    expenses.forEach(expense => {
      if (!expense.settled) {
        const amountPerPerson = expense.amount / expense.participants.length;
        balances.set(expense.paidBy, (balances.get(expense.paidBy) || 0) + expense.amount);
        expense.participants.forEach(participant => {
          balances.set(participant, (balances.get(participant) || 0) - amountPerPerson);
        });
      }
    });

    return balances;
  }

  getSimplifiedBalances(groupId: string): { from: string, to: string, amount: number }[] {
    const balances = this.calculateBalances(groupId);
    const transactions: { from: string, to: string, amount: number }[] = [];
    
    const balanceArray = Array.from(balances.entries()).map(([name, balance]) => ({
      name,
      balance
    }));

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
          amount: parseFloat(amount.toFixed(2))
        });

        debtor.balance += amount;
        creditor.balance -= amount;

        if (Math.abs(debtor.balance) < 0.01) i++;
        if (creditor.balance < 0.01) j--;
      } else {
        break;
      }
    }

    return transactions;
  }

  getTotalExpenses(groupId: string): number {
    const expenses = this.getExpenses(groupId);
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  }

  getExpensesByParticipant(groupId: string): Map<string, number> {
    const expenses = this.getExpenses(groupId);
    const participantExpenses = new Map<string, number>();

    expenses.forEach(expense => {
      const currentPaid = participantExpenses.get(expense.paidBy) || 0;
      participantExpenses.set(expense.paidBy, currentPaid + expense.amount);
    });

    return participantExpenses;
  }

  // Method to clear all user data (useful for logout)
  clearUserData(): void {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      // Clear all user-specific keys
      const keysToClear = [
        this.GROUPS_KEY,
        this.EXPENSES_KEY,
        this.CURRENT_GROUP_KEY
      ];

      keysToClear.forEach(baseKey => {
        const userKey = `${baseKey}-${userId}`;
        localStorage.removeItem(userKey);
      });

      // Reset subjects
      this.groupsSubject.next([]);
      this.expensesSubject.next([]);
      this.currentGroupSubject.next(null);

      console.log('User data cleared successfully');
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  }

  // UUID Generation Method (RFC4122 version 4 compliant)
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Method to validate UUID format
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}