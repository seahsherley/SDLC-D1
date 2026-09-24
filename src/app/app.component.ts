import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LinksService, Link } from './links.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private linksService = inject(LinksService);

  title = 'snip-frontend';
  url = signal('');
  links = signal<Link[]>([]);
  lastCreated = signal<Link | null>(null);
  error = signal('');
  loading = signal(false);

  constructor() {
    this.loadLinks();
  }

  loadLinks() {
    this.linksService.getLinks().subscribe({
      next: (links) => this.links.set(links),
      error: () => this.error.set('Failed to load links from the server.'),
    });
  }

  isValidHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  submit() {
    this.error.set('');
    this.lastCreated.set(null);

    const value = this.url().trim();
    if (!this.isValidHttpUrl(value)) {
      this.error.set('Please enter a valid http:// or https:// URL.');
      return;
    }

    this.loading.set(true);
    this.linksService.createLink(value).subscribe({
      next: (link) => {
        this.loading.set(false);
        this.lastCreated.set(link);
        this.url.set('');
        this.loadLinks();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Something went wrong. Please try again.');
      },
    });
  }
}
