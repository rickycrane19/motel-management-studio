import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

/**
 * Barra de filtros: búsqueda con debounce + filtros proyectados + «Limpiar filtros».
 * `<rms-filter-bar placeholder="Buscar producto…" [search]="q" (searchChange)="store.search($event)">
 *    <rms-combobox filters …/> <button actions class="rms-btn …">Exportar</button></rms-filter-bar>`
 */
@Component({
  selector: 'rms-filter-bar',
  imports: [CazoIconComponent],
  template: `
    @if (searchable()) {
      <label class="rms-filter-bar__search">
        <rms-cazo-icon name="search" [size]="18" />
        <span class="rms-sr-only">{{ placeholder() }}</span>
        <input type="search" [placeholder]="placeholder()" [value]="term()" (input)="onInput($event)" (keydown.enter)="flush()" autocomplete="off" />
        @if (term()) {
          <button type="button" class="rms-filter-bar__clear-term" (click)="setTerm('')" aria-label="Borrar búsqueda">
            <rms-cazo-icon name="close" [size]="15" />
          </button>
        }
      </label>
    }
    <div class="rms-filter-bar__filters"><ng-content select="[filters]" /></div>
    @if (activeCount() > 0 || term()) {
      <button type="button" class="rms-btn rms-btn--ghost rms-btn--sm rms-filter-bar__reset" (click)="clearAll()">
        <rms-cazo-icon name="close" [size]="14" /> Limpiar filtros
      </button>
    }
    <div class="rms-filter-bar__actions"><ng-content select="[actions]" /></div>
  `,
  host: { class: 'rms-filter-bar' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBarComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly input$ = new Subject<string>();

  readonly placeholder = input('Buscar…');
  /** `false` en listas sin búsqueda de texto (solo filtros): oculta el cuadro. */
  readonly searchable = input(true);
  /** Valor inicial (p. ej. desde la URL). */
  readonly search = input('');
  readonly debounceMs = input(300);
  /** Nº de filtros aplicados además de la búsqueda (muestra «Limpiar filtros»). */
  readonly activeCount = input(0);
  readonly searchChange = output<string>();
  readonly cleared = output<void>();

  protected readonly term = signal('');
  private lastEmitted = '';

  constructor() {
    // Si quien usa la barra cambia la búsqueda por fuera (quitar una ficha de filtro, restablecer la vista), el cuadro la refleja.
    effect(() => {
      const external = this.search();
      untracked(() => {
        if (external.trim() === this.lastEmitted) return;
        this.term.set(external);
        this.lastEmitted = external.trim();
      });
    });
  }

  ngOnInit(): void {
    this.term.set(this.search());
    this.lastEmitted = this.search().trim();
    this.input$
      .pipe(debounceTime(this.debounceMs()), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.emit(value));
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.term.set(value);
    this.input$.next(value.trim());
  }

  protected flush(): void {
    this.emit(this.term().trim());
  }

  protected setTerm(value: string): void {
    this.term.set(value);
    this.emit(value.trim());
  }

  protected clearAll(): void {
    this.term.set('');
    this.lastEmitted = '';
    this.cleared.emit();
  }

  private emit(value: string): void {
    if (value === this.lastEmitted) return;
    this.lastEmitted = value;
    this.searchChange.emit(value);
  }
}
