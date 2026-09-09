import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Item } from './item.model';
import { ItemsService } from './items.service';

@Component({
  selector: 'app-items',
  standalone: true,
  templateUrl: './items.component.html',
  styleUrl: './items.component.css',
})
export class ItemsComponent implements OnInit {
  private itemsService = inject(ItemsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  items = signal<Item[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  /* 
   * AWS: fetches items from Spring Boot's GET /api/items through CloudFront -> ALB -> Fargate in production; 
   * authInterceptor attaches the Cognito bearer token, and SecurityConfig on the backend validates it.
  */
  ngOnInit(): void {
    this.itemsService.getItems().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load items.');
        this.loading.set(false);
      },
    });
  }

  // Remove the user's tokens and redirect to the login page. The guard will then redirect to the login page if the user is not authenticated.
  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
