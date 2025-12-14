import { Component } from '@angular/core';
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
}
