// auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export interface User {
  id: string;
  email: string;
  name: string;
  mobile?: string;
  createdAt: Date;
  profileCompleted?: boolean;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  mobile: string;
  confirmPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_KEY = 'group-xpense-auth';
  private readonly USER_KEY = 'group-xpense-user';
  private readonly USERS_KEY = 'group-xpense-users';
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getCurrentUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private router: Router) {
    // Initialize demo user if no users exist
    // this.initializeDemoUser();
  }

  // Signup method
  async signup(signupData: SignupData): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          // Validation
          if (!this.isValidEmail(signupData.email)) {
            resolve({ success: false, message: 'Please enter a valid email address' });
            return;
          }

          if (!this.isValidMobile(signupData.mobile)) {
            resolve({ success: false, message: 'Please enter a valid 10-digit mobile number' });
            return;
          }

          if (signupData.password.length < 6) {
            resolve({ success: false, message: 'Password must be at least 6 characters long' });
            return;
          }

          if (signupData.password !== signupData.confirmPassword) {
            resolve({ success: false, message: 'Passwords do not match' });
            return;
          }

          if (!signupData.name.trim()) {
            resolve({ success: false, message: 'Please enter your name' });
            return;
          }

          // Check if user already exists
          if (this.userExists(signupData.email)) {
            resolve({ success: false, message: 'User with this email already exists' });
            return;
          }

          // Create new user with UUID
          const user: User = {
            id: this.generateUUID(),
            email: signupData.email.toLowerCase().trim(),
            name: signupData.name.trim(),
            mobile: signupData.mobile.trim(),
            createdAt: new Date(),
            profileCompleted: false // Profile not completed yet
          };

          // Save user to localStorage
          this.saveUser(user, signupData.password);
          this.setUser(user);
          
          resolve({ success: true });
        } catch (error) {
          console.error('Signup error:', error);
          resolve({ success: false, message: 'An error occurred during signup' });
        }
      }, 1000);
    });
  }

  // Login method
  async login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const user = this.authenticateUser(email, password);
          
          if (user) {
            this.setUser(user);
            resolve({ success: true });
          } else {
            resolve({ success: false, message: 'Invalid email or password' });
          }
        } catch (error) {
          console.error('Login error:', error);
          resolve({ success: false, message: 'An error occurred during login' });
        }
      }, 1000);
    });
  }

  // Complete user profile
  completeUserProfile(userId: string, profileData: { name: string; mobile: string }): boolean {
    try {
      const users = this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        // Update user data
        users[userIndex].name = profileData.name;
        users[userIndex].mobile = profileData.mobile;
        users[userIndex].profileCompleted = true;
        
        // Save updated users
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        
        // Update current user
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
          currentUser.name = profileData.name;
          currentUser.mobile = profileData.mobile;
          currentUser.profileCompleted = true;
          this.setUser(currentUser);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error completing user profile:', error);
      return false;
    }
  }

  // Check if user profile is complete
  isProfileComplete(user: User): boolean {
    return !!user.name && !!user.mobile && user.profileCompleted === true;
  }

  // Logout method
  logout(): void {
    localStorage.removeItem(this.AUTH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.getCurrentUserFromStorage();
  }

  // Get current user ID
  getCurrentUserId(): string | null {
    const user = this.getCurrentUserFromStorage();
    return user ? user.id : null;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getCurrentUserFromStorage();
  }

  // Private methods
  private setUser(user: User): void {
    localStorage.setItem(this.AUTH_KEY, 'true');
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private getCurrentUserFromStorage(): User | null {
    try {
      const userData = localStorage.getItem(this.USER_KEY);
      if (!userData) return null;
      
      const user = JSON.parse(userData);
      // Convert createdAt string back to Date object
      if (user.createdAt) {
        user.createdAt = new Date(user.createdAt);
      }
      return user;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  private initializeDemoUser(): void {
    const users = this.getAllUsers();
    if (users.length === 0) {
      const demoUser: User = {
        id: 'demo-user-uuid',
        email: 'demo@groupxpense.com',
        name: 'Demo User',
        mobile: '9876543210',
        createdAt: new Date(),
        profileCompleted: true
      };
      this.saveUser(demoUser, 'demo123');
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidMobile(mobile: string): boolean {
    const mobileRegex = /^[0-9]{10}$/;
    return mobileRegex.test(mobile);
  }

  private userExists(email: string): boolean {
    const users = this.getAllUsers();
    return users.some(user => user.email.toLowerCase() === email.toLowerCase());
  }

  private getAllUsers(): any[] {
    try {
      const usersData = localStorage.getItem(this.USERS_KEY);
      return usersData ? JSON.parse(usersData) : [];
    } catch (error) {
      console.error('Error reading users data:', error);
      return [];
    }
  }

  private saveUser(user: User, password: string): void {
    try {
      const users = this.getAllUsers();
      
      // Remove existing user with same email to avoid duplicates
      const filteredUsers = users.filter(u => u.email.toLowerCase() !== user.email.toLowerCase());
      
      const userWithPassword = {
        ...user,
        password: password,
        createdAt: user.createdAt.toISOString()
      };
      
      filteredUsers.push(userWithPassword);
      localStorage.setItem(this.USERS_KEY, JSON.stringify(filteredUsers));
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }

  private authenticateUser(email: string, password: string): User | null {
    try {
      const users = this.getAllUsers();
      const userData = users.find(user => 
        user.email.toLowerCase() === email.toLowerCase() && 
        user.password === password
      );

      if (userData) {
        return {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          mobile: userData.mobile,
          profileCompleted: userData.profileCompleted,
          createdAt: new Date(userData.createdAt)
        };
      }

      return null;
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }
}