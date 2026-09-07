import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../core/config.service';
import { Item } from './item.model';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  getItems(): Observable<Item[]> {
    // AWS: reaches Spring Boot's GET /api/items through CloudFront -> ALB ->
    // Fargate in production; authInterceptor attaches the Cognito bearer
    // token, and SecurityConfig on the backend validates it.
    return this.http.get<Item[]>(`${this.config.get().apiBaseUrl}/items`);
  }
}
