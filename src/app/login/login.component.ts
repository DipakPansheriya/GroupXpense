// login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

interface UserData {
  email: string;
  password: string;
  name?: string;
  mobile?: string;
  confirmPassword?: string;
  rememberMe?: boolean;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  isSignupMode = false;
  userData: UserData = {
    email: '',
    password: '',
    name: '',
    mobile: '',
    confirmPassword: '',
    rememberMe: false
  };

  showPassword = false;
  showConfirmPassword = false;
  loading = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  // Set mode (login/signup)
  setMode(isSignup: boolean): void {
    this.isSignupMode = isSignup;
    this.errorMessage = '';
    // Reset form data when switching modes
    this.userData = {
      email: '',
      password: '',
      name: isSignup ? '' : undefined,
      mobile: isSignup ? '' : undefined,
      confirmPassword: isSignup ? '' : undefined,
      rememberMe: false
    };
    this.showPassword = false;
    this.showConfirmPassword = false;
  }

  // Check if form is invalid
  isFormInvalid(): boolean {
    if (this.isSignupMode) {
      return !this.userData.email?.trim() || 
             !this.userData.password || 
             !this.userData.name?.trim() || 
             !this.userData.mobile?.trim() ||
             !this.userData.confirmPassword ||
             this.userData.password.length < 6 ||
             this.userData.password !== this.userData.confirmPassword ||
             !this.isValidMobile(this.userData.mobile);
    } else {
      return !this.userData.email?.trim() || !this.userData.password;
    }
  }

  // Validate mobile number
  isValidMobile(mobile: string): boolean {
    const mobileRegex = /^[0-9]{10}$/;
    return mobileRegex.test(mobile);
  }

  // Login method
  async onLogin(): Promise<void> {
    if (this.isFormInvalid()) {
      this.errorMessage = 'Please enter valid email and password';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const result = await this.authService.login(
        this.userData.email.trim(), 
        this.userData.password
      );
      
      if (result.success) {
        // Check if user profile is complete
        const currentUser = this.authService.getCurrentUser();
        if (currentUser && this.authService.isProfileComplete(currentUser)) {
          this.router.navigate(['/groups']);
        } else {
          this.router.navigate(['/complete-profile']);
        }
      } else {
        this.errorMessage = result.message || 'Login failed. Please try again.';
      }
    } catch (error) {
      this.errorMessage = 'An error occurred. Please try again.';
      console.error('Login error:', error);
    } finally {
      this.loading = false;
    }
  }

  // Signup method
  async onSignup(): Promise<void> {
    if (this.isFormInvalid()) {
      if (!this.userData.name?.trim()) {
        this.errorMessage = 'Please enter your name';
      } else if (!this.userData.mobile?.trim()) {
        this.errorMessage = 'Please enter your mobile number';
      } else if (!this.isValidMobile(this.userData.mobile)) {
        this.errorMessage = 'Please enter a valid 10-digit mobile number';
      } else if (this.userData.password.length < 6) {
        this.errorMessage = 'Password must be at least 6 characters long';
      } else if (this.userData.password !== this.userData.confirmPassword) {
        this.errorMessage = 'Passwords do not match';
      } else {
        this.errorMessage = 'Please fill all required fields correctly';
      }
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const result = await this.authService.signup({
        email: this.userData.email.trim(),
        password: this.userData.password,
        name: this.userData.name!.trim(),
        mobile: this.userData.mobile!.trim(),
        confirmPassword: this.userData.confirmPassword!
      });

      if (result.success) {
        // Redirect to complete profile page for additional info
        this.router.navigate(['/complete-profile']);
      } else {
        this.errorMessage = result.message || 'Signup failed. Please try again.';
      }
    } catch (error) {
      this.errorMessage = 'An error occurred. Please try again.';
      console.error('Signup error:', error);
    } finally {
      this.loading = false;
    }
  }

  // Demo account
  useDemoAccount(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Set demo credentials
    this.userData = {
      email: 'demo@groupxpense.com',
      password: 'demo123',
      rememberMe: true
    };
    
    // Auto-login after filling demo credentials
    setTimeout(() => {
      this.onLogin();
    }, 500);
  }
}