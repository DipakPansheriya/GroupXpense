import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BalanceViewComponent } from './balance-view/balance-view.component';
import { GroupListComponent } from './group-list/group-list.component';
import { LoginComponent } from './login/login.component';
import { CompleteProfileComponent } from './complete-profile/complete-profile.component';
import { MemberViewComponent } from './member-view/member-view.component';
import { AuthGuard } from './auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' }, 
  { path: 'login', component: LoginComponent },
  
  // Protected routes - require login
  { path: 'groups', component: GroupListComponent, canActivate: [AuthGuard] },
  { path: 'balances', component: BalanceViewComponent, canActivate: [AuthGuard] },
  { path: 'complete-profile', component: CompleteProfileComponent, canActivate: [AuthGuard] },
  
  // Public route - no login required (pass userId and groupId)
  { path: 'member-view/:userId/:groupId', component: MemberViewComponent }, 
  
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }