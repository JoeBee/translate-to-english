import { Component, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { TranslatorComponent } from './translator/translator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TranslatorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Translate to English';

  private swUpdate = inject(SwUpdate, { optional: true });
  private updateTimer: any = null;

  constructor() {
    if (!this.swUpdate || !this.swUpdate.isEnabled) return;

    // If a new version is available, activate it and reload automatically.
    this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') {
        const e = evt as VersionReadyEvent;
        console.log('[SW] New version ready:', e.latestVersion?.hash);
        this.swUpdate?.activateUpdate().then(() => document.location.reload());
      }
    });

    // Check once at startup, then periodically.
    this.swUpdate.checkForUpdate().catch(() => { /* ignore */ });
    this.updateTimer = setInterval(() => {
      this.swUpdate?.checkForUpdate().catch(() => { /* ignore */ });
    }, 60 * 60 * 1000); // hourly
  }

  ngOnDestroy(): void {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.updateTimer = null;
  }
}
