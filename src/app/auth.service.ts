// auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';
import { environment } from 'src/environments/environment';

export interface User {
  id: string;
  email: string;
  name: string;
  mobile?: string;
  createdAt: Date;
  profileCompleted?: boolean;
  firebaseUid?: string;
  lastSynced?: Date;
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
  private readonly SYNC_STATUS_KEY = 'group-xpense-sync-status';
  
  private currentUserSubject = new BehaviorSubject<User | null>(this.getCurrentUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  // Firebase
  private firebaseApp = initializeApp(environment.firebaseConfig);
  private auth = getAuth(this.firebaseApp);
  private firestore = getFirestore(this.firebaseApp);

  constructor(private router: Router) {
    this.initializeAuthListener();
  }

  /**
   * Initialize Firebase auth state listener
   */
  private initializeAuthListener(): void {
    onAuthStateChanged(this.auth, (user) => {
      if (user && this.isOnline() && this.isAuthenticated()) {
        console.log('Auth state changed, user is signed in');
        // Note: Sync will be triggered by SyncService independently
      }
    });
  }

  // Check online status
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Signup method
  async signup(signupData: SignupData): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      setTimeout(async () => {
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

          let firebaseUid: string | undefined;

          // FIREBASE SYNC: Try to create user in Firebase if online
          if (this.isOnline()) {
            try {
              const userCredential = await createUserWithEmailAndPassword(
                this.auth, 
                signupData.email, 
                signupData.password
              );
              firebaseUid = userCredential.user.uid;

              // Generate local user ID first
              const localUserId = this.generateUUID();

              // Save user data to Firestore
              const userDoc = doc(this.firestore, 'users', firebaseUid);
              await setDoc(userDoc, {
                email: signupData.email.toLowerCase().trim(),
                name: signupData.name.trim(),
                mobile: signupData.mobile.trim(),
                createdAt: new Date(),
                profileCompleted: false,
                localUserId: localUserId,
                lastSynced: new Date()
              });

              console.log('User created in Firebase');

              // Create new user with UUID
              const user: User = {
                id: localUserId,
                email: signupData.email.toLowerCase().trim(),
                name: signupData.name.trim(),
                mobile: signupData.mobile.trim(),
                createdAt: new Date(),
                profileCompleted: false,
                firebaseUid: firebaseUid,
                lastSynced: new Date()
              };

              // Save user to localStorage
              this.saveUser(user, signupData.password);
              this.setUser(user);
              
              resolve({ success: true });
              return;

            } catch (firebaseError: any) {
              console.error('Firebase signup error:', firebaseError);
              // Continue with local signup even if Firebase fails
              if (firebaseError.code === 'auth/email-already-in-use') {
                resolve({ success: false, message: 'User with this email already exists' });
                return;
              }
            }
          }

          // Create new user with UUID - LOCAL ONLY (offline case)
          const user: User = {
            id: this.generateUUID(),
            email: signupData.email.toLowerCase().trim(),
            name: signupData.name.trim(),
            mobile: signupData.mobile.trim(),
            createdAt: new Date(),
            profileCompleted: false,
            firebaseUid: firebaseUid
          };

          // Save user to localStorage
          this.saveUser(user, signupData.password);
          this.setUser(user);
          
          // FIREBASE SYNC: Mark for data sync if online but Firebase user creation failed
          if (this.isOnline() && !firebaseUid) {
            this.setSyncStatus('pending');
          }
          
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
      setTimeout(async () => {
        try {
          let firebaseUser: any = null;
          const localUser = this.authenticateUser(email, password);
          
          // FIREBASE SYNC: Try Firebase login first if online
          if (this.isOnline()) {
            try {
              const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
              firebaseUser = userCredential.user;
              
              // Get user data from Firestore
              const userDoc = doc(this.firestore, 'users', firebaseUser.uid);
              const userSnapshot = await getDoc(userDoc);
              
              if (userSnapshot.exists()) {
                const userData = userSnapshot.data();
                
                // Create user object from Firebase data
                const user: User = {
                  id: userData['localUserId'] || this.generateUUID(),
                  firebaseUid: firebaseUser.uid,
                  email: userData['email'],
                  name: userData['name'],
                  mobile: userData['mobile'],
                  profileCompleted: userData['profileCompleted'] || false,
                  createdAt: userData['createdAt']?.toDate() || new Date(),
                  lastSynced: new Date()
                };
                
                // Save to localStorage (this will overwrite local user with same email)
                this.saveUser(user, password);
                this.setUser(user);
                
                resolve({ success: true });
                return;
              }
            } catch (firebaseError: any) {
              console.log('Firebase login failed:', firebaseError);
              
              // If Firebase fails but local login works, try to sync local user to Firebase
              if (localUser && (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password')) {
                try {
                  const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
                  firebaseUser = userCredential.user;
                  
                  // Update local user with Firebase UID
                  if (localUser) {
                    localUser.firebaseUid = firebaseUser.uid;
                    localUser.lastSynced = new Date();
                    
                    if (localUser.firebaseUid) {
                      this.updateUserFirebaseUid(localUser.id, localUser.firebaseUid);
                    }
                    
                    // Sync local user data to Firebase
                    await this.syncUserToFirebase(localUser);
                    
                    this.setUser(localUser);
                    
                    resolve({ success: true });
                    return;
                  }
                } catch (createError: any) {
                  console.error('Error creating Firebase user during login:', createError);
                  if (createError.code === 'auth/email-already-in-use') {
                    resolve({ success: false, message: 'Email already in use in Firebase' });
                    return;
                  }
                }
              }
            }
          }
          
          // Fallback to local authentication
          if (localUser) {
            this.setUser(localUser);
            
            // Mark for sync when online
            if (this.isOnline() && !localUser.firebaseUid) {
              this.setSyncStatus('pending');
              
              // Try to sync local user to Firebase in background
              setTimeout(async () => {
                try {
                  const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
                  if (localUser) {
                    localUser.firebaseUid = userCredential.user.uid;
                    localUser.lastSynced = new Date();
                    if (localUser.firebaseUid) {
                      this.updateUserFirebaseUid(localUser.id, localUser.firebaseUid);
                    }
                    await this.syncUserToFirebase(localUser);
                    console.log('Local user synced to Firebase in background');
                  }
                } catch (error) {
                  console.error('Background sync failed:', error);
                }
              }, 2000);
            }
            
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
  async completeUserProfile(userId: string, profileData: { name: string; mobile: string }): Promise<boolean> {
    try {
      const users = this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        // Update user data
        users[userIndex].name = profileData.name;
        users[userIndex].mobile = profileData.mobile;
        users[userIndex].profileCompleted = true;
        users[userIndex].lastSynced = new Date();
        
        // Save updated users
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        
        // Update current user
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
          currentUser.name = profileData.name;
          currentUser.mobile = profileData.mobile;
          currentUser.profileCompleted = true;
          currentUser.lastSynced = new Date();
          this.setUser(currentUser);

          // FIREBASE SYNC: Update Firebase if online
          if (this.isOnline() && currentUser.firebaseUid) {
            await this.syncUserToFirebase(currentUser);
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error completing user profile:', error);
      return false;
    }
  }

  // FIREBASE SYNC: Sync user data to Firebase
  private async syncUserToFirebase(user: User): Promise<void> {
    if (!this.isOnline() || !user.firebaseUid) return;

    try {
      const userDoc = doc(this.firestore, 'users', user.firebaseUid);
      await setDoc(userDoc, {
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
        localUserId: user.id,
        lastSynced: new Date()
      }, { merge: true });
      
      console.log('User data synced to Firebase');
      this.setSyncStatus('synced');
    } catch (error) {
      console.error('Error syncing user to Firebase:', error);
      this.setSyncStatus('error');
    }
  }

  // FIREBASE SYNC: Update user's Firebase UID in localStorage
  private updateUserFirebaseUid(userId: string, firebaseUid: string): void {
    try {
      const users = this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        users[userIndex].firebaseUid = firebaseUid;
        users[userIndex].lastSynced = new Date();
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        
        // Update current user if it's the same user
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
          currentUser.firebaseUid = firebaseUid;
          currentUser.lastSynced = new Date();
          this.setUser(currentUser);
        }
      }
    } catch (error) {
      console.error('Error updating Firebase UID:', error);
    }
  }

  // FIREBASE SYNC: Set sync status
  private setSyncStatus(status: 'pending' | 'synced' | 'error'): void {
    localStorage.setItem(this.SYNC_STATUS_KEY, status);
  }

  // FIREBASE SYNC: Get sync status
  getSyncStatus(): string {
    return localStorage.getItem(this.SYNC_STATUS_KEY) || 'synced';
  }

  // Logout method
  logout(): void {
    // FIREBASE SYNC: Sign out from Firebase if online
    if (this.isOnline()) {
      signOut(this.auth).catch(error => {
        console.error('Firebase logout error:', error);
      });
    }
    
    // Clear local storage
    localStorage.removeItem(this.AUTH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    
    // Clear any sync-related data
    this.setSyncStatus('synced');
    
    this.router.navigate(['/login']);
  }

  // Method to check if user needs Firebase sync
  needsFirebaseSync(): boolean {
    const currentUser = this.getCurrentUser();
    return !!(this.isOnline() && currentUser && !currentUser.firebaseUid);
  }

  // Method to manually sync user to Firebase
  async syncUserToFirebaseManually(): Promise<{ success: boolean; message: string }> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        return { success: false, message: 'No user logged in' };
      }

      if (!this.isOnline()) {
        return { success: false, message: 'No internet connection' };
      }

      if (currentUser.firebaseUid) {
        await this.syncUserToFirebase(currentUser);
        return { success: true, message: 'User data synced to Firebase' };
      } else {
        return { success: false, message: 'User not linked to Firebase account' };
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      return { success: false, message: 'Sync failed: ' + error };
    }
  }

  // ALL YOUR EXISTING METHODS REMAIN THE SAME BELOW THIS LINE
  // Check if user profile is complete
  isProfileComplete(user: User): boolean {
    return !!user.name && !!user.mobile && user.profileCompleted === true;
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
      // Convert lastSynced string back to Date object if exists
      if (user.lastSynced) {
        user.lastSynced = new Date(user.lastSynced);
      }
      return user;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
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
        createdAt: user.createdAt.toISOString(),
        lastSynced: user.lastSynced ? user.lastSynced.toISOString() : new Date().toISOString()
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
        const user: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          mobile: userData.mobile,
          profileCompleted: userData.profileCompleted,
          createdAt: new Date(userData.createdAt),
          firebaseUid: userData.firebaseUid
        };

        // Add lastSynced if it exists
        if (userData.lastSynced) {
          user.lastSynced = new Date(userData.lastSynced);
        }

        return user;
      }

      return null;
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }
}