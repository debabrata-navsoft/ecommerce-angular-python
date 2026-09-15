import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.css',
})
export class ContactPage {
  contact = {
    name: '',
    email: '',
    message: '',
  };

  submitted = signal(false);

  submitForm() {
    console.log('Form Data:', this.contact);
    this.submitted.set(true);

    this.contact = { name: '', email: '', message: '' };
  }
}
