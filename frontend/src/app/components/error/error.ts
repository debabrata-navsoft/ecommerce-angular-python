import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [],
  templateUrl: './error.html',
  styleUrl: './error.css',
})
export class Error {
  @Input() message: string = 'Something went wrong!';
}
