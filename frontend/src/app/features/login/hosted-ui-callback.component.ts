import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-hosted-ui-callback',
  standalone: true,
  templateUrl: './hosted-ui-callback.component.html',
})
export class HostedUiCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // AWS: Cognito Hosted UI redirects back here with query param `code` (Authorization Code + PKCE)
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.error.set('Missing authorization code');
      return;
    }
    try {
      // AWS: handle the authorization code and exchange it for tokens to finish login process
      await this.authService.handleHostedUiCallback(code);
      this.router.navigateByUrl('/items');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Hosted UI login failed');
    }
  }
}
