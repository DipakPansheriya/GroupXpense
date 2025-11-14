// complete-profile.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User, AuthService } from '../auth.service';

@Component({
  selector: 'app-complete-profile',
  templateUrl: './complete-profile.component.html',
  styleUrls: ['./complete-profile.component.scss']
})
export class CompleteProfileComponent {
  userData = {
    name: '',
    mobile: ''
  };
  
  loading = false;
  errorMessage = '';
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Pre-fill existing data
    if (this.currentUser.name) {
      this.userData.name = this.currentUser.name;
    }
    if (this.currentUser.mobile) {
      this.userData.mobile = this.currentUser.mobile;
    }

    // If profile is already complete, redirect to groups
    if (this.authService.isProfileComplete(this.currentUser)) {
      this.router.navigate(['/groups']);
    }
  }

  isValidForm(): boolean {
    return !!this.userData.name.trim() && this.isValidMobile(this.userData.mobile);
  }

  isValidMobile(mobile: string): boolean {
    const mobileRegex = /^[0-9]{10}$/;
    return mobileRegex.test(mobile);
  }

  // FIXED: Make this method async and properly handle the Promise
  async onSubmit(): Promise<void> {
    if (!this.isValidForm()) {
      this.errorMessage = 'Please enter valid name and 10-digit mobile number';
      return;
    }

    if (!this.currentUser) {
      this.errorMessage = 'User not found';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      // Update user profile - now properly awaiting the Promise
      const success = await this.authService.completeUserProfile(this.currentUser.id, {
        name: this.userData.name.trim(),
        mobile: this.userData.mobile.trim()
      });

      // FIXED: Now this condition works correctly with await
      if (success) {
        this.router.navigate(['/groups']);
      } else {
        this.errorMessage = 'Failed to update profile. Please try again.';
      }
    } catch (error) {
      this.errorMessage = 'An error occurred while updating profile. Please try again.';
      console.error('Profile update error:', error);
    } finally {
      this.loading = false;
    }
  }

  skipForNow(): void {
    this.router.navigate(['/groups']);
  }
}