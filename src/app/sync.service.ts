// sync.service.ts
import { Injectable, Injector, inject } from '@angular/core';
import { NavigationEnd, Router, Event } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ExpenseService } from './expense.service';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private isInitialized = false;
  private lastSyncTime: Date | null = null;
  private syncInProgress = false;
  private wasOffline = false;
  private syncDebounceTimer: any;

  // Use injector to break circular dependency
  private injector = inject(Injector);
  private get authService(): AuthService {
    return this.injector.get(AuthService);
  }
  private get expenseService(): ExpenseService {
    return this.injector.get(ExpenseService);
  }

  constructor(private router: Router) {
    // Initialize offline status
    this.wasOffline = !navigator.onLine;
    
    // Delay initialization to ensure services are ready
    setTimeout(() => {
      this.initializeSync();
    });
  }

  /**
   * Initialize synchronization listeners
   */
  private initializeSync(): void {
    if (this.isInitialized) return;

    // Sync on route changes
    this.setupRouteSync();
    
    // Sync on network status changes (only when coming back online)
    this.setupNetworkSync();
    
    // Sync on data changes
    this.setupDataChangeSync();

    this.isInitialized = true;
  }

  /**
   * Sync when data changes (add, update, delete)
   */
  private setupDataChangeSync(): void {
    // Listen to expense service changes
    this.expenseService.expenses$.subscribe(() => {
      this.debouncedSync('data_change');
    });

    this.expenseService.groups$.subscribe(() => {
      this.debouncedSync('data_change');
    });
  }

  /**
   * Sync when navigating to any page
   */
  private setupRouteSync(): void {
    this.router.events
      .pipe(
        filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe(async (event: NavigationEnd) => {
        await this.triggerSync('route_change');
      });
  }

  /**
   * Sync when network comes back online (after being offline)
   */
  private setupNetworkSync(): void {
    window.addEventListener('online', async () => {
      // Only trigger if we were previously offline and have pending changes
      if (this.wasOffline && this.hasPendingChanges()) {
        await this.triggerSync('network_online');
      }
      this.wasOffline = false;
    });

    window.addEventListener('offline', () => {
      this.wasOffline = true;
    });
  }

  /**
   * Debounced sync to avoid multiple rapid syncs
   */
  private debouncedSync(source: string): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(() => {
      if (this.authService.isOnline() && this.authService.isAuthenticated()) {
        this.triggerSync(source);
      }
    }, 1000); // 1 second debounce
  }

  /**
   * Main sync trigger method
   */
  async triggerSync(source: string = 'manual'): Promise<void> {
    console.log(`Syncing Your Expenses - Trigger: ${source}`);
    
    // Prevent multiple simultaneous syncs
    if (this.syncInProgress) {
      return;
    }

    // Check if sync is needed
    if (!this.shouldSync()) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Update last sync time immediately to prevent multiple syncs
      this.lastSyncTime = new Date();

      if (this.authService.isOnline() && this.authService.isAuthenticated()) {
        // Load fresh data from Firebase first
        await this.expenseService.loadDataFromFirebase();
        
        // Sync any local changes to Firebase
        await this.expenseService.syncLocalDataToFirebase();
      }
    } catch (error) {
      console.error('Error during synchronization:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Check if sync should be performed
   */
  private shouldSync(): boolean {
    // Don't sync if not authenticated
    if (!this.authService.isAuthenticated()) {
      return false;
    }

    // Don't sync if offline
    if (!this.authService.isOnline()) {
      return false;
    }

    // Always sync when coming online from offline with pending changes
    if (this.wasOffline && this.hasPendingChanges()) {
      return true;
    }

    return true; // Always sync for data changes and navigation
  }

  /**
   * Force sync regardless of conditions
   */
  async forceSync(): Promise<void> {
    this.lastSyncTime = null;
    await this.triggerSync('force');
  }

  /**
   * Get sync status information
   */
  getSyncInfo(): {
    lastSync: Date | null;
    isOnline: boolean;
    isAuthenticated: boolean;
    shouldSync: boolean;
    syncInProgress: boolean;
  } {
    return {
      lastSync: this.lastSyncTime,
      isOnline: this.authService.isOnline(),
      isAuthenticated: this.authService.isAuthenticated(),
      shouldSync: this.shouldSync(),
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Manual sync trigger for components
   */
  async manualSync(): Promise<{ success: boolean; message: string }> {
    try {
      await this.forceSync();
      return { success: true, message: 'Sync completed successfully' };
    } catch (error) {
      return { success: false, message: 'Sync failed' };
    }
  }

  /**
   * Check if there are pending changes that need sync
   */
  hasPendingChanges(): boolean {
    // Implement logic to check if there are unsynced changes
    // For now, return true if we were offline (simplified)
    return this.wasOffline;
  }
}