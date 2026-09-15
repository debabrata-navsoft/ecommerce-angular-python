import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
})
export class Highlight {
  constructor(private el: ElementRef) {}

  @HostListener('mouseenter')
  onMouseEnter() {
    this.el.nativeElement.style.boxShadow = '0 0 10px rgba(46, 47, 48, 0.59)';
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.el.nativeElement.style.boxShadow = 'none';
  }
}
