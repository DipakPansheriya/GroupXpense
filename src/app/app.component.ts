import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ExpenseService } from './expense.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  currentRoute: string = '';
  hasCurrentGroup: boolean = false;

  constructor(
    private router: Router,
    private expenseService: ExpenseService
  ) {
    // Track route changes
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        this.checkCurrentGroup();
      }
    });
  }

  // Check if there's a current group selected
  checkCurrentGroup(): void {
    const currentGroup = this.expenseService.getCurrentGroup();
    this.hasCurrentGroup = currentGroup !== null;
  }

  // Navigate to groups page
  navigateToGroups(): void {
    this.router.navigate(['/groups']);
  }

  // Navigate to balances page with validation
  navigateToBalances(): void {
    // Check if we have a current group
    const currentGroup = this.expenseService.getCurrentGroup();
    if (currentGroup) {
      this.router.navigate(['/balances']);
    } else {
      alert('Please select a group first to view reports');
      this.router.navigate(['/groups']);
    }
  }

  // Check if route is active (for styling)
  isActive(route: string): boolean {
    return this.currentRoute === route;
  }
}
