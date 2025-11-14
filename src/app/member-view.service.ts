// member-view.service.ts
import { Injectable } from '@angular/core';
import { Group } from './models/group.model';
import { Expense } from './models/expense.model';

@Injectable({
  providedIn: 'root'
})
export class MemberViewService {
  private readonly USER_GROUPS_KEY = 'group-xpense-groups';
  private readonly USER_EXPENSES_KEY = 'group-xpense-expenses';

  // Get user's groups from localStorage
  getUserGroups(userId: string): Group[] {
    try {
      const userKey = `${this.USER_GROUPS_KEY}-${userId}`;
      const data = localStorage.getItem(userKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting user groups:', error);
      return [];
    }
  }

  // Get user's expenses from localStorage
  getUserExpenses(userId: string): Expense[] {
    try {
      const userKey = `${this.USER_EXPENSES_KEY}-${userId}`;
      const data = localStorage.getItem(userKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting user expenses:', error);
      return [];
    }
  }

  // Get specific group by ID for a user
  getGroupById(userId: string, groupId: string): Group | null {
    const groups = this.getUserGroups(userId);
    return groups.find(g => g.id === groupId) || null;
  }

  // Get expenses for a specific group
  getExpensesForGroup(userId: string, groupId: string): Expense[] {
    const expenses = this.getUserExpenses(userId);
    return expenses.filter(expense => expense.groupId === groupId);
  }

  // Check if user data exists
  hasUserData(userId: string): boolean {
    const groups = this.getUserGroups(userId);
    return groups.length > 0;
  }
}