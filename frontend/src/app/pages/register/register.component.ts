import { Component, ElementRef, HostListener, QueryList, ViewChildren, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink, Router } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { BlobField, generateBlobs, moveBlobs } from "../../core/utils/blobs";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./register.component.html",
  styleUrl: "../../core/styles/auth.css",
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage = "";
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  blobsData: BlobField[] = [];

  @ViewChildren("blobRef") blobRefs!: QueryList<ElementRef<HTMLDivElement>>;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.registerForm = this.fb.group({
      fullName: ["", Validators.required],
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(6)]],
      confirmPassword: ["", Validators.required],
      role: ["", Validators.required],
    });

    this.blobsData = generateBlobs();
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

  toggleConfirmPasswordVisibility = (): void => {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  };

  setRole = (role: string): void => {
    const currentRole = this.registerForm.get("role")?.value;
    if (currentRole === role) {
      this.registerForm.patchValue({ role: "" });
    } else {
      this.registerForm.patchValue({ role });
    }
  };

  onSubmit = (): void => {
    if (this.registerForm.invalid) {
      if (!this.registerForm.get("role")?.value) {
        this.errorMessage = "Por favor selecciona un rol (Usuario o Admin)";
      } else {
        this.errorMessage = "Por favor completa todos los campos correctamente";
      }
      return;
    }

    this.errorMessage = "";
    this.authService.register(this.registerForm.value).subscribe({
      next: () => this.router.navigate(["/login"]),
      error: (err) => {
        this.errorMessage = err.error?.message || "Error al registrarse";
      },
    });
  };
}