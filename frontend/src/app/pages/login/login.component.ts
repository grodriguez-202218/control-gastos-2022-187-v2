import { Component, ElementRef, HostListener, QueryList, ViewChildren, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink, Router, ActivatedRoute } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { BlobField, generateBlobs, moveBlobs } from "../../core/utils/blobs";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./login.component.html",
  styleUrl: "../../core/styles/auth.css",
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = "";
  showPassword = signal(false);
  blobsData: BlobField[] = [];

  @ViewChildren("blobRef") blobRefs!: QueryList<ElementRef<HTMLDivElement>>;

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", Validators.required],
    });

    this.blobsData = generateBlobs();

    if (this.route.snapshot.queryParamMap.get("session") === "expired") {
      this.authService.sessionMessage.set("Sesion experida");
    }
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