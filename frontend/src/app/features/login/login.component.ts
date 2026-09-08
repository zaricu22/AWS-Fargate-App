import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
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
