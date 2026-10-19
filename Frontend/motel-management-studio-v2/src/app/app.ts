import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogHostComponent } from './shared/ui/dialog/dialog-host.component';
import { ToastHostComponent } from './shared/ui/toast/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DialogHostComponent, ToastHostComponent],
  template: `
    <router-outlet />
    <rms-dialog-host />
    <rms-toast-host />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
