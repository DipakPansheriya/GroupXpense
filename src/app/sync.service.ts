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
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private syncInProgress = false;

  // Use injector to break circular dependency
  private injector = inject(Injector);
  private get authService(): AuthService {
    return this.injector.get(AuthService);
  }
  private get expenseService(): ExpenseService {
    return this.injector.get(ExpenseService);
  }

  constructor(private router: Router) {
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
    
    // Sync on network status changes
    this.setupNetworkSync();
    
    // Sync on app visibility changes
    this.setupVisibilitySync();
    
    // Periodic sync
    this.setupPeriodicSync();

    this.isInitialized = true;
    console.log('SyncService initialized');
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
        console.log('Navigation detected, checking sync...', event.url);
        await this.triggerSync('route_change');
      });
  }

  /**
   * Sync when network status changes
   */
  private setupNetworkSync(): void {
    window.addEventListener('online', async () => {
      console.log('Network online, triggering sync...');
      await this.triggerSync('network_online');
    });

    window.addEventListener('offline', () => {
      console.log('Network offline');
    });
  }

  /**
   * Sync when app becomes visible
   */
  private setupVisibilitySync(): void {
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        console.log('App became visible, checking sync...');
        await this.triggerSync('visibility_change');
      }
    });
  }

  /**
   * Periodic sync (every 5 minutes when app is active)
   */
  private setupPeriodicSync(): void {
    setInterval(async () => {
      if (this.authService.isOnline() && this.authService.isAuthenticated() && !this.syncInProgress) {
        console.log('Periodic sync check...');
        await this.triggerSync('periodic');
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Main sync trigger method
   */
  async triggerSync(source: string = 'manual'): Promise<void> {
    console.log(`Sync triggered by: ${source}`);

    // Prevent multiple simultaneous syncs
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    // Check if sync is needed
    if (!this.shouldSync()) {
      console.log('Sync not needed at this time');
      return;
    }

    this.syncInProgress = true;

    try {
      // Update last sync time immediately to prevent multiple syncs
      this.lastSyncTime = new Date();

      if (this.authService.isOnline() && this.authService.isAuthenticated()) {
        console.log('Starting data synchronization...');
        
        // Load fresh data from Firebase
        await this.expenseService.loadDataFromFirebase();
        
        // Sync any local changes to Firebase
        await this.expenseService.syncLocalDataToFirebase();
        
        console.log('Data synchronization completed');
      } else {
        console.log('Cannot sync - user offline or not authenticated');
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

    // Sync if never synced before
    if (!this.lastSyncTime) {
      return true;
    }

    // Sync if last sync was more than SYNC_INTERVAL ago
    const timeSinceLastSync = Date.now() - this.lastSyncTime.getTime();
    return timeSinceLastSync > this.SYNC_INTERVAL;
  }

  /**
   * Force sync regardless of conditions
   */
  async forceSync(): Promise<void> {
    console.log('Force syncing data...');
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
      return { success: false, message: 'Sync failed: ' + error };
    }
  }

  /**
   * Initialize sync service - call this in app component
   */
  initialize(): void {
    console.log('SyncService initialized successfully');
  }
}