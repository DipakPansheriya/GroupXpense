// app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { SyncService } from './sync.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  showSyncIndicator = false;
  syncInProgress = false;
  lastSyncTime: Date | null = null;
  isOnline = true;
  syncProgress = 0;
  private syncInterval: any;
  private progressInterval: any;

  constructor(
    private authService: AuthService,
    private syncService: SyncService
  ) {}

  async ngOnInit() {
    // Initial sync when app starts if user is authenticated and online
    if (this.authService.isAuthenticated() && this.authService.isOnline()) {
      // Use setTimeout to avoid potential timing issues
      setTimeout(() => {
        this.syncService.triggerSync('app_start');
      }, 1000);
    }

    // Monitor sync status for UI indicators
    this.monitorSyncStatus();
  }

  private monitorSyncStatus(): void {
    // Update UI every 2 seconds
    this.syncInterval = setInterval(() => {
      const syncInfo = this.syncService.getSyncInfo();
      
      this.showSyncIndicator = syncInfo.isOnline && syncInfo.isAuthenticated;
      this.isOnline = syncInfo.isOnline;
      this.lastSyncTime = syncInfo.lastSync;
      
      // Handle sync progress animation
      if (syncInfo.syncInProgress && !this.syncInProgress) {
        // Sync just started
        this.syncInProgress = true;
        this.startProgressAnimation();
      } else if (!syncInfo.syncInProgress && this.syncInProgress) {
        // Sync just finished
        this.syncInProgress = false;
        this.stopProgressAnimation();
        this.syncProgress = 100;
        // Reset progress after a delay
        setTimeout(() => {
          this.syncProgress = 0;
        }, 1000);
      }
      
      // Update last sync time
      this.lastSyncTime = syncInfo.lastSync;
    }, 2000);
  }

  private startProgressAnimation(): void {
    this.syncProgress = 0;
    this.progressInterval = setInterval(() => {
      if (this.syncProgress < 90) {
        // Simulate progress up to 90% (real progress would come from the actual sync)
        this.syncProgress += Math.random() * 15;
        if (this.syncProgress > 90) {
          this.syncProgress = 90;
        }
      }
    }, 500);
  }

  private stopProgressAnimation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    // Jump to 100% when sync completes
    this.syncProgress = 100;
  }

  ngOnDestroy(): void {
    // Clean up intervals when component is destroyed
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }
}