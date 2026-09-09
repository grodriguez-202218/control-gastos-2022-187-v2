import {
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChildren,
  ViewChild,
  AfterViewInit,
  NgZone,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink, Router, ActivatedRoute } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { BlobField, generateBlobs, moveBlobs } from "../../core/utils/blobs";
import { AUTH_CONFIG } from "../../core/config/auth.config";
import { GoogleCredentialResponse } from "../../core/models/google-user.model";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./login.component.html",
  styleUrl: "../../core/styles/auth.css",
})
export class LoginComponent implements AfterViewInit {
  loginForm: FormGroup;
  errorMessage = "";
  showPassword = signal(false);
  blobsData: BlobField[] = [];

  @ViewChildren("blobRef") blobRefs!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChild("googleBtnRef") googleBtnRef!: ElementRef<HTMLDivElement>;

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {
    this.loginForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", Validators.required],
    });

    this.blobsData = generateBlobs();

    if (this.route.snapshot.queryParamMap.get("session") === "expired") {
      this.authService.sessionMessage.set("Sesión expirada");
    }
  }

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  private initGoogleSignIn(): void {
    if (typeof window === "undefined") return;

    let attempts = 0;
    const checkGoogle = setInterval(() => {
      attempts++;
      const google = (window as any).google;
      if (google?.accounts?.id && this.googleBtnRef?.nativeElement) {
        clearInterval(checkGoogle);
        try {
          google.accounts.id.initialize({
            client_id: AUTH_CONFIG.googleClientId,
            callback: (response: GoogleCredentialResponse) => {
              this.ngZone.run(() => this.handleGoogleSignIn(response));
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
            theme: "outline",
            size: "large",
            type: "standard",
            shape: "rectangular",
            text: "signin_with",
            logo_alignment: "left",
            width: 380,
          });
        } catch (error) {
          console.error("Error al inicializar Google Identity Services:", error);
        }
      } else if (attempts > 30) {
        clearInterval(checkGoogle);
      }
    }, 150);
  }

  private handleGoogleSignIn(response: GoogleCredentialResponse): void {
    this.errorMessage = "";
    if (!response.credential) {
      this.errorMessage = "No se recibió la credencial de Google";
      return;
    }

    const payload = this.authService.decodeGoogleToken(response.credential);
    if (!payload) {
      this.errorMessage = "Error al procesar la información de Google";
      return;
    }

    const googleUser = this.authService.extractGoogleUser(payload);
    console.log("=== Usuario autenticado con Google ===");
    console.log("Google ID:", googleUser.googleId);
    console.log("Nombre:", googleUser.firstName);
    console.log("Apellido:", googleUser.lastName);
    console.log("Email:", googleUser.email);
    console.log("Foto de perfil:", googleUser.picture);

    // Intentar autenticación segura contra el backend
    this.authService.loginWithGoogle(response.credential).subscribe({
      next: (res) => {
        if (res.user.role === "admin") {
          this.router.navigate(["/admin"]);
        } else {
          this.router.navigate(["/dashboard"]);
        }
      },
      error: (err) => {
        console.warn("Backend no respondió o error en verificación. Iniciando sesión localmente con Google:", err);
        // Fallback resiliente: guardar información de Google sin requerir contraseña
        this.authService.saveGoogleUserSession(googleUser);
        this.router.navigate(["/dashboard"]);
      },
    });
  }

  get sessionMessage(): string {
    return this.authService.sessionMessage();
  }

  @HostListener("window:mousemove", ["$event"])
  onMouseMove = (e: MouseEvent): void => {
    if (this.blobRefs) {
      moveBlobs(this.blobRefs.map((ref) => ref.nativeElement), e);
    }
  };

  togglePasswordVisibility = (): void => {
    this.showPassword.set(!this.showPassword());
  };

  onSubmit = (): void => {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).subscribe({
      next: (res) => {
        if (res.user.role === "admin") {
          this.router.navigate(["/admin"]);
        } else {
          this.router.navigate(["/dashboard"]);
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || "Error al iniciar sesión";
      },
    });
  };
}