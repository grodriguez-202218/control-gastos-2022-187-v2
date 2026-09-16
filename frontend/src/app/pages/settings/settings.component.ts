import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.css",
})
export class SettingsComponent implements OnInit {
  fullName = "";
  email = "";
  avatarUrl = "";
  role = "";

  activeTab = signal<"profile" | "preferences" | "notifications" | "security">("profile");

  successMessage = signal<string>("");
  errorMessage = signal<string>("");

  profileForm: FormGroup;
  preferencesForm: FormGroup;
  notificationsForm: FormGroup;
  passwordForm: FormGroup;

  availableCurrencies = [
    { code: "GTQ", symbol: "Q", name: "Quetzal Guatemalteco (GTQ - Q)" },
    { code: "USD", symbol: "$", name: "Dólar Estadounidense (USD - $)" },
    { code: "EUR", symbol: "€", name: "Euro (EUR - €)" },
    { code: "MXN", symbol: "$", name: "Peso Mexicano (MXN - $)" },
  ];

  availableCategories = [
    "Comestibles",
    "Transporte",
    "Servicios",
    "Vivienda",
    "Ropa",
    "Viajes",
    "Entretenimiento",
    "Salud",
    "Educación",
    "Otros",
  ];

  presetAvatars = [
    "https://api.dicebear.com/7.x/bottts/svg?seed=Aureo1",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Aureo2",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Aureo3",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Aureo4",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Aureo5",
  ];

  constructor(
    public authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.profileForm = this.fb.group({
      fullName: ["", [Validators.required, Validators.minLength(2)]],
      email: ["", [Validators.required, Validators.email]],
      avatarUrl: [""],
    });

    this.preferencesForm = this.fb.group({
      currency: ["GTQ", Validators.required],
      monthlyBudget: [8000, [Validators.required, Validators.min(0)]],
      dateFormat: ["DD/MM/YYYY", Validators.required],
      defaultCategory: ["Comestibles", Validators.required],
    });

    this.notificationsForm = this.fb.group({
      budgetAlert: [true],
      highTransactionAlert: [true],
      dailyReminder: [false],
      emailNotifications: [true],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ["", [Validators.required, Validators.minLength(6)]],
      newPassword: ["", [Validators.required, Validators.minLength(6)]],
      confirmPassword: ["", [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadPreferences();
  }

  loadUserData(): void {
    this.fullName = localStorage.getItem("fullName") || "Usuario";
    this.email = localStorage.getItem("email") || "";
    this.avatarUrl = localStorage.getItem("avatarUrl") || "";
    this.role = localStorage.getItem("role") || "user";

    this.profileForm.patchValue({
      fullName: this.fullName,
      email: this.email,
      avatarUrl: this.avatarUrl,
    });
  }

  loadPreferences(): void {
    const savedCurrency = localStorage.getItem("pref_currency") || "GTQ";
    const savedBudget = Number(localStorage.getItem("pref_monthly_budget")) || 8000;
    const savedDateFormat = localStorage.getItem("pref_date_format") || "DD/MM/YYYY";
    const savedCategory = localStorage.getItem("pref_default_category") || "Comestibles";

    this.preferencesForm.patchValue({
      currency: savedCurrency,
      monthlyBudget: savedBudget,
      dateFormat: savedDateFormat,
      defaultCategory: savedCategory,
    });

    const savedBudgetAlert = localStorage.getItem("pref_budget_alert") !== "false";
    const savedHighTxAlert = localStorage.getItem("pref_hightx_alert") !== "false";
    const savedDailyReminder = localStorage.getItem("pref_daily_reminder") === "true";
    const savedEmailNotif = localStorage.getItem("pref_email_notif") !== "false";

    this.notificationsForm.patchValue({
      budgetAlert: savedBudgetAlert,
      highTransactionAlert: savedHighTxAlert,
      dailyReminder: savedDailyReminder,
      emailNotifications: savedEmailNotif,
    });
  }

  setTab(tab: "profile" | "preferences" | "notifications" | "security"): void {
    this.activeTab.set(tab);
    this.clearAlerts();
  }

  selectPresetAvatar(url: string): void {
    this.profileForm.patchValue({ avatarUrl: url });
  }

  saveProfile(): void {
    this.clearAlerts();
    if (this.profileForm.invalid) {
      this.errorMessage.set("Por favor verifica los campos del perfil.");
      return;
    }

    const { fullName, email, avatarUrl } = this.profileForm.value;
    localStorage.setItem("fullName", fullName);
    localStorage.setItem("email", email);
    localStorage.setItem("avatarUrl", avatarUrl || "");

    this.fullName = fullName;
    this.email = email;
    this.avatarUrl = avatarUrl || "";
    this.authService.avatarUrl.set(this.avatarUrl);

    this.successMessage.set("¡Perfil actualizado correctamente!");
  }

  savePreferences(): void {
    this.clearAlerts();
    if (this.preferencesForm.invalid) {
      this.errorMessage.set("Por favor ingresa valores válidos para las preferencias.");
      return;
    }

    const { currency, monthlyBudget, dateFormat, defaultCategory } = this.preferencesForm.value;
    localStorage.setItem("pref_currency", currency);
    localStorage.setItem("pref_monthly_budget", monthlyBudget.toString());
    localStorage.setItem("pref_date_format", dateFormat);
    localStorage.setItem("pref_default_category", defaultCategory);

    this.successMessage.set("¡Preferencias guardadas exitosamente!");
  }

  saveNotifications(): void {
    this.clearAlerts();
    const { budgetAlert, highTransactionAlert, dailyReminder, emailNotifications } = this.notificationsForm.value;

    localStorage.setItem("pref_budget_alert", String(budgetAlert));
    localStorage.setItem("pref_hightx_alert", String(highTransactionAlert));
    localStorage.setItem("pref_daily_reminder", String(dailyReminder));
    localStorage.setItem("pref_email_notif", String(emailNotifications));

    this.successMessage.set("¡Configuración de notificaciones guardada!");
  }

  changePassword(): void {
    this.clearAlerts();
    if (this.passwordForm.invalid) {
      this.errorMessage.set("La contraseña debe contener al menos 6 caracteres.");
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.errorMessage.set("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    if (currentPassword === newPassword) {
      this.errorMessage.set("La nueva contraseña debe ser diferente a la contraseña actual.");
      return;
    }

    this.passwordForm.reset();
    this.successMessage.set("¡Contraseña actualizada satisfactoriamente en tu sesión!");
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }

  clearAlerts(): void {
    this.successMessage.set("");
    this.errorMessage.set("");
  }
}
