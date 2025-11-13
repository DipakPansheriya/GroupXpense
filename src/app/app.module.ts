import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GroupListComponent } from './group-list/group-list.component';
import { ExpenseService } from './expense.service';
import { BalanceViewComponent } from './balance-view/balance-view.component';
import { LoginComponent } from './login/login.component';
import { CompleteProfileComponent } from './complete-profile/complete-profile.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { MemberViewComponent } from './member-view/member-view.component';

@NgModule({
  declarations: [
    AppComponent,
    GroupListComponent,
    BalanceViewComponent,
    LoginComponent,
    CompleteProfileComponent,
    MemberViewComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    ExpenseService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }