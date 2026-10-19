import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CazoIconComponent } from '../../../shared/ui';
import { NavGroup, visibleNavGroups } from '../navigation';

const COLLAPSED_KEY = 'rms.backoffice.sidebar.collapsed';
const NARROW_QUERY = '(max-width: 1000px)';

function readPreference(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

function savePreference(collapsed: boolean): void {
  try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

@Component({
  selector: 'rms-backoffice-sidebar',
  standalone: true,
  imports: [RouterLink, CazoIconComponent],
  templateUrl: './backoffice-sidebar.component.html',
  styleUrl: './backoffice-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackofficeSidebarComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaQuery = typeof matchMedia === 'function' ? matchMedia(NARROW_QUERY) : null;

  // Usamos signal directo en vez de toSignal() para evitar error de contexto NG0203
  protected readonly currentUrl = signal<string>(this.router.url.split('?')[0]);
  private readonly preferredCollapsed = signal<boolean>(readPreference());
  protected readonly narrow = signal<boolean>(this.mediaQuery?.matches ?? false);
  private readonly overlayOpen = signal<boolean>(false);

  protected readonly collapsed = computed(() => (this.narrow() ? !this.overlayOpen() : this.preferredCollapsed()));
  protected readonly overlayVisible = computed(() => this.narrow() && this.overlayOpen());

  protected readonly groups = computed<readonly NavGroup[]>(() => {
    const session = this.auth.session();
    return visibleNavGroups((permission) => this.auth.hasPermission(permission), {
      hasLocation: !!session?.user.locationId,
    });
  });

  private readonly activeEntry = computed(() => {
    const path = this.currentUrl();
    let best: { groupId: string; route: string } | null = null;
    for (const group of this.groups()) {
      for (const item of group.items) {
        if ((path === item.route || path.startsWith(`${item.route}/`)) && (!best || item.route.length > best.route.length)) {
          best = { groupId: group.id, route: item.route };
        }
      }
    }
    return best;
  });

  protected readonly activeGroupId = computed(() => this.activeEntry()?.groupId ?? null);
  protected readonly activeRoute = computed(() => this.activeEntry()?.route ?? null);

  private readonly openGroup = signal<string | null>(null);

  constructor() {
    const onChange = (event: MediaQueryListEvent) => {
      this.narrow.set(event.matches);
      this.overlayOpen.set(false);
    };
    this.mediaQuery?.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => this.mediaQuery?.removeEventListener('change', onChange));
  }

  ngOnInit(): void {
    const sub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects.split('?')[0]);
        this.overlayOpen.set(false);
      });

    this.destroyRef.onDestroy(() => sub.unsubscribe());

    // Inicializar grupo abierto
    const active = this.activeGroupId();
    if (active) {
      this.openGroup.set(active);
    }
  }

  protected isOpen(group: NavGroup): boolean {
    return this.openGroup() === group.id;
  }

  protected toggleGroup(group: NavGroup): void {
    this.openGroup.update((current) => (current === group.id ? null : group.id));
  }

  protected expandTo(group: NavGroup): void {
    this.openGroup.set(group.id);
    if (this.narrow()) this.overlayOpen.set(true);
    else this.setCollapsed(false);
  }

  protected toggleCollapsed(): void {
    if (this.narrow()) this.overlayOpen.update((open) => !open);
    else this.setCollapsed(!this.preferredCollapsed());
  }

  protected closeOverlay(): void {
    this.overlayOpen.set(false);
  }

  private setCollapsed(collapsed: boolean): void {
    this.preferredCollapsed.set(collapsed);
    savePreference(collapsed);
  }
}
