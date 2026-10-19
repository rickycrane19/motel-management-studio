import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type FieldSpan = '1' | '2' | 'full';

function hostClass(base: string, error: string | null | undefined, span: FieldSpan): string {
  return [base, error ? `${base}--invalid` : '', `rms-field--span-${span}`].filter(Boolean).join(' ');
}

/**
 * Campo de formulario con etiqueta, ayuda y error en lenguaje claro.
 * `<rms-field label="Nombre" required [error]="nameError()" hint="Lo verá el cliente"><input formControlName="name" /></rms-field>`
 * `span="2"` o `span="full"` ocupa columnas en una `.rms-form-grid`.
 */
@Component({
  selector: 'rms-field',
  template: `
    <label class="rms-field__wrap">
      <span class="rms-field__label">{{ label() }}@if (required()) { <b aria-hidden="true"> *</b> }@if (optional()) { <em>Opcional</em> }</span>
      <span class="rms-field__control"><ng-content /></span>
    </label>
    @if (error()) {
      <small class="rms-field__error" role="alert">{{ error() }}</small>
    } @else if (hint()) {
      <small class="rms-field__hint">{{ hint() }}</small>
    }
  `,
  host: { '[class]': 'classes()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null | undefined>(null);
  readonly required = input(false, { transform: booleanAttribute });
  readonly optional = input(false, { transform: booleanAttribute });
  readonly span = input<FieldSpan>('1');

  protected readonly classes = computed(() => hostClass('rms-field', this.error(), this.span()));
}

/** Grupo de opciones (radios, interruptores, casillas) con leyenda: `<rms-field-group label="Canales">…</rms-field-group>`. */
@Component({
  selector: 'rms-field-group',
  template: `
    <fieldset class="rms-field__group">
      <legend class="rms-field__label">{{ label() }}@if (required()) { <b aria-hidden="true"> *</b> }@if (optional()) { <em>Opcional</em> }</legend>
      <div class="rms-field__control"><ng-content /></div>
    </fieldset>
    @if (error()) {
      <small class="rms-field__error" role="alert">{{ error() }}</small>
    } @else if (hint()) {
      <small class="rms-field__hint">{{ hint() }}</small>
    }
  `,
  host: { '[class]': 'classes()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldGroupComponent {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null | undefined>(null);
  readonly required = input(false, { transform: booleanAttribute });
  readonly optional = input(false, { transform: booleanAttribute });
  readonly span = input<FieldSpan>('full');

  protected readonly classes = computed(() => hostClass('rms-field', this.error(), this.span()));
}
