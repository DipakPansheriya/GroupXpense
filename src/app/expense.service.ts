// expense.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Expense } from './models/expense.model';
import { Group } from './models/group.model';
import { AuthService } from './auth.service';
import { SyncService } from './sync.service';

// Firebase imports
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc
} from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private readonly GROUPS_KEY = 'group-xpense-groups';
  private readonly EXPENSES_KEY = 'group-xpense-expenses';
  private readonly CURRENT_GROUP_KEY = 'group-xpense-current-group';
  private readonly SYNC_STATUS_KEY = 'group-xpense-sync-status';

  // Centralized BehaviorSubjects for real-time updates across all pages
  private groupsSubject = new BehaviorSubject<Group[]>(this.getGroupsFromStorage());
  private expensesSubject = new BehaviorSubject<Expense[]>(this.getExpensesFromStorage());
  private currentGroupSubject = new BehaviorSubject<Group | null>(this.getCurrentGroupFromStorage());

  // Public observables for all components to subscribe to
  public groups$ = this.groupsSubject.asObservable();
  public expenses$ = this.expensesSubject.asObservable();
  public currentGroup$ = this.currentGroupSubject.asObservable();

  // Firebase
  private firestore = getFirestore();

  constructor(
    private authService: AuthService,
    private syncService: SyncService
  ) { 
    this.initializeService();
  }

  /**
   * Initialize service with sync capabilities
   */
  private initializeService(): void {
    console.log('ExpenseService initializing...');
    
    // Initial data load
    this.initialDataLoad();
  }

  /**
   * Initial data load when service starts
   */
  private async initialDataLoad(): Promise<void> {
    if (this.authService.isAuthenticated()) {
      console.log('ExpenseService initializing with user data...');
      
      if (this.authService.isOnline()) {
        // Try to load from Firebase first
        await this.loadDataFromFirebase();
      } else {
        // Use local data
        this.refreshAllData();
        console.log('Offline - using local data only');
      }
    }
  }

  // Check if online and user has Firebase UID
  private canSyncToFirebase(): boolean {
    return this.authService.isOnline() && !!this.authService.getCurrentUser()?.firebaseUid;
  }

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

  // FIREBASE SYNC: Sync all local data to Firebase
  async syncLocalDataToFirebase(): Promise<void> {
    if (!this.canSyncToFirebase()) return;

    try {
      const user = this.authService.getCurrentUser();
      if (!user?.firebaseUid) return;

      console.log('Starting Firebase sync...');

      // Sync groups
      const groups = this.getGroupsFromStorage();
      const groupsDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'groups');
      await setDoc(groupsDoc, { 
        groups: groups,
        lastSynced: new Date()
      });
      console.log('Groups synced to Firebase:', groups.length);

      // Sync expenses
      const expenses = this.getExpensesFromStorage();
      const expensesDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'expenses');
      await setDoc(expensesDoc, { 
        expenses: expenses,
        lastSynced: new Date()
      });
      console.log('Expenses synced to Firebase:', expenses.length);

      // Sync current group
      const currentGroup = this.getCurrentGroupFromStorage();
      if (currentGroup) {
        const currentGroupDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'currentGroup');
        await setDoc(currentGroupDoc, { 
          currentGroup: currentGroup,
          lastSynced: new Date()
        });
        console.log('Current group synced to Firebase');
      }

      this.setSyncStatus('synced');
      console.log('All local data synced to Firebase successfully');
    } catch (error) {
      console.error('Error syncing local data to Firebase:', error);
      this.setSyncStatus('error');
    }
  }

  // FIREBASE SYNC: Load data from Firebase to localStorage
  async loadDataFromFirebase(): Promise<boolean> {
    if (!this.authService.isOnline()) {
      console.log('Offline - cannot load from Firebase');
      return false;
    }

    const user = this.authService.getCurrentUser();
    if (!user?.firebaseUid) {
      console.log('No Firebase UID - cannot load from Firebase');
      return false;
    }

    try {
      console.log('Loading data from Firebase...');
      let dataLoaded = false;

      // Load groups from Firebase
      const groupsDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'groups');
      const groupsSnapshot = await getDoc(groupsDoc);
      
      if (groupsSnapshot.exists()) {
        const firebaseData = groupsSnapshot.data();
        const firebaseGroups = firebaseData['groups'] as Group[];
        
        if (firebaseGroups && firebaseGroups.length > 0) {
          await this.mergeAndSaveGroups(firebaseGroups);
          dataLoaded = true;
          console.log('Groups loaded from Firebase:', firebaseGroups.length);
        }
      }

      // Load expenses from Firebase
      const expensesDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'expenses');
      const expensesSnapshot = await getDoc(expensesDoc);
      
      if (expensesSnapshot.exists()) {
        const firebaseData = expensesSnapshot.data();
        const firebaseExpenses = firebaseData['expenses'] as Expense[];
        
        if (firebaseExpenses && firebaseExpenses.length > 0) {
          await this.mergeAndSaveExpenses(firebaseExpenses);
          dataLoaded = true;
          console.log('Expenses loaded from Firebase:', firebaseExpenses.length);
        }
      }

      // Load current group from Firebase
      const currentGroupDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'currentGroup');
      const currentGroupSnapshot = await getDoc(currentGroupDoc);
      
      if (currentGroupSnapshot.exists()) {
        const firebaseData = currentGroupSnapshot.data();
        const firebaseCurrentGroup = firebaseData['currentGroup'] as Group;
        
        if (firebaseCurrentGroup) {
          this.setCurrentGroup(firebaseCurrentGroup);
          dataLoaded = true;
          console.log('Current group loaded from Firebase');
        }
      }

      if (dataLoaded) {
        console.log('Firebase data loaded successfully');
        this.setSyncStatus('synced');
        return true;
      } else {
        console.log('No data found in Firebase, using local data');
        return false;
      }
    } catch (error) {
      console.error('Error loading data from Firebase:', error);
      this.setSyncStatus('error');
      return false;
    }
  }

  /**
   * Merge Firebase groups with local groups (Firebase data takes precedence)
   */
  private async mergeAndSaveGroups(firebaseGroups: Group[]): Promise<void> {
    const localGroups = this.getGroupsFromStorage();
    const mergedGroups = this.mergeData(localGroups, firebaseGroups, 'groups');
    
    const userKey = this.getUserKey(this.GROUPS_KEY);
    localStorage.setItem(userKey, JSON.stringify(mergedGroups));
    this.groupsSubject.next(mergedGroups);
  }

  /**
   * Merge Firebase expenses with local expenses (Firebase data takes precedence)
   */
  private async mergeAndSaveExpenses(firebaseExpenses: Expense[]): Promise<void> {
    const localExpenses = this.getExpensesFromStorage();
    const mergedExpenses = this.mergeData(localExpenses, firebaseExpenses, 'expenses');
    
    const userKey = this.getUserKey(this.EXPENSES_KEY);
    localStorage.setItem(userKey, JSON.stringify(mergedExpenses));
    this.expensesSubject.next(mergedExpenses);
  }

  /**
   * Generic data merger (Firebase data takes precedence in case of conflicts)
   */
  private mergeData<T extends { id: string }>(
    localData: T[], 
    firebaseData: T[], 
    dataType: string
  ): T[] {
    const mergedMap = new Map<string, T>();

    // Add all local data first
    localData.forEach(item => {
      mergedMap.set(item.id, item);
    });

    // Overwrite with Firebase data (Firebase is source of truth)
    firebaseData.forEach(firebaseItem => {
      mergedMap.set(firebaseItem.id, firebaseItem);
    });

    return Array.from(mergedMap.values());
  }

  // FIREBASE SYNC: Set sync status
  private setSyncStatus(status: 'pending' | 'synced' | 'error'): void {
    const userKey = this.getUserKey(this.SYNC_STATUS_KEY);
    localStorage.setItem(userKey, status);
  }

  // FIREBASE SYNC: Get sync status
  getSyncStatus(): string {
    const userKey = this.getUserKey(this.SYNC_STATUS_KEY);
    return localStorage.getItem(userKey) || 'synced';
  }

  // Initialize service - call this after login
  async initialize(): Promise<void> {
    console.log('Initializing ExpenseService...');
    if (this.authService.isOnline()) {
      await this.loadDataFromFirebase();
    } else {
      console.log('Offline - using local data only');
    }
  }

  // ENHANCED CRUD METHODS WITH FIREBASE SYNC
  async saveGroup(group: Group): Promise<Group> {
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
        group.createdBy = userId;
        group.createdAt = new Date();
        groups.push(group);
      }
      
      const userKey = this.getUserKey(this.GROUPS_KEY);
      localStorage.setItem(userKey, JSON.stringify(groups));
      this.groupsSubject.next(groups);
      
      console.log('Group saved to localStorage:', group);

      // FIREBASE SYNC: Sync to Firebase if online
      if (this.canSyncToFirebase()) {
        console.log('Syncing groups to Firebase after save...');
        await this.syncLocalDataToFirebase();
      }
      
      return group;
    } catch (error) {
      console.error('Error saving group:', error);
      throw error;
    }
  }

  // ... (ALL YOUR EXISTING METHODS REMAIN EXACTLY THE SAME - no changes needed below this line)
  // getGroupsFromStorage, getExpensesFromStorage, deleteGroup, saveExpense, etc.
  // ALL YOUR EXISTING CODE CAN STAY EXACTLY AS IT IS

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

  // Group Methods
  getGroups(): Group[] {
    return this.getGroupsFromStorage();
  }

  getGroupById(id: string): Group | null {
    const groups = this.getGroupsFromStorage();
    return groups.find(g => g.id === id) || null;
  }

  // Expense Methods
  getExpenses(groupId?: string): Expense[] {
    const allExpenses = this.getExpensesFromStorage();
    
    if (groupId) {
      return allExpenses.filter(expense => expense.groupId === groupId);
    }
    return allExpenses;
  }

  async deleteGroup(id: string): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be logged in to delete groups');
      }

      const groups = this.getGroupsFromStorage().filter(g => g.id !== id);
      const userKey = this.getUserKey(this.GROUPS_KEY);
      localStorage.setItem(userKey, JSON.stringify(groups));
      this.groupsSubject.next(groups);
      
      // Also delete all expenses for this group
      await this.deleteAllExpensesForGroup(id);
      
      // If current group is deleted, clear it
      const currentGroup = this.getCurrentGroupFromStorage();
      if (currentGroup && currentGroup.id === id) {
        this.clearCurrentGroup();
      }
      
      console.log('Group deleted from localStorage:', id);

      // FIREBASE SYNC: Sync to Firebase if online
      if (this.canSyncToFirebase()) {
        console.log('Syncing to Firebase after delete...');
        await this.syncLocalDataToFirebase();
      }
      
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Delete all expenses for a group (when group is deleted)
  private async deleteAllExpensesForGroup(groupId: string): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      const allExpenses = this.getExpensesFromStorage();
      const filteredExpenses = allExpenses.filter(expense => expense.groupId !== groupId);
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      localStorage.setItem(userKey, JSON.stringify(filteredExpenses));
      this.expensesSubject.next(filteredExpenses);
      console.log(`All expenses for group ${groupId} deleted from localStorage`);
    } catch (error) {
      console.error('Error deleting group expenses:', error);
    }
  }

  async saveExpense(expense: Expense): Promise<Expense> {
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
        expense.createdBy = userId;
        expense.date = new Date();
        expenses.push(expense);
      }
      
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      localStorage.setItem(userKey, JSON.stringify(expenses));
      this.expensesSubject.next(expenses);
      
      console.log('Expense saved to localStorage:', expense);

      // FIREBASE SYNC: Sync to Firebase if online
      if (this.canSyncToFirebase()) {
        console.log('Syncing expenses to Firebase after save...');
        await this.syncLocalDataToFirebase();
      }
      
      return expense;
    } catch (error) {
      console.error('Error saving expense:', error);
      throw error;
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be logged in to delete expenses');
      }

      const expenses = this.getExpensesFromStorage().filter(e => e.id !== id);
      const userKey = this.getUserKey(this.EXPENSES_KEY);
      localStorage.setItem(userKey, JSON.stringify(expenses));
      this.expensesSubject.next(expenses);
      
      console.log('Expense deleted from localStorage:', id);

      // FIREBASE SYNC: Sync to Firebase if online
      if (this.canSyncToFirebase()) {
        console.log('Syncing to Firebase after delete...');
        await this.syncLocalDataToFirebase();
      }
      
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async setCurrentGroup(group: Group): Promise<void> {
    try {
      const userKey = this.getUserKey(this.CURRENT_GROUP_KEY);
      localStorage.setItem(userKey, JSON.stringify(group));
      this.currentGroupSubject.next(group);
      
      console.log('Current group set in localStorage:', group);

      // FIREBASE SYNC: Sync to Firebase if online
      if (this.canSyncToFirebase()) {
        const user = this.authService.getCurrentUser();
        if (user?.firebaseUid) {
          const currentGroupDoc = doc(this.firestore, 'users', user.firebaseUid, 'data', 'currentGroup');
          await setDoc(currentGroupDoc, { 
            currentGroup: group,
            lastSynced: new Date()
          });
          console.log('Current group synced to Firebase');
        }
      }
      
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
      console.log('Current group cleared from localStorage');
    } catch (error) {
      console.error('Error clearing current group:', error);
    }
  }

  getAllExpenses(): Expense[] {
    return this.getExpensesFromStorage();
  }

  // Balance Calculation Methods (unchanged)
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

  // Update expenses when group participants change
  async updateExpensesForGroupParticipants(groupId: string, oldParticipants: string[], newParticipants: string[]): Promise<void> {
    const expenses = this.getExpenses(groupId);
    let expensesUpdated = false;

    for (const expense of expenses) {
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
        await this.saveExpense(expense);
        expensesUpdated = true;
      }
    }

    if (expensesUpdated) {
      console.log('Expenses updated for group participant changes');
    }
  }

  // Update methods with automatic notifications
  async updateGroup(updatedGroup: Group): Promise<void> {
    const oldGroup = this.getGroupById(updatedGroup.id);
    
    if (oldGroup) {
      await this.saveGroup(updatedGroup);
      
      const oldParticipants = oldGroup.participants;
      const newParticipants = updatedGroup.participants;
      
      const participantsChanged = 
        oldParticipants.length !== newParticipants.length ||
        !oldParticipants.every((participant, index) => participant === newParticipants[index]);
      
      if (participantsChanged) {
        await this.updateExpensesForGroupParticipants(updatedGroup.id, oldParticipants, newParticipants);
      }
    } else {
      await this.saveGroup(updatedGroup);
    }
  }

  async updateExpense(updatedExpense: Expense): Promise<void> {
    await this.saveExpense(updatedExpense);
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
        this.CURRENT_GROUP_KEY,
        this.SYNC_STATUS_KEY
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