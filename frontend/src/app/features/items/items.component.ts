import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Item } from './item.model';
import { ItemsService } from './items.service';

@Component({
  selector: 'app-items',
  standalone: true,
  template: `
    <div class="items-page">
      <header>
        <h1>Items</h1>
        <button type="button" (click)="logout()">Log out</button>
      </header>

      @if (loading()) {
        <p>Loading…</p>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <ul>
          @for (item of items(); track item.id) {
            <li>
              <strong>{{ item.name }}</strong>
              @if (item.description) {
                <span> — {{ item.description }}</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .items-page {
        max-width: 640px;
        margin: 2rem auto;
        font-family: system-ui, sans-serif;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .error {
        color: #b00020;
      }
      ul {
        padding-left: 1.2rem;
      }
      li {
        margin-bottom: 0.5rem;
      }
    `,
  ],
})
export class ItemsComponent implements OnInit {
  private itemsService = inject(ItemsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  items = signal<Item[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

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

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
