import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

export interface ComboboxOption<V = unknown> {
  readonly value: V;
  readonly label: string;
  readonly hint?: string | null;
  readonly disabled?: boolean;
}

/** Búsqueda en servidor: recibe el texto escrito y devuelve opciones (idealmente un SP paginado). */
export type ComboboxLoader<V = unknown> = (term: string) => Observable<readonly ComboboxOption<V>[]>;

let nextId = 0;

/**
 * Selector buscable (RT-04): nadie escribe un ID. Funciona con `formControlName`/`ngModel`.
 * - Local: `[options]="suppliers()"` (filtra mientras escribes, sin tildes ni mayúsculas).
 * - Servidor: `[loader]="searchSuppliers"` (debounce + cancelación); usa `[selectedOptions]` para
 *   mostrar la etiqueta de un valor ya guardado al editar.
 * - `multiple`: valor = arreglo; las elecciones se muestran como fichas.
 */
@Component({
  selector: 'rms-combobox',
  imports: [CazoIconComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ComboboxComponent), multi: true }],
  template: `
    <div class="rms-combobox__control" [class.is-open]="open()" [class.is-disabled]="isDisabled()" (click)="focusInput()">
      @if (multiple()) {
        @for (option of selectedList(); track $index) {
          <span class="rms-combobox__chip">
            {{ option.label }}
            @if (!isDisabled()) {
              <span role="button" class="rms-combobox__chip-remove" (mousedown)="$event.preventDefault()" (click)="remove(option, $event)" [attr.aria-label]="'Quitar ' + option.label">
                <rms-cazo-icon name="close" [size]="12" />
              </span>
            }
          </span>
        }
      }
      <input #inputEl class="rms-combobox__input" type="text" role="combobox" autocomplete="off" spellcheck="false"
        [id]="inputId()" [attr.aria-label]="ariaLabel()" [attr.aria-expanded]="open()" [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="activeDescendant()" aria-autocomplete="list" [attr.aria-invalid]="invalid() || null"
        [placeholder]="placeholderText()" [value]="inputText()" [disabled]="isDisabled()"
        (input)="onInput($event)" (focus)="onFocus()" (click)="onInputClick()" (blur)="onBlur()" (keydown)="onKeydown($event)" />
      @if (busy()) { <span class="rms-combobox__spinner" aria-hidden="true"></span> }
      @if (clearable() && hasValue() && !isDisabled()) {
        <span role="button" class="rms-combobox__clear" (mousedown)="$event.preventDefault()" (click)="clear($event)" aria-label="Quitar selección">
          <rms-cazo-icon name="close" [size]="14" />
        </span>
      }
      <span class="rms-combobox__chevron" aria-hidden="true"><rms-cazo-icon name="chevron-down" [size]="16" /></span>
    </div>
    <ul #listEl class="rms-combobox__list" popover="manual" role="listbox" [id]="listId" [attr.aria-multiselectable]="multiple() || null"
      [attr.aria-label]="ariaLabel() ?? 'Opciones'">
      @if (busy() && visibleOptions().length === 0) {
        <li class="rms-combobox__status">Buscando…</li>
      } @else if (loadError()) {
        <li class="rms-combobox__status rms-combobox__status--error">{{ loadError() }}</li>
      } @else if (needsMoreText()) {
        <li class="rms-combobox__status">Escribe al menos {{ minChars() }} letras para buscar</li>
      } @else if (visibleOptions().length === 0) {
        <li class="rms-combobox__status">{{ emptyText() }}</li>
      }
      @for (option of visibleOptions(); track $index; let index = $index) {
        <li role="option" class="rms-combobox__option" [id]="listId + '-' + index" [class.is-active]="index === activeIndex()"
          [attr.aria-selected]="isSelected(option)" [attr.aria-disabled]="option.disabled || null"
          (mousedown)="$event.preventDefault()" (click)="choose(option)" (mouseenter)="activeIndex.set(index)">
          <span><strong>{{ option.label }}</strong>@if (option.hint) { <small>{{ option.hint }}</small> }</span>
          @if (isSelected(option)) { <rms-cazo-icon name="check" [size]="15" /> }
        </li>
      }
    </ul>
  `,
  host: { class: 'rms-combobox', '[class.rms-combobox--multiple]': 'multiple()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboboxComponent<V = unknown> implements ControlValueAccessor, OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');
  private readonly listRef = viewChild.required<ElementRef<HTMLUListElement>>('listEl');
  private readonly search$ = new Subject<string>();

  readonly options = input<readonly ComboboxOption<V>[]>([]);
  readonly loader = input<ComboboxLoader<V> | null>(null);
  readonly selectedOptions = input<readonly ComboboxOption<V>[]>([]);
  readonly placeholder = input('Escribe para buscar…');
  readonly emptyText = input('No encontramos coincidencias');
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(`rms-combobox-${nextId++}`);
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly clearable = input(true, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly minChars = input(0);
  readonly debounceMs = input(250);
  readonly compareWith = input<(left: V, right: V) => boolean>((left, right) => left === right);
  readonly optionSelected = output<ComboboxOption<V> | null>();

  protected readonly listId = `rms-combobox-list-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly term = signal('');
  protected readonly editing = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly remoteOptions = signal<readonly ComboboxOption<V>[]>([]);
  protected readonly remoteLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  private readonly value = signal<V | readonly V[] | null>(null);
  private readonly formDisabled = signal(false);
  private readonly labelCache = signal<readonly ComboboxOption<V>[]>([]);
  private onChange: (value: V | V[] | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private readonly reposition = () => this.positionList();

  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  protected readonly busy = computed(() => this.loading() || this.remoteLoading());
  protected readonly needsMoreText = computed(() => !!this.loader() && this.term().trim().length < this.minChars());
  protected readonly knownOptions = computed(() => [...this.selectedOptions(), ...this.labelCache(), ...this.options(), ...this.remoteOptions()]);
  protected readonly visibleOptions = computed(() => {
    if (this.loader()) return this.needsMoreText() ? [] : this.remoteOptions();
    const needle = normalize(this.editing() ? this.term() : '');
    return needle ? this.options().filter((option) => normalize(`${option.label} ${option.hint ?? ''}`).includes(needle)) : this.options();
  });
  protected readonly selectedList = computed<readonly ComboboxOption<V>[]>(() => {
    const value = this.value();
    const values = Array.isArray(value) ? (value as readonly V[]) : value === null || value === undefined ? [] : [value as V];
    const list: ComboboxOption<V>[] = [];
    for (const item of values) {
      const known = this.findOption(item);
      if (known) { list.push(known); continue; }
      // '' y 0 son los «sin elegir» habituales de los formularios: no cuentan como una selección.
      if ((item as unknown) === '' || (item as unknown) === 0) continue;
      list.push({ value: item, label: 'Elemento seleccionado' });
    }
    return list;
  });
  protected readonly hasValue = computed(() => this.selectedList().length > 0);
  protected readonly inputText = computed(() => {
    if (this.multiple() || this.editing()) return this.term();
    return this.selectedList()[0]?.label ?? '';
  });
  protected readonly placeholderText = computed(() =>
    this.multiple() && this.hasValue() ? 'Agregar otro…' : this.editing() && this.selectedList()[0] && !this.multiple()
      ? this.selectedList()[0].label : this.placeholder());
  protected readonly activeDescendant = computed(() => (this.open() && this.activeIndex() >= 0 ? `${this.listId}-${this.activeIndex()}` : null));

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(this.debounceMs()),
        switchMap((term) => {
          const loader = this.loader();
          if (!loader || term.trim().length < this.minChars()) return of<readonly ComboboxOption<V>[]>([]);
          this.remoteLoading.set(true);
          this.loadError.set(null);
          return loader(term.trim()).pipe(
            map((options) => options ?? []),
            catchError(() => {
              this.loadError.set('No pudimos buscar en este momento. Revisa la conexión e inténtalo de nuevo.');
              return of<readonly ComboboxOption<V>[]>([]);
            }),
            tap(() => this.remoteLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((options) => {
        this.remoteOptions.set(options);
        this.activeIndex.set(options.length ? 0 : -1);
      });
    this.destroyRef.onDestroy(() => this.detachListeners());
  }

  writeValue(value: V | readonly V[] | null): void {
    this.value.set(value ?? (this.multiple() ? [] : null));
  }

  registerOnChange(fn: (value: V | V[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  protected focusInput(): void {
    if (!this.isDisabled()) this.inputRef().nativeElement.focus();
  }

  protected onFocus(): void {
    this.openList();
  }

  /**
   * Un clic sobre el campo reabre la lista aunque ya tenga el foco. Se ignora el clic sintético que un `<label>` envía al
   * campo cuando se elige una opción (la lista está dentro del label), para que la lista no se reabra sola.
   */
  private justChose = false;
  protected onInputClick(): void {
    if (!this.justChose) this.openList();
  }

  protected onBlur(): void {
    this.closeList();
    this.onTouched();
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.term.set(text);
    this.editing.set(true);
    this.openList();
    this.activeIndex.set(this.visibleOptions().length ? 0 : -1);
    if (this.loader()) this.search$.next(text);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.visibleOptions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.openList();
        this.activeIndex.set(options.length ? (this.activeIndex() + 1) % options.length : -1);
        this.scrollActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(options.length ? (this.activeIndex() - 1 + options.length) % options.length : -1);
        this.scrollActive();
        break;
      case 'Enter':
        if (this.open() && this.activeIndex() >= 0 && options[this.activeIndex()]) {
          event.preventDefault();
          this.choose(options[this.activeIndex()]);
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation();
          this.closeList();
        }
        break;
      case 'Backspace':
        if (this.multiple() && !this.term() && this.selectedList().length) this.remove(this.selectedList()[this.selectedList().length - 1]);
        break;
    }
  }

  protected isSelected(option: ComboboxOption<V>): boolean {
    return this.selectedList().some((selected) => this.compareWith()(selected.value, option.value));
  }

  protected choose(option: ComboboxOption<V>): void {
    if (option.disabled) return;
    this.remember(option);
    if (this.multiple()) {
      const current = this.selectedList().map((item) => item.value);
      const next = this.isSelected(option)
        ? current.filter((item) => !this.compareWith()(item, option.value))
        : [...current, option.value];
      this.commit(next);
      this.term.set('');
      this.editing.set(false);
    } else {
      this.commit(option.value);
      this.term.set('');
      this.editing.set(false);
      this.closeList();
      this.justChose = true;
      setTimeout(() => { this.justChose = false; });
    }
    this.optionSelected.emit(option);
  }

  protected remove(option: ComboboxOption<V>, event?: Event): void {
    event?.stopPropagation();
    const next = this.selectedList().map((item) => item.value).filter((item) => !this.compareWith()(item, option.value));
    this.commit(next);
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.term.set('');
    this.commit(this.multiple() ? [] : null);
    this.optionSelected.emit(null);
    this.focusInput();
  }

  private commit(value: V | V[] | null): void {
    this.value.set(value);
    this.onChange(value);
  }

  private remember(option: ComboboxOption<V>): void {
    if (!this.labelCache().some((item) => this.compareWith()(item.value, option.value))) {
      this.labelCache.update((cache) => [...cache.slice(-49), option]);
    }
  }

  private findOption(value: V): ComboboxOption<V> | undefined {
    return this.knownOptions().find((option) => this.compareWith()(option.value, value));
  }

  private openList(): void {
    if (this.isDisabled() || this.open()) return;
    this.open.set(true);
    const list = this.listRef().nativeElement;
    if (!list.matches(':popover-open')) list.showPopover();
    this.positionList();
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
    if (this.loader() && this.remoteOptions().length === 0 && !this.needsMoreText()) this.search$.next(this.term());
    const selectedIndex = this.visibleOptions().findIndex((option) => this.isSelected(option));
    this.activeIndex.set(selectedIndex >= 0 ? selectedIndex : this.visibleOptions().length ? 0 : -1);
  }

  private closeList(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.editing.set(false);
    this.term.set('');
    const list = this.listRef().nativeElement;
    if (list.matches(':popover-open')) list.hidePopover();
    this.detachListeners();
  }

  private detachListeners(): void {
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }

  private positionList(): void {
    const control = this.host.nativeElement.querySelector('.rms-combobox__control');
    const list = this.listRef().nativeElement;
    if (!control) return;
    const rect = control.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const openUp = below < 240 && rect.top > below;
    list.style.left = `${Math.round(rect.left)}px`;
    list.style.width = `${Math.round(rect.width)}px`;
    list.style.top = openUp ? 'auto' : `${Math.round(rect.bottom + 6)}px`;
    list.style.bottom = openUp ? `${Math.round(window.innerHeight - rect.top + 6)}px` : 'auto';
    list.style.maxHeight = `${Math.max(160, Math.min(320, (openUp ? rect.top : below) - 16))}px`;
  }

  private scrollActive(): void {
    queueMicrotask(() => this.listRef().nativeElement.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }));
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
