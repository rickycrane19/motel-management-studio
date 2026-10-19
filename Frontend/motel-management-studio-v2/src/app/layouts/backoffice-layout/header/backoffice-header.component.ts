import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize, map } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { NavItem, normalizeSearch, visibleNavGroups } from '../navigation';

interface SearchOption {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
  readonly route: string;
  readonly queryParams?: Record<string, string>;
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPERADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  RECEPTION: 'Recepción',
  HOUSEKEEPING: 'Limpieza',
  INVENTORY: 'Inventario',
  HR: 'Recursos humanos',
};

const SUGGESTED = ['service.rooms', 'service.stay-types', 'inventory.products', 'finance.cashbox', 'service.fine-types', 'hr.employees'];

@Component({
  selector: 'rms-backoffice-header',
  imports: [],
  templateUrl: './backoffice-header.component.html',
  styleUrl: './backoffice-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackofficeHeaderComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  protected readonly loggingOut = signal(false);
  protected readonly logoutError = signal('');
  protected readonly query = signal('');
  protected readonly searchOpen = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly routeUrl = signal<string>(this.router.url);

  private readonly navItems = computed<readonly NavItem[]>(() =>
    visibleNavGroups((permission) => this.auth.hasPermission(permission), {
      hasLocation: !!this.auth.session()?.user.locationId,
    }).flatMap((group) => group.items),
  );

  protected readonly pageContext = computed(() => {
    const path = this.routeUrl().split('?')[0];
    const item = this.navItems()
      .filter((candidate) => path === candidate.route || path.startsWith(`${candidate.route}/`))
      .sort((left, right) => right.route.length - left.route.length)[0];
    if (item) return { group: item.groupId === 'panel' ? '' : item.groupLabel, label: item.label };
    if (path.startsWith('/admin')) return { group: 'Administración', label: 'Catálogos' };
    return { group: '', label: 'El Rapidin' };
  });

  protected readonly options = computed<readonly SearchOption[]>(() => {
    const term = normalizeSearch(this.query());
    const items = this.navItems();
    const toOption = (item: NavItem): SearchOption => ({
      key: item.route,
      label: item.label,
      hint: item.groupId === 'panel' ? 'Inicio' : item.groupLabel,
      icon: item.icon,
      route: item.route,
    });
    if (!term) {
      return SUGGESTED.map((id) => items.find((item) => item.featureId === id)).filter((item): item is NavItem => !!item).map(toOption);
    }
    const matches = items
      .map((item) => {
        const label = normalizeSearch(item.label);
        const rank = label.startsWith(term) ? 0 : label.includes(term) ? 1
          : normalizeSearch(item.groupLabel).includes(term) ? 2
            : normalizeSearch(item.keywords ?? '').includes(term) ? 3 : -1;
        return { item, rank };
      })
      .filter((entry) => entry.rank >= 0)
      .sort((left, right) => left.rank - right.rank)
      .slice(0, 7)
      .map((entry) => toOption(entry.item));
    return matches;
  });

  protected readonly roleLabel = computed(() => {
    const user = this.auth.session()?.user;
    const code = user?.role ?? '';
    return ROLE_LABELS[code.toUpperCase()] ?? (code ? code.replace(/[_-]+/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : 'Equipo');
  });

  protected readonly locationName = computed(() => {
    const current = this.auth.session()?.user;
    return current?.tenantName ?? 'El Rapidin';
  });

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.routeUrl.set(event.urlAfterRedirects);
      });
  }

  @HostListener('document:keydown', ['$event'])
  protected onShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
      this.searchInput()?.nativeElement.select();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (this.searchOpen() && target && !(this.searchInput()?.nativeElement.closest('.global-search')?.contains(target))) {
      this.closeSearch();
    }
  }

  protected onSearchInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.searchOpen.set(true);
  }

  protected openSearch(): void {
    this.searchOpen.set(true);
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.activeIndex.set(0);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const total = this.options().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.searchOpen.set(true);
      this.activeIndex.update((index) => (total ? (index + 1) % total : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => (total ? (index - 1 + total) % total : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.options()[this.activeIndex()];
      if (option) this.go(option);
    } else if (event.key === 'Escape') {
      this.closeSearch();
      this.searchInput()?.nativeElement.blur();
    }
  }

  protected go(option: SearchOption): void {
    this.closeSearch();
    this.query.set('');
    this.searchInput()?.nativeElement.blur();
    void this.router.navigate([option.route], option.queryParams ? { queryParams: option.queryParams } : undefined);
  }

  protected canSwitchLocation(): boolean {
    return false; // Single location for motel
  }

  protected logout(): void {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);
    this.logoutError.set('');
    this.auth.logout();
    this.loggingOut.set(false);
    void this.router.navigateByUrl('/login');
  }

  protected userName(): string {
    return this.auth.session()?.user.fullName ?? 'Usuario';
  }

  protected avatarInitials(): string {
    const initials = this.userName()
      .trim()
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
    return initials || 'U';
  }
}
