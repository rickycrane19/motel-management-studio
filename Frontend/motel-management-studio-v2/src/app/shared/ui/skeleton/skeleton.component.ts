import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'title' | 'block' | 'circle';

/** Marcador de carga con brillo suave (respeta prefers-reduced-motion). */
@Component({
  selector: 'rms-skeleton',
  template: `
    @for (line of rows(); track line) {
      <span class="rms-skeleton" [class]="'rms-skeleton rms-skeleton--' + variant()"
        [style.width]="line === rows().length - 1 && rows().length > 1 ? '62%' : width()"
        [style.height]="height()"></span>
    }
    <span class="rms-sr-only">Cargando…</span>
  `,
  host: { class: 'rms-skeleton-group', 'aria-busy': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('text');
  readonly lines = input(1);
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);

  protected readonly rows = computed(() => Array.from({ length: Math.max(1, this.lines()) }, (_, index) => index));
}
