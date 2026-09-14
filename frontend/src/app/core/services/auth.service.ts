import { Injectable, signal, NgZone } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { GoogleTokenPayload, GoogleUser } from "../models/google-user.model";

const API_URL = "http://localhost:3000/api/auth";

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    full_name: string;
    email: string;
    role: "user" | "admin";
    avatar_url?: string;
    google_id?: string;
  };
}

export interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  avatar_url?: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private logoutTimer: ReturnType<typeof setTimeout> | undefined;
  private isRefreshing = false;
  private lastActivityCheck = 0;
  private activityListenersBound = false;
  private readonly activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

  sessionMessage = signal<string>("");
  avatarUrl = signal<string>(typeof localStorage !== "undefined" ? localStorage.getItem("avatarUrl") || "" : "");
  currentUser = signal<GoogleUser | null>(this.getStoredGoogleUser());

  private getStoredGoogleUser(): GoogleUser | null {
    if (typeof localStorage === "undefined") return null;
    const googleId = localStorage.getItem("googleId");
    const email = localStorage.getItem("email");
    const fullName = localStorage.getItem("fullName");
    const picture = localStorage.getItem("avatarUrl") || "";
    if (!googleId && !picture) return null;
    return {
      googleId: googleId || "",
      fullName: fullName || "",
      firstName: fullName?.split(" ")[0] || "",
      lastName: fullName?.split(" ").slice(1).join(" ") || "",
      email: email || "",
      picture,
    };
  }

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

  loginWithGoogle = (credential: string): Observable<LoginResponse> => {
    return this.http.post<LoginResponse>(`${API_URL}/google`, { credential }).pipe(
      tap((res) => {
        localStorage.setItem("token", res.token);
        localStorage.setItem("role", res.user.role);
        localStorage.setItem("fullName", res.user.full_name);
        localStorage.setItem("email", res.user.email);
        if (res.user.avatar_url) {
          localStorage.setItem("avatarUrl", res.user.avatar_url);
          this.avatarUrl.set(res.user.avatar_url);
        }
        if (res.user.google_id) {
          localStorage.setItem("googleId", res.user.google_id);
        }
        this.sessionMessage.set(`Bienvenido, ${res.user.full_name}`);
        this.scheduleAutoLogout(res.token);
        this.setupActivityListeners();
      })
    );
  };

  decodeGoogleToken = (token: string): GoogleTokenPayload | null => {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload) as GoogleTokenPayload;
    } catch (err) {
      console.error("Error al decodificar token de Google:", err);
      return null;
    }
  };

  extractGoogleUser = (payload: GoogleTokenPayload): GoogleUser => {
    const firstName = payload.given_name || payload.name?.split(" ")[0] || "";
    const lastName = payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "";
    const fullName = payload.name || `${firstName} ${lastName}`.trim() || "Usuario Google";

    return {
      googleId: payload.sub,
      firstName,
      lastName,
      fullName,
      email: payload.email,
      picture: payload.picture || "",
    };
  };

  saveGoogleUserSession = (googleUser: GoogleUser, token?: string, role: "user" | "admin" = "user"): void => {
    if (token) {
      localStorage.setItem("token", token);
      this.scheduleAutoLogout(token);
      this.setupActivityListeners();
    }
    localStorage.setItem("googleId", googleUser.googleId);
    localStorage.setItem("fullName", googleUser.fullName);
    localStorage.setItem("email", googleUser.email);
    localStorage.setItem("avatarUrl", googleUser.picture);
    localStorage.setItem("role", role);

    this.currentUser.set(googleUser);
    this.avatarUrl.set(googleUser.picture);
    this.sessionMessage.set(`Bienvenido, ${googleUser.firstName || googleUser.fullName}`);
  };

  logout = (message: string = "Sesion cerrada"): void => {
    localStorage.clear();
    this.removeActivityListeners();
    this.sessionMessage.set(message);
    this.avatarUrl.set("");
    this.currentUser.set(null);
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = undefined;
    }
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.disableAutoSelect();
      } catch (e) {
      }
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