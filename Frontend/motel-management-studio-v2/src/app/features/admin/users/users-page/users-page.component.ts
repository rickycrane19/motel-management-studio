import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { SystemUser, SystemUserUpsert } from '../../../../core/models/security/user.model';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DrawerComponent,
  FieldComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { UsersStore } from '../users.store';

const ROLE_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: 'Admin', label: 'Administrador', hint: 'Acceso total al motel y a la seguridad.' },
  { value: 'Receptionist', label: 'Recepción', hint: 'Habitaciones, reservas y caja.' },
  { value: 'Cashier', label: 'Cajero', hint: 'Cobros, caja y movimientos.' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  receptionist: 'Recepción',
  cashier: 'Cajero',
};

function initialsOf(user: SystemUser): string {
  const source = user.fullName || user.username;
  return source.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

/**
 * Usuarios del sistema: alta, edición de la ficha, contraseña y activación.
 * El listado se pagina en el servidor y las tarjetas salen de los contadores
 * del mismo SP. Un usuario no puede desactivar su propia cuenta.
 */
@Component({
  selector: 'rms-users-page',
  imports: [
    ReactiveFormsModule, DatePipe, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DrawerComponent, FieldComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent,
    PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [UsersStore],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(UsersStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);

  protected readonly selected = signal<SystemUser | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly pageSizes = [10, 20, 50] as const;

  protected readonly canView = computed(() => this.session.hasPermission('security:view'));
  protected readonly canManage = computed(() => this.session.hasPermission('security:manage'));
  protected readonly visibleWithFilters = computed(() => this.store.activeFilterCount() > 0);
  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly roleFilterControl = new FormControl<string | null>(null);

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'user', label: 'Usuario' },
    { key: 'contact', label: 'Correo' },
    { key: 'role', label: 'Perfil', width: '170px' },
    { key: 'since', label: 'Registrado', width: '150px' },
    { key: 'status', label: 'Estado', width: '120px' },
    { key: 'actions', label: '', width: '110px' },
  ];
  protected readonly trackUser = (row: SystemUser, _index: number): number => row.userId;
  protected readonly initialsOf = initialsOf;

  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(100),
      Validators.pattern('^[a-zA-Z0-9._-]+$'),
    ]],
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    role: ['Receptionist', Validators.required],
    password: [''],
    confirmPassword: [''],
  });

  ngOnInit(): void {
    if (!this.canView()) return;
    this.roleFilterControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => this.store.applyFilters({ role }));
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ search: term ?? '' });
  }

  protected clearFilters(): void {
    this.roleFilterControl.setValue(null, { emitEvent: false });
    this.store.resetFilters();
  }

  protected open(user: SystemUser): void {
    this.selected.set(user);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.saveError.set(null);
    this.form.reset({
      username: '',
      fullName: '',
      email: '',
      role: 'Receptionist',
      password: '',
      confirmPassword: '',
    });
    this.formOpen.set(true);
  }

  protected openEdit(user: SystemUser): void {
    this.editingId.set(user.userId);
    this.saveError.set(null);
    this.selected.set(null);
    this.form.reset({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      password: '',
      confirmPassword: '',
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    if (this.store.saving()) return;
    this.formOpen.set(false);
    this.saveError.set(null);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.saving()) return;

    const value = this.form.getRawValue();
    const isCreate = this.editingId() === null;
    const password = value.password;
    const confirmPassword = value.confirmPassword;

    if (isCreate && password.length < 6) {
      this.saveError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!isCreate && password.length > 0 && password.length < 6) {
      this.saveError.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      this.saveError.set('La confirmación no coincide con la contraseña.');
      return;
    }

    const payload: SystemUserUpsert = {
      username: value.username.trim(),
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      role: value.role.trim(),
      password: password.length > 0 ? password : null,
    };

    this.saveError.set(null);
    this.store.save(payload, this.editingId()).subscribe((saved) => {
      if (!saved) {
        this.saveError.set(this.store.errorMessage() ?? 'No pudimos guardar el usuario.');
        return;
      }
      this.toast.success(isCreate ? 'Usuario creado' : 'Usuario actualizado', payload.username);
      this.formOpen.set(false);
      this.store.load({ pageNumber: isCreate ? 1 : this.store.query().pageNumber });
    });
  }

  protected toggleActive(user: SystemUser, event: Event): void {
    event.stopPropagation();
    if (!this.canManage()) return;
    this.store.setActive(user, !user.isActive).subscribe((changed) => {
      if (!changed) {
        this.toast.error('No pudimos cambiar el estado', this.store.errorMessage() ?? undefined);
        return;
      }
      this.toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado', user.username);
      this.selected.update((current) => current && current.userId === user.userId
        ? { ...current, isActive: !user.isActive }
        : current);
      this.store.load({ pageNumber: this.store.query().pageNumber });
    });
  }

  protected isCurrentUser(user: SystemUser): boolean {
    return this.session.session()?.user.userId === user.userId;
  }

  protected roleLabel(role: string): string {
    const clean = role.trim();
    if (!clean) return '—';
    return ROLE_LABELS[clean.toLowerCase()] ?? clean;
  }
}
