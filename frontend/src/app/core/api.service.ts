import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Starts a request immediately while keeping it subscribable.
 *
 * HttpClient observables are **cold**: nothing is sent until someone subscribes. The
 * Firestore code this replaced was eager — `from(setDoc(...))` had already started the
 * write by the time the observable existed — so callers written against it treat
 * `service.doThing()` as "it happened" and never subscribe. Under a cold observable those
 * calls silently do nothing, which is how an optimistic signal update could show a
 * wishlist item that was never persisted and vanished on refresh.
 *
 * `shareReplay` with `refCount: false` keeps the single in-flight request alive and
 * replays its result, so a caller that *does* subscribe (or subscribes late) still gets
 * the response without triggering a second request.
 *
 * Use this for fire-and-forget mutations. Leave reads, and flows whose caller always
 * subscribes (login, signup), cold.
 */
export function fireAndShare<T>(request: Observable<T>): Observable<T> {
  const shared = request.pipe(shareReplay({ bufferSize: 1, refCount: false }));

  // Kick it off now. The handler here only stops an unsubscribed failure from surfacing
  // as an unhandled rejection; real subscribers still receive the error.
  shared.subscribe({ error: () => undefined });

  return shared;
}

/**
 * Thin HttpClient wrapper: prefixes the API base URL, carries the session, and turns the
 * API's `{ message, details }` error envelope into a plain Error.
 *
 * In the browser the session rides on an httpOnly cookie, so `withCredentials` is all
 * that is needed — there is no token for the app to attach by hand.
 *
 * During SSR there is no cookie jar, so the incoming request's `Cookie` header is
 * forwarded explicitly. Without this the server render is always anonymous, and a page
 * refresh shows a logged-in user as logged out until the browser re-checks.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  /** The inbound SSR request; null in the browser. Provided by @angular/ssr. */
  private serverRequest = inject(REQUEST, { optional: true });

  readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * `environment.apiUrl` may be relative (`/api`). A relative URL cannot be fetched from
   * the server, so during SSR it is resolved against the origin of the incoming request.
   */
  private get baseUrl(): string {
    const base = environment.apiUrl;
    if (this.isBrowser || /^https?:\/\//i.test(base)) return base;

    const origin = this.serverRequest ? new URL(this.serverRequest.url).origin : '';
    return `${origin}${base}`;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /** Forwards the visitor's cookie on server-side calls; a no-op in the browser. */
  private get options() {
    const cookie = this.isBrowser ? null : this.serverRequest?.headers.get('cookie');

    return {
      withCredentials: true,
      ...(cookie ? { headers: { cookie } } : {}),
    };
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;

    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<T>(this.url(path), { ...this.options, params: this.toParams(params) })
      .pipe(catchError(handleError));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(this.url(path), body ?? {}, this.options)
      .pipe(catchError(handleError));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .patch<T>(this.url(path), body ?? {}, this.options)
      .pipe(catchError(handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path), this.options).pipe(catchError(handleError));
  }
}

function handleError(err: HttpErrorResponse) {
  const details = err.error?.['details'];
  const message =
    err.error?.['message'] ??
    (err.status === 0 ? 'Cannot reach the server. Is the API running?' : err.message);

  const error = new Error(message) as Error & { status?: number; details?: unknown };
  error.status = err.status;
  if (details) error.details = details;

  return throwError(() => error);
}
