import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CazoIconName =
  | 'alert'
  | 'arrow-left'
  | 'arrow-right'
  | 'chart'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-up'
  | 'filter'
  | 'home'
  | 'image'
  | 'logout'
  | 'menu'
  | 'refresh'
  | 'shield'
  | 'sparkles'
  | 'trend-down'
  | 'trend-up'
  | 'upload'
  | 'barcode'
  | 'bed'
  | 'bell'
  | 'bike'
  | 'calendar'
  | 'card'
  | 'cash'
  | 'check'
  | 'chef'
  | 'chevron-right'
  | 'clock'
  | 'close'
  | 'dashboard'
  | 'download'
  | 'drawer'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'grid'
  | 'info'
  | 'layers'
  | 'lock'
  | 'map-pin'
  | 'minus'
  | 'more'
  | 'note'
  | 'orders'
  | 'package'
  | 'palette'
  | 'phone'
  | 'plus'
  | 'printer'
  | 'receipt'
  | 'search'
  | 'settings'
  | 'star'
  | 'store'
  | 'swap'
  | 'table'
  | 'tag'
  | 'takeaway'
  | 'trash'
  | 'truck'
  | 'users'
  | 'user'
  | 'utensils'
  | 'wifi-off'
  | 'maximize'
  | 'minimize'
  | 'play'
  | 'volume'
  | 'volume-off'
  | 'wallet'
  | 'percent'
  | 'coins';

@Component({
  selector: 'rms-cazo-icon',
  template: `
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      [style.width.px]="size()"
      [style.height.px]="size()"
    >
      @switch (name()) {
        @case ('alert') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5M12 16h.01" /> }
        @case ('info') { <circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /> }
        @case ('arrow-right') { <path d="M4 12h15M13 6l6 6-6 6" /> }
        @case ('arrow-left') { <path d="M20 12H5M11 6l-6 6 6 6" /> }
        @case ('chevron-left') { <path d="m15 5-7 7 7 7" /> }
        @case ('chevron-down') { <path d="m5 9 7 7 7-7" /> }
        @case ('chevron-up') { <path d="m5 15 7-7 7 7" /> }
        @case ('chart') { <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> }
        @case ('trend-up') { <path d="m3 17 6-6 4 4 8-8M15 7h6v6" /> }
        @case ('trend-down') { <path d="m3 7 6 6 4-4 8 8M15 17h6v-6" /> }
        @case ('filter') { <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" /> }
        @case ('home') { <path d="m3 11 9-7 9 7M5 10v10h14V10M10 20v-6h4v6" /> }
        @case ('image') { <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /> }
        @case ('upload') { <path d="M12 16V4M7 9l5-5 5 5M4 20h16" /> }
        @case ('logout') { <path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" /> }
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16" /> }
        @case ('refresh') { <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" /> }
        @case ('shield') { <path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /> }
        @case ('sparkles') { <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /> }
        @case ('wifi-off') { <path d="m3 3 18 18M8.5 8.5A8.5 8.5 0 0 0 3.5 12M15.5 8.5A8.5 8.5 0 0 1 20.5 12M12 17h.01" /> }
        @case ('store') { <path d="M3 10h18M5 10v10h14V10M4 10l1-6h14l1 6M9 20v-6h6v6" /> }
        @case ('orders') { <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /> }
        @case ('receipt') { <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h4" /> }
        @case ('chef') { <path d="M7 10a4 4 0 0 1 1-7 4 4 0 0 1 8 0 4 4 0 0 1 1 7v8H7v-8ZM7 14h10" /> }
        @case ('table') { <path d="M4 9h16M6 9v10M18 9v10M8 5h8v4" /> }
        @case ('user') { <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /> }
        @case ('settings') { <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /> }
        @case ('maximize') { <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /> }
        @case ('minimize') { <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> }
        @case ('play') { <path d="M7 4.5v15l12-7.5-12-7.5Z" /> }
        @case ('volume') { <path d="M4 10v4h4l5 4V6L8 10H4Z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" /> }
        @case ('volume-off') { <path d="M4 10v4h4l5 4V6L8 10H4Z" /><path d="m17 9 4 6M21 9l-4 6" /> }
        @case ('wallet') { <path d="M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7Zm0 0 3-3h11v3" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" /> }
        @case ('utensils') { <path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M16 3v18M16 3c3 2 4 5 4 8h-4" /> }
        @case ('takeaway') { <path d="M6 8h12l-1 13H7L6 8Zm2-4h8l2 4H6l2-4Z" /> }
        @case ('bike') { <circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="m6 17 4-8 3 8m-5-4h7l-3-6h3" /> }
        @case ('swap') { <path d="m7 7-3 3 3 3M4 10h14M17 17l3-3-3-3M20 14H6" /> }
        @case ('search') { <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /> }
        @case ('barcode') { <path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14" /> }
        @case ('bed') { <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /> }
        @case ('tag') { <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('minus') { <path d="M5 12h14" /> }
        @case ('trash') { <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /> }
        @case ('note') { <path d="M5 3h14v18H5V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /> }
        @case ('truck') { <path d="M3 6h11v11H3V6Zm11 4h3.4L20 13.2V17h-6v-7Z" /><circle cx="7" cy="18.5" r="1.6" /><circle cx="17" cy="18.5" r="1.6" /> }
        @case ('chevron-right') { <path d="m9 5 7 7-7 7" /> }
        @case ('card') { <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /> }
        @case ('cash') { <rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 9H5v2M17 15h2v-2" /> }
        @case ('layers') { <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /> }
        @case ('lock') { <rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /> }
        @case ('palette') { <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4.5A4.5 4.5 0 0 0 21 8.5 5.5 5.5 0 0 0 15.5 3H12Z" /><circle cx="7.5" cy="9" r=".7" fill="currentColor" stroke="none" /><circle cx="10" cy="6.5" r=".7" fill="currentColor" stroke="none" /><circle cx="14" cy="6.5" r=".7" fill="currentColor" stroke="none" /> }
        @case ('phone') { <rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 6h4M11 18h2" /> }
        @case ('printer') { <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7v-7Z" /> }
        @case ('drawer') { <path d="M4 8h16v11H4V8Zm2-5h12l2 5H4l2-5Z" /><path d="M9 13h6" /> }
        @case ('check') { <path d="m5 12 4 4L19 6" /> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18" /> }
        @case ('clock') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /> }
        @case ('bell') { <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /> }
        @case ('dashboard') { <path d="M4 13a8 8 0 1 1 16 0v7H4v-7Z" /><path d="m12 13 4-4M8 17h8" /> }
        @case ('download') { <path d="M12 3v12M7 10l5 5 5-5M4 21h16" /> }
        @case ('edit') { <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" /> }
        @case ('eye') { <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /> }
        @case ('eye-off') { <path d="m3 3 18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.3 3M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" /> }
        @case ('grid') { <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /> }
        @case ('map-pin') { <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /> }
        @case ('more') { <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /> }
        @case ('package') { <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /> }
        @case ('star') { <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" /> }
        @case ('users') { <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5" /> }
        @case ('percent') { <circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /><path d="M19 5 5 19" /> }
        @case ('coins') { <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-grid; flex: 0 0 auto; place-items: center; line-height: 0; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CazoIconComponent {
  readonly name = input.required<CazoIconName>();
  readonly size = input(20);
}
