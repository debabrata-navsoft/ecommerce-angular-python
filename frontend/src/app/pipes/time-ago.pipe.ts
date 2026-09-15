import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  pure: false,
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const seconds = Math.floor((new Date().getTime() - new Date(value).getTime()) / 1000);

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];

    for (const i of intervals) {
      const count = Math.floor(seconds / i.seconds);
      if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
    }

    return 'just now';
  }
}


  // transform(value: string | Date | null | undefined): string {
  //   if (!value) return '';

  //   const date = new Date(value);
  //   const now = new Date();
  //   const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  //   if (seconds < 60) return 'just now';
  //   if (seconds < 3600) {
  //     const mins = Math.floor(seconds / 60);
  //     return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  //   }
  //   if (seconds < 86400) {
  //     const hours = Math.floor(seconds / 3600);
  //     return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  //   }
  //   if (seconds < 2592000) {
  //     const days = Math.floor(seconds / 86400);
  //     return `${days} day${days > 1 ? 's' : ''} ago`;
  //   }
  //   if (seconds < 31104000) {
  //     const months = Math.floor(seconds / 2592000);
  //     return `${months} month${months > 1 ? 's' : ''} ago`;
  //   }
  //   const years = Math.floor(seconds / 31104000);
  //   return `${years} year${years > 1 ? 's' : ''} ago`;
  // }