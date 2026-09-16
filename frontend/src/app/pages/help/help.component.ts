import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-help",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./help.component.html",
  styleUrl: "./help.component.css",
})
export class HelpComponent implements OnInit {
  fullName = "";
  email = "";
  avatarUrl = "";

  copiedToast = signal<string | null>(null);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fullName = localStorage.getItem("fullName") || "Usuario";
    this.email = localStorage.getItem("email") || "";
    this.avatarUrl = localStorage.getItem("avatarUrl") || "";
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }

  copyToClipboard(text: string, label: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(`${label} copiado al portapapeles`);
      }).catch(() => {
        this.fallbackCopy(text, label);
      });
    } else {
      this.fallbackCopy(text, label);
    }
  }

  private fallbackCopy(text: string, label: string): void {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      this.showToast(`${label} copiado al portapapeles`);
    } catch {
      this.showToast(`No se pudo copiar automáticamente: ${text}`);
    }
  }

  private showToast(message: string): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.copiedToast.set(message);
    this.toastTimeout = setTimeout(() => {
      this.copiedToast.set(null);
      this.toastTimeout = null;
    }, 3000);
  }
}
