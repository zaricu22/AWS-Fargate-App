import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <h1>Log in</h1>

      <!-- Default login path: custom Angular form, calls Cognito directly. -->
      <form (ngSubmit)="submit()">
        <label>
          Email
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
          />
        </label>
        <button type="submit" [disabled]="submitting()">Log in</button>
      </form>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <hr />

      <!-- Secondary login path: Cognito Hosted UI with PKCE. -->
      <button type="button" (click)="loginWithHostedUi()">Sign in with Hosted UI</button>
    </div>
  `,
  styles: [
    `
      .login-page {
        max-width: 320px;
        margin: 3rem auto;
        font-family: system-ui, sans-serif;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
      }
      .error {
        color: #b00020;
      }
    `,
  ],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  submitting = signal(false);
  error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.authService.loginWithPassword(this.email, this.password);
      this.router.navigateByUrl('/items');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Login failed');
    } finally {
      this.submitting.set(false);
    }
  }

  async loginWithHostedUi(): Promise<void> {
    await this.authService.startHostedUiLogin();
  }
}
