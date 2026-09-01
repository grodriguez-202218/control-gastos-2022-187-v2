import { Injectable, signal, NgZone } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

const API_URL = "http://localhost:3000/api/auth";

export interface LoginResponse {
  token: string;
  user: { id: number; full_name: string; email: string; role: "user" | "admin" };
}

export interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private logoutTimer: ReturnType<typeof setTimeout> | undefined;
  private isRefreshing = false;
  private lastActivityCheck = 0;
  private activityListenersBound = false;
  private readonly activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

  sessionMessage = signal<string>("");

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone
  ) {
    const token = localStorage.getItem("token");
    if (token && !this.isTokenExpired()) {
      this.scheduleAutoLogout(token);
      this.setupActivityListeners();
    }
  }

  clearSessionMessage = (): void => {
    this.sessionMessage.set("");
  };

  register = (data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: string;
  }): Observable<any> => {
    return this.http.post(`${API_URL}/register`, data);
  };

  login = (email: string, password: string): Observable<LoginResponse> => {
    return this.http.post<LoginResponse>(`${API_URL}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem("token", res.token);
        localStorage.setItem("role", res.user.role);
        localStorage.setItem("fullName", res.user.full_name);
        this.sessionMessage.set("Se ha iniciado sesion");
        this.scheduleAutoLogout(res.token);
        this.setupActivityListeners();
      })
    );
  };

  refreshToken = (): Observable<LoginResponse> => {
    const token = localStorage.getItem("token");
    return this.http.post<LoginResponse>(`${API_URL}/refresh`, { token }).pipe(
      tap((res) => {
        localStorage.setItem("token", res.token);
        if (res.user) {
          localStorage.setItem("role", res.user.role);
          if (res.user.full_name) {
            localStorage.setItem("fullName", res.user.full_name);
          }
        }
        this.scheduleAutoLogout(res.token);
      })
    );
  };

  getUsers = (): Observable<UserRecord[]> => {
    return this.http.get<UserRecord[]>(`${API_URL}/users`);
  };

  logout = (message: string = "Sesion cerrada"): void => {
    localStorage.clear();
    this.removeActivityListeners();
    this.sessionMessage.set(message);
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = undefined;
    }
  };

  getRole = (): string | null => {
    return localStorage.getItem("role");
  };

  getTokenExpiration = (token: string): number | null => {
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  };

  isTokenExpired = (): boolean => {
    const token = localStorage.getItem("token");
    if (!token) return true;

    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;

    return Date.now() >= expiration;
  };

  isLoggedIn = (): boolean => {
    if (!localStorage.getItem("token")) return false;

    if (this.isTokenExpired()) {
      this.logout("Sesion experida");
      return false;
    }

    return true;
  };

  scheduleAutoLogout = (token: string): void => {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return;

    const msUntilExpiration = expiration - Date.now();

    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
    }

    if (msUntilExpiration <= 0) {
      this.logout("Sesion experida");
      this.router.navigate(["/login"]);
      return;
    }

    this.logoutTimer = setTimeout(() => {
      this.logout("Sesion experida");
      this.router.navigate(["/login"]);
    }, msUntilExpiration);
  };

  recordActivity = (): void => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const now = Date.now();
    // Throttle checks to once every 10 seconds
    if (now - this.lastActivityCheck < 10000) {
      return;
    }
    this.lastActivityCheck = now;

    if (this.isTokenExpired()) {
      this.logout("Sesion experida");
      this.router.navigate(["/login"]);
      return;
    }

    const expiration = this.getTokenExpiration(token);
    if (!expiration) return;

    const msUntilExpiration = expiration - now;
    // If less than 4 minutes remaining of the token lifetime (or token is <= 80% to expiration), refresh it
    if (msUntilExpiration < 240000 && !this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshToken().subscribe({
        next: () => {
          this.isRefreshing = false;
        },
        error: () => {
          this.isRefreshing = false;
        },
      });
    }
  };

  private setupActivityListeners = (): void => {
    if (this.activityListenersBound || typeof window === "undefined") return;

    this.activityListenersBound = true;
    this.ngZone.runOutsideAngular(() => {
      for (const eventName of this.activityEvents) {
        window.addEventListener(eventName, this.onUserActivity, { passive: true });
      }
    });
  };

  private removeActivityListeners = (): void => {
    if (!this.activityListenersBound || typeof window === "undefined") return;

    this.activityListenersBound = false;
    for (const eventName of this.activityEvents) {
      window.removeEventListener(eventName, this.onUserActivity);
    }
  };

  private onUserActivity = (): void => {
    this.recordActivity();
  };
}