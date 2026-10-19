import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BackofficeHeaderComponent } from './header/backoffice-header.component';
import { BackofficeSidebarComponent } from './sidebar/backoffice-sidebar.component';

@Component({
  selector: 'rms-backoffice-layout',
  imports: [RouterOutlet, BackofficeHeaderComponent, BackofficeSidebarComponent],
  templateUrl: './backoffice-layout.component.html',
  styleUrl: './backoffice-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackofficeLayoutComponent {}
