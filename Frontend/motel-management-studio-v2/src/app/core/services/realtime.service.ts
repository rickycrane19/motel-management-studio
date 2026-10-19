import { Injectable, inject } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private auth = inject(AuthService);
  private hubConnection: HubConnection | null = null;

  readonly roomsChanged$ = new Subject<{ action: string; data: any }>();
  readonly inventoryChanged$ = new Subject<{ action: string; data: any }>();
  readonly cashChanged$ = new Subject<{ action: string; data: any }>();

  init(): void {
    const token = this.auth.token();
    const hubUrl = `${environment.hubUrl}?access_token=${token || ''}`;

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    this.hubConnection.on('RoomsChanged', (event: any) => {
      this.roomsChanged$.next({ action: event.reason, data: event.payload });
    });

    this.hubConnection.on('StayChanged', (event: any) => {
      this.roomsChanged$.next({ action: event.reason, data: event.payload });
    });

    this.hubConnection.on('InventoryChanged', (event: any) => {
      this.inventoryChanged$.next({ action: event.reason, data: event.payload });
    });

    this.hubConnection.on('CashChanged', (event: any) => {
      this.cashChanged$.next({ action: event.reason, data: event.payload });
    });

    this.hubConnection.start()
      .then(() => console.log('SignalR connected to OperationalHub'))
      .catch(err => console.warn('SignalR connection failed (API may be offline):', err));
  }
}
