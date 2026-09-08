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
