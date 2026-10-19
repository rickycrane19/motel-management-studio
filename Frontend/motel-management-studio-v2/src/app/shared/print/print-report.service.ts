import { Injectable, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';

/** Par etiqueta/valor del encabezado del documento (rango, filtros aplicados, alcance…). */
export interface PrintReportMeta {
  readonly label: string;
  readonly value: string;
}

/** Opciones del documento imprimible. */
export interface PrintReportOptions {
  /** Título del reporte: encabeza el documento y el pie de página. */
  readonly title: string;
  /** Bajada opcional bajo el título. */
  readonly subtitle?: string;
  /** Rango, filtros y contexto del reporte (se listan bajo el título). */
  readonly meta?: readonly PrintReportMeta[];
  /** Contenedor del reporte (`#reportPrintArea`). Si es nulo no se imprime nada. */
  readonly element: HTMLElement | null;
  /** Tamaño del papel; `portrait` por defecto. */
  readonly orientation?: 'portrait' | 'landscape';
  /** Nombre del negocio; si no se pasa se toma de la sesión («El Rapidin»). */
  readonly tenantName?: string;
  /** Texto del pie; por defecto «<negocio> · <título>». */
  readonly footerNote?: string;
}

/** Contenedor del documento: se monta en `document.body`, fuera de `app-root`. */
const ROOT_CLASS = 'rms-print-root';
/** Regla `@page` que garantiza tamaño, orientación y márgenes del papel. */
const PAGE_RULE_ID = 'rms-print-page-rule';
/** Clase que marca «hay una impresión en curso» (la lee `print-report.scss`). */
const PRINTING_CLASS = 'rms-printing';
const MANAGUA_ZONE = 'America/Managua';
/**
 * Criterio de «qué no se imprime» (se quita del clon, no se oculta con CSS para que
 * también funcione sin la hoja global de impresión cargada):
 *  1. `[data-print="hide"]` — opt-out explícito de cada página (pestañas, filtros, botones…).
 *  2. `rms-filter-bar` — barra de filtros/rangos.
 *  3. `rms-pager` — paginación del listado.
 *  4. `rms-drawer` — paneles laterales de detalle.
 *  5. `rms-notice` — avisos de estado/error de la pantalla (su información se resume en `meta`).
 *  6. `a.rms-btn` — enlaces con aspecto de acción.
 *  7. `button` — controles interactivos; los de `thead` (ordenar) se reemplazan por su texto
 *     para no perder el nombre de la columna.
 */
const STRIPPED_SELECTORS = '[data-print="hide"], rms-filter-bar, rms-pager, rms-drawer, rms-notice, a.rms-btn';
/** Red de seguridad: si el diálogo nunca emite `afterprint`, se limpia el DOM igual. */
const SAFETY_CLEANUP_MS = 180_000;

/**
 * Exportación a PDF/imprimir de reportes sin dependencias: clona el contenedor imprimible dentro
 * de `.rms-print-root` (un hijo de `document.body`, fuera de la app), le inyecta el encabezado del
 * documento (negocio, título, rango/filtros, «Generado por … el …» en hora de Managua) y un pie que
 * se repite en cada página, espera el render y abre el diálogo de impresión del navegador
 * («Guardar como PDF»). El DOM se limpia solo al cerrar el diálogo (`afterprint`), sin residuos.
 *
 * La apariencia del documento vive en `src/app/shared/print/print-report.scss` (hoja global).
 */
@Injectable({ providedIn: 'root' })
export class PrintReportService {
  private readonly auth = inject(AuthService);

  private mounted: HTMLDivElement | null = null;
  private cleanup: (() => void) | null = null;
  private timer: number | null = null;

  /** Monta el documento, espera el render y abre el diálogo de impresión del navegador. */
  printReport(options: PrintReportOptions): void {
    const source = options.element ?? document.getElementById('reportPrintArea');
    if (!source) {
      console.warn('[PrintReportService] No hay contenido imprimible: falta el contenedor del reporte.');
      return;
    }
    this.dispose(); // una impresión anterior pudo dejar residuos si el diálogo no emitió `afterprint`.

    const session = this.auth.session();
    const tenant = options.tenantName ?? session?.user.tenantName ?? 'El Rapidin';
    const generatedBy = session?.user.fullName || session?.user.username || 'Usuario';
    const generatedAt = this.formatManagua(new Date());

    const root = document.createElement('div');
    root.className = ROOT_CLASS;
    root.setAttribute('aria-hidden', 'true');
    root.style.display = 'none'; // oculto en pantalla; el documento se muestra solo al imprimir
    root.append(
      this.buildHeader({ options, tenant, generatedBy, generatedAt }),
      this.buildBody(source),
      this.buildFooter({ options, tenant, generatedAt }),
    );

    document.body.appendChild(root);
    const pageRule = this.applyOrientation(options.orientation ?? 'portrait');
    const appRoot = document.querySelector<HTMLElement>('app-root');
    const previousDisplay = appRoot?.style.display ?? '';

    this.cleanup = (): void => {
      root.remove();
      pageRule.remove();
      if (appRoot) {
        if (previousDisplay) appRoot.style.display = previousDisplay;
        else appRoot.style.removeProperty('display');
      }
      document.body.classList.remove(PRINTING_CLASS);
      document.documentElement.classList.remove(PRINTING_CLASS);
    };
    this.mounted = root;
    window.addEventListener('afterprint', () => this.dispose(), { once: true });

    // Espera fuentes y un doble frame con la app todavía visible; luego oculta la app, muestra el
    // documento e imprime (window.print() bloquea hasta cerrar el diálogo, así no hay destello).
    void this.whenRendered().then(() => {
      if (this.mounted !== root) return; // se limpió antes de imprimir
      if (appRoot) appRoot.style.display = 'none';
      root.style.display = 'block';
      document.body.classList.add(PRINTING_CLASS);
      document.documentElement.classList.add(PRINTING_CLASS);
      this.timer = window.setTimeout(() => this.dispose(), SAFETY_CLEANUP_MS);
      window.print();
    });
  }

  /** Retira el documento y restaura la app. Idempotente: se puede llamar siempre. */
  dispose(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    const cleanup = this.cleanup;
    this.cleanup = null;
    this.mounted = null;
    cleanup?.();
  }

  private buildHeader(input: {
    options: PrintReportOptions;
    tenant: string;
    generatedBy: string;
    generatedAt: string;
  }): HTMLElement {
    const head = element('header', 'rms-print-head');
    const brand = element('div', 'rms-print-head__brand');
    brand.append(
      element('span', 'rms-print-head__biz', input.tenant),
      element('h1', 'rms-print-head__title', input.options.title),
    );
    if (input.options.subtitle) brand.append(element('p', 'rms-print-head__subtitle', input.options.subtitle));
    head.append(brand);

    const meta = input.options.meta ?? [];
    if (meta.length) {
      const list = element('dl', 'rms-print-head__meta');
      for (const item of meta) {
        const row = element('div', 'rms-print-head__meta-row');
        row.append(element('dt', '', item.label), element('dd', '', item.value));
        list.append(row);
      }
      head.append(list);
    }
    head.append(element('p', 'rms-print-head__generated', `Generado por ${input.generatedBy} el ${input.generatedAt}`));
    return head;
  }

  /** Clona el contenedor del reporte y le quita lo que no pertenece a un documento. */
  private buildBody(source: HTMLElement): HTMLElement {
    const body = element('div', 'rms-print-body');
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id'); // evita ids duplicados con la página original

    for (const node of clone.querySelectorAll(STRIPPED_SELECTORS)) node.remove();
    for (const button of Array.from(clone.querySelectorAll('button'))) {
      if (button.closest('thead')) button.replaceWith(...Array.from(button.childNodes));
      else button.remove();
    }

    body.append(clone);
    return body;
  }

  private buildFooter(input: { options: PrintReportOptions; tenant: string; generatedAt: string }): HTMLElement {
    const foot = element('footer', 'rms-print-foot');
    foot.append(
      element('span', 'rms-print-foot__note', input.options.footerNote ?? `${input.tenant} · ${input.options.title}`),
      element('span', 'rms-print-foot__stamp', `Generado el ${input.generatedAt}`),
    );
    return foot;
  }

  /**
   * `@page` (tamaño A4, orientación y márgenes) se inyecta también aquí para que la geometría del
   * papel no dependa de que `styles.scss` importe ya `print-report.scss`. `print-report.scss` la
   * declara igual como parte de la hoja global.
   */
  private applyOrientation(orientation: 'portrait' | 'landscape'): HTMLStyleElement {
    const style = document.createElement('style');
    style.id = PAGE_RULE_ID;
    style.textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`;
    document.head.appendChild(style);
    return style;
  }

  /** Espera fuentes y render (tablas ya pintadas) con un tope, para no colgar la impresión. */
  private whenRendered(): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = (): void => {
        if (settled) return;
        settled = true;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      };
      if (document.fonts) document.fonts.ready.then(done, done);
      else done();
      window.setTimeout(done, 400);
    });
  }

  /** Fecha y hora legibles en la zona del negocio (America/Managua). */
  private formatManagua(date: Date): string {
    return new Intl.DateTimeFormat('es-NI', {
      timeZone: MANAGUA_ZONE,
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
