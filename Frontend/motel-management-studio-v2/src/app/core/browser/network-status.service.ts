import { DestroyRef, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly onlineState = signal(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  readonly online = this.onlineState.asReadonly();

  constructor(destroyRef: DestroyRef) {
    if (typeof window === 'undefined') {
      return;
    }

    const updateOnline = () => this.onlineState.set(true);
    const updateOffline = () => this.onlineState.set(false);

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOffline);

    destroyRef.onDestroy(() => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOffline);
    });
  }
}

