// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (this.authService.isAuthenticated()) {
      return true; // Allow access to protected routes
    } else {
      // Redirect to login page with return URL
      const returnUrl = route.url.map(segment => segment.path).join('/') || 'groups';
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return false; // Block access
    }
  }
}