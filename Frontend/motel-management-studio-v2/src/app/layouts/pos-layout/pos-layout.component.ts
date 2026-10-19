import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';

@Component({
  selector: 'rms-pos-layout',
  imports: [DatePipe, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './pos-layout.component.html',
  styleUrl: './pos-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosLayoutComponent {
  @ViewChild('layoutRoot', { static: true }) private layoutRoot?: ElementRef<HTMLElement>;

  protected readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  protected readonly now = signal(new Date());
  protected readonly narrowNavigationOpen = signal(false);
  protected readonly currencyCode = computed(() => this.auth.session()?.user.currencyCode?.toUpperCase() ?? 'NIO');
  protected readonly operatorName = computed(() => this.auth.currentUser()?.fullName ?? 'Operador');
  protected readonly operatorInitials = computed(() => this.operatorName()
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const timer = window.setInterval(() => this.now.set(new Date()), 30_000);
    destroyRef.onDestroy(() => window.clearInterval(timer));
    this.realtime.init();
  }

  protected resetScrollPosition(): void {
    this.narrowNavigationOpen.set(false);
    const layout = this.layoutRoot?.nativeElement;
    if (!layout) return;
    layout.scrollTop = 0;
    layout.scrollLeft = 0;
  }

  protected closeNavigationOnLink(event: Event): void {
    if (event.target instanceof Element && event.target.closest('a')) this.narrowNavigationOpen.set(false);
  }

  protected dismissNavigation(): void {
    this.narrowNavigationOpen.set(false);
  }
}
