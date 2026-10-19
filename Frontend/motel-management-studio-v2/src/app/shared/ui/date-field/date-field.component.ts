import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/** `AAAA-MM-DD` → `dd/mm/aaaa` (formato de TODO V2; nunca el de EE. UU.). */
export function formatDateEs(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** `dd/mm/aaaa` → `AAAA-MM-DD`, o `null` si no es una fecha real. */
export function parseDateEs(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || year < 1900 || year > 2200) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface CalendarCell { readonly key: string; readonly day: number; readonly outside: boolean; readonly disabled: boolean; readonly today: boolean; }

/**
 * Selector de fecha en español: se escribe o se elige como dd/mm/aaaa (el navegador en inglés mostraría
 * mm/dd/aaaa). El valor del formulario es `AAAA-MM-DD`. `min` / `max` (AAAA-MM-DD) deshabilitan días.
 */
@Component({
  selector: 'rms-date-field',
  imports: [CazoIconComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateFieldComponent), multi: true }],
  template: `
    <div class="rms-date" [class.is-invalid]="invalidText()" [class.is-disabled]="disabled()">
      <input class="rms-date__input" type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="dd/mm/aaaa"
        [value]="text()" [disabled]="disabled()" [attr.aria-label]="ariaLabel() || null" [attr.aria-invalid]="invalidText() || null"
        (input)="onInput($event)" (blur)="commit()" (keydown.enter)="commit()" />
      <button type="button" class="rms-date__toggle" [disabled]="disabled()" [attr.aria-expanded]="open()" aria-label="Abrir calendario"
        (click)="toggle()"><rms-cazo-icon name="calendar" [size]="18" /></button>
      @if (open()) {
        <div class="rms-date__pop" role="dialog" aria-label="Elegir fecha">
          <div class="rms-date__nav">
            <button type="button" class="rms-icon-btn" (click)="shift(-1)" aria-label="Mes anterior"><rms-cazo-icon name="chevron-left" [size]="16" /></button>
            <strong>{{ monthLabel() }}</strong>
            <button type="button" class="rms-icon-btn" (click)="shift(1)" aria-label="Mes siguiente"><rms-cazo-icon name="chevron-right" [size]="16" /></button>
          </div>
          <div class="rms-date__grid" role="grid">
            @for (name of weekdays; track name) { <span class="rms-date__dow" aria-hidden="true">{{ name }}</span> }
            @for (cell of cells(); track cell.key) {
              <button type="button" class="rms-date__day" [class.is-outside]="cell.outside" [class.is-today]="cell.today"
                [class.is-selected]="cell.key === value()" [disabled]="cell.disabled" (click)="pick(cell.key)">{{ cell.day }}</button>
            }
          </div>
          <div class="rms-date__foot">
            <button type="button" class="rms-btn rms-btn--ghost rms-btn--sm" (click)="pick(todayKey)">Hoy</button>
            @if (clearable() && value()) { <button type="button" class="rms-btn rms-btn--ghost rms-btn--sm" (click)="clear()">Borrar</button> }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; position: relative; }
    .rms-date { position: relative; display: flex; align-items: center; background: var(--cazo-surface); border: 1px solid var(--cazo-line-strong);
      border-radius: var(--cazo-radius-md); transition: border-color .15s, box-shadow .15s; }
    .rms-date:focus-within { border-color: var(--cazo-brand); box-shadow: var(--cazo-focus-ring); }
    .rms-date.is-invalid { border-color: var(--cazo-danger); }
    .rms-date.is-disabled { background: var(--cazo-surface-sunken); opacity: .7; }
    .rms-date__input { flex: 1; min-width: 0; border: 0; background: transparent; padding: 11px 12px; color: var(--cazo-ink); font: inherit; outline: none; }
    .rms-date__toggle { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 0; background: transparent; color: var(--cazo-brand); cursor: pointer; border-radius: var(--cazo-radius-md); }
    .rms-date__toggle:hover:not(:disabled) { background: var(--cazo-soft); }
    .rms-date__pop { position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; width: 292px; padding: 12px; background: var(--cazo-surface-raised);
      border: 1px solid var(--cazo-line-strong); border-radius: var(--cazo-radius-lg); box-shadow: var(--cazo-shadow-raised); }
    .rms-date__nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; text-transform: capitalize; color: var(--cazo-ink); }
    .rms-date__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .rms-date__dow { text-align: center; font-size: 11px; color: var(--cazo-muted); padding: 4px 0; font-weight: 700; }
    .rms-date__day { height: 36px; border: 0; border-radius: var(--cazo-radius-sm); background: transparent; color: var(--cazo-ink); font: inherit; cursor: pointer; }
    .rms-date__day:hover:not(:disabled) { background: var(--cazo-soft); }
    .rms-date__day.is-outside { color: var(--cazo-muted); opacity: .55; }
    .rms-date__day.is-today { box-shadow: inset 0 0 0 1px var(--cazo-brand); }
    .rms-date__day.is-selected { background: var(--cazo-brand); color: var(--cazo-on-dark); font-weight: 700; }
    .rms-date__day:disabled { opacity: .3; cursor: not-allowed; }
    .rms-date__foot { display: flex; justify-content: space-between; margin-top: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateFieldComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly ariaLabel = input('');
  readonly clearable = input(false);

  protected readonly weekdays = WEEKDAYS;
  protected readonly value = signal<string>('');
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly invalidText = signal(false);
  protected readonly disabled = signal(false);
  private readonly viewYear = signal(new Date().getFullYear());
  private readonly viewMonth = signal(new Date().getMonth());
  protected readonly todayKey = toKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  protected readonly monthLabel = computed(() => `${MONTHS[this.viewMonth()]} de ${this.viewYear()}`);
  protected readonly cells = computed<readonly CalendarCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (first.getUTCDay() + 6) % 7; // semana desde el lunes
    const min = this.min();
    const max = this.max();
    const out: CalendarCell[] = [];
    for (let index = 0; index < 42; index++) {
      const date = new Date(Date.UTC(year, month, 1 - offset + index));
      const key = toKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      out.push({
        key, day: date.getUTCDate(), outside: date.getUTCMonth() !== month, today: key === this.todayKey,
        disabled: (min !== null && key < min) || (max !== null && key > max),
      });
    }
    return out;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const iso = /^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? (value as string).slice(0, 10) : '';
    this.value.set(iso);
    this.text.set(formatDateEs(iso));
    this.invalidText.set(false);
    if (iso) this.focusMonth(iso);
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  protected onInput(event: Event): void {
    const element = event.target as HTMLInputElement;
    const digits = element.value.replace(/[^\d]/g, '').slice(0, 8);
    let masked = digits;
    if (digits.length > 4) masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    element.value = masked;
    this.text.set(masked);
    this.invalidText.set(false);
    if (masked.length === 10) this.commit();
  }

  protected commit(): void {
    const text = this.text().trim();
    if (!text) { if (this.value()) this.update(''); this.invalidText.set(false); this.onTouched(); return; }
    const iso = parseDateEs(text);
    const min = this.min();
    const max = this.max();
    if (!iso || (min !== null && iso < min) || (max !== null && iso > max)) { this.invalidText.set(true); this.onTouched(); return; }
    this.invalidText.set(false);
    if (iso !== this.value()) this.update(iso);
    this.text.set(formatDateEs(iso));
    this.onTouched();
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (!this.open() && this.value()) this.focusMonth(this.value());
    this.open.update((value) => !value);
  }
  protected shift(delta: number): void {
    const date = new Date(Date.UTC(this.viewYear(), this.viewMonth() + delta, 1));
    this.viewYear.set(date.getUTCFullYear());
    this.viewMonth.set(date.getUTCMonth());
  }
  protected pick(key: string): void {
    this.update(key);
    this.text.set(formatDateEs(key));
    this.invalidText.set(false);
    this.open.set(false);
    this.onTouched();
  }
  protected clear(): void { this.update(''); this.text.set(''); this.open.set(false); }

  private update(iso: string): void { this.value.set(iso); this.onChange(iso); if (iso) this.focusMonth(iso); }
  private focusMonth(iso: string): void { this.viewYear.set(Number(iso.slice(0, 4))); this.viewMonth.set(Number(iso.slice(5, 7)) - 1); }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
  @HostListener('keydown.escape')
  protected onEscape(): void { this.open.set(false); }
}
