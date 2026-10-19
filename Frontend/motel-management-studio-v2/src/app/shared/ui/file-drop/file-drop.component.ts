import { booleanAttribute, ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

/**
 * Carga de archivo con arrastrar/soltar, clic o teclado y vista previa (sin input nativo visible).
 * Valida tipo y tamaño en el navegador; el servidor vuelve a validar al guardar.
 * `<rms-file-drop [previewUrl]="preview()" (fileSelected)="onFile($event)" (removed)="removeImage()" />`
 */
@Component({
  selector: 'rms-file-drop',
  imports: [CazoIconComponent],
  template: `
    <div class="rms-file-drop__zone" role="button" [attr.tabindex]="disabled() ? -1 : 0" [attr.aria-disabled]="disabled() || null"
      [attr.aria-label]="previewUrl() ? 'Cambiar ' + subject() : label()" [class.is-dragging]="dragging()" [class.has-preview]="!!previewUrl()"
      (click)="pick($event)" (keydown.enter)="pick($event)" (keydown.space)="pick($event)"
      (dragenter)="onDrag($event, true)" (dragover)="onDrag($event, true)" (dragleave)="onDrag($event, false)" (drop)="onDrop($event)">
      @if (previewUrl(); as url) {
        <img [src]="url" [alt]="previewAlt()" />
        <span class="rms-file-drop__overlay"><rms-cazo-icon name="upload" [size]="18" /> Cambiar {{ subject() }}</span>
      } @else {
        <span class="rms-file-drop__icon" aria-hidden="true"><rms-cazo-icon [name]="dragging() ? 'upload' : 'image'" [size]="26" /></span>
        <strong>{{ dragging() ? 'Suelta el archivo aquí' : label() }}</strong>
        <small>{{ hint() }}</small>
      }
      <input #fileInput class="rms-sr-only" type="file" tabindex="-1" aria-hidden="true" [accept]="accept()" [disabled]="disabled()" (change)="onChange($event)" />
    </div>
    @if (error()) { <small class="rms-field__error" role="alert">{{ error() }}</small> }
    @if (previewUrl() && !disabled() && removable()) {
      <button type="button" class="rms-btn rms-btn--ghost rms-btn--sm rms-file-drop__remove" (click)="removed.emit()">
        <rms-cazo-icon name="trash" [size]="14" /> Quitar {{ subject() }}
      </button>
    }
  `,
  host: { class: 'rms-file-drop' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropComponent {
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  readonly accept = input('image/jpeg,image/png,image/webp');
  readonly maxSizeMb = input(5);
  readonly previewUrl = input<string | null>(null);
  readonly previewAlt = input('Vista previa');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly removable = input(true, { transform: booleanAttribute });
  readonly subject = input('imagen');
  readonly label = input('Arrastra una imagen o haz clic para elegirla');
  readonly hint = input('JPEG, PNG o WebP · hasta 5 MB');
  readonly fileSelected = output<File>();
  readonly removed = output<void>();
  readonly rejected = output<string>();

  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly accepted = computed(() => this.accept().split(',').map((type) => type.trim().toLowerCase()).filter(Boolean));

  protected pick(event?: Event): void {
    event?.preventDefault();
    if (!this.disabled()) this.fileInput().nativeElement.click();
  }

  protected onDrag(event: DragEvent, over: boolean): void {
    event.preventDefault();
    if (!this.disabled()) this.dragging.set(over);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.item(0);
    if (file) this.handle(file);
  }

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (file) this.handle(file);
  }

  private handle(file: File): void {
    const types = this.accepted();
    if (types.length && !types.some((type) => (type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type))) {
      this.reject('Ese formato no es compatible. Usa ' + this.hint().split('·')[0].trim() + '.');
      return;
    }
    if (file.size === 0 || file.size > this.maxSizeMb() * 1024 * 1024) {
      this.reject(`El archivo debe pesar menos de ${this.maxSizeMb()} MB.`);
      return;
    }
    this.error.set(null);
    this.fileSelected.emit(file);
  }

  private reject(message: string): void {
    this.error.set(message);
    this.rejected.emit(message);
  }
}
