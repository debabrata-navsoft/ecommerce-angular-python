import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-shipping-info',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shipping-info.html',
  styleUrl: './shipping-info.css',
})
export class ShippingInfo {}
