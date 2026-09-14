import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { BudgetService, BudgetInterface, BudgetSummaryInterface } from "../../core/services/budget.service";

@Component({
  selector: "app-budgets",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: "./budgets.component.html",
  styleUrl: "./budgets.component.css",
})
export class BudgetsComponent implements OnInit {
  fullName = "";
  email = "";
  avatarUrl = "";

  budgets = signal<BudgetInterface[]>([]);
  summary = signal<BudgetSummaryInterface | null>(null);
  loading = signal<boolean>(false);

  // Selector de mes (formato 'YYYY-MM')
  currentMonth = signal<string>(this.getInitialMonth());

  // Filtros
  searchTerm = "";
  statusFilter = "Todos"; // 'Todos' | 'normal' | 'warning' | 'completed' | 'exceeded'

  // Modal Crear/Editar
  showModal = false;
  isEditMode = false;
  editingId: number | null = null;
  budgetForm: FormGroup;
  modalError = "";

  // Modal Abonar a Meta
  showAbonoModal = false;
  abonoBudget: BudgetInterface | null = null;
  abonoForm: FormGroup;
  abonoError = "";

  // Modal Eliminar
  showDeleteModal = false;
  budgetToDelete: BudgetInterface | null = null;

  // Lista de categorías disponibles
  categories = [
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

  constructor(
    public authService: AuthService,
    private budgetService: BudgetService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.budgetForm = this.fb.group({
      category: ["Comestibles", Validators.required],
      amount: ["", [Validators.required, Validators.min(1)]],
      type: ["goal", Validators.required],
      month: [this.getInitialMonth(), Validators.required],
      notes: [""],
    });

    this.abonoForm = this.fb.group({
      amount: ["", [Validators.required, Validators.min(0.01)]],
      date: [new Date().toISOString().split("T")[0], Validators.required],
      notes: [""],
    });
  }

  ngOnInit(): void {
    this.fullName = localStorage.getItem("fullName") || "Usuario";
    this.email = localStorage.getItem("email") || "";
    this.avatarUrl = localStorage.getItem("avatarUrl") || this.authService.avatarUrl() || "";

    const token = localStorage.getItem("token");
    if (token && !this.authService.isTokenExpired()) {
      this.authService.scheduleAutoLogout(token);
    }

    this.loadBudgets();
  }

  get sessionMessage(): string {
    return this.authService.sessionMessage();
  }

  clearSessionMessage(): void {
    this.authService.clearSessionMessage();
  }

  private getInitialMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  getMonthLabel(monthStr: string): string {
    try {
      const [year, month] = monthStr.split("-");
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const name = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return monthStr;
    }
  }

  loadBudgets(): void {
    this.loading.set(true);
    this.budgetService.getBudgets(this.currentMonth()).subscribe({
      next: (res) => {
        this.budgets.set(res.budgets || []);
        this.summary.set(res.summary);
        this.loading.set(false);
      },
      error: (err) => {
        console.error("Error al cargar presupuestos:", err);
        this.loading.set(false);
      },
    });
  }

  previousMonth(): void {
    const [year, month] = this.currentMonth().split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    const prev = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    this.currentMonth.set(prev);
    this.budgetForm.patchValue({ month: prev });
    this.loadBudgets();
  }

  nextMonth(): void {
    const [year, month] = this.currentMonth().split("-").map(Number);
    const date = new Date(year, month, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    this.currentMonth.set(next);
    this.budgetForm.patchValue({ month: next });
    this.loadBudgets();
  }

  resetCurrentMonth(): void {
    const cur = this.getInitialMonth();
    this.currentMonth.set(cur);
    this.budgetForm.patchValue({ month: cur });
    this.loadBudgets();
  }

  filteredBudgets(): BudgetInterface[] {
    let list = this.budgets();

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(
        (b) =>
          b.category.toLowerCase().includes(term) ||
          (b.notes && b.notes.toLowerCase().includes(term))
      );
    }

    if (this.statusFilter !== "Todos") {
      list = list.filter((b) => b.status === this.statusFilter);
    }

    return list;
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.modalError = "";
    this.budgetForm.reset({
      category: "Entretenimiento",
      amount: "",
      type: "goal",
      month: this.currentMonth(),
      notes: "",
    });
    this.showModal = true;
  }

  openEditModal(budget: BudgetInterface): void {
    this.isEditMode = true;
    this.editingId = budget.id;
    this.modalError = "";
    this.budgetForm.patchValue({
      category: budget.category,
      amount: budget.amount,
      type: budget.type || "goal",
      month: budget.month,
      notes: budget.notes || "",
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.modalError = "";
  }

  saveBudget(): void {
    if (this.budgetForm.invalid) return;

    this.modalError = "";
    const formVal = this.budgetForm.value;

    if (this.isEditMode && this.editingId) {
      this.budgetService
        .update(this.editingId, {
          category: formVal.category,
          amount: parseFloat(formVal.amount),
          type: formVal.type,
          notes: formVal.notes,
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadBudgets();
          },
          error: (err) => {
            this.modalError = err.error?.message || "Error al actualizar meta";
          },
        });
    } else {
      this.budgetService
        .create({
          category: formVal.category,
          amount: parseFloat(formVal.amount),
          type: formVal.type,
          month: formVal.month || this.currentMonth(),
          notes: formVal.notes,
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadBudgets();
          },
          error: (err) => {
            this.modalError = err.error?.message || "Error al crear meta";
          },
        });
    }
  }

  // --- Modal y Gestión de Abonos ---
  openAbonoModal(budget: BudgetInterface): void {
    this.abonoBudget = budget;
    this.abonoError = "";
    this.abonoForm.reset({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    this.showAbonoModal = true;
  }

  closeAbonoModal(): void {
    this.showAbonoModal = false;
    this.abonoBudget = null;
    this.abonoError = "";
  }

  confirmAbono(): void {
    if (this.abonoForm.invalid || !this.abonoBudget) return;

    this.abonoError = "";
    const { amount, date, notes } = this.abonoForm.value;
    const numericAmount = parseFloat(amount);

    this.budgetService
      .contribute(this.abonoBudget.id, {
        amount: numericAmount,
        date,
        notes,
      })
      .subscribe({
        next: () => {
          this.authService.sessionMessage.set(
            `¡Abono de Q${numericAmount.toFixed(2)} registrado con éxito para ${this.abonoBudget?.category}!`
          );
          this.closeAbonoModal();
          this.loadBudgets();
        },
        error: (err) => {
          this.abonoError = err.error?.message || "Error al registrar el abono";
        },
      });
  }

  openDeleteModal(budget: BudgetInterface): void {
    this.budgetToDelete = budget;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.budgetToDelete = null;
  }

  confirmDelete(): void {
    if (!this.budgetToDelete) return;

    this.budgetService.delete(this.budgetToDelete.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadBudgets();
      },
      error: (err) => {
        console.error("Error al eliminar meta:", err);
        this.closeDeleteModal();
      },
    });
  }

  getCategoryColor(category: string): string {
    switch (category.toLowerCase()) {
      case "comestibles":
        return "#98B315";
      case "transporte":
        return "#3b82f6";
      case "servicios":
        return "#8b5cf6";
      case "vivienda":
        return "#ec4899";
      case "ropa":
        return "#f97316";
      case "viajes":
        return "#06b6d4";
      case "entretenimiento":
        return "#eab308";
      case "salud":
        return "#ef4444";
      case "educación":
      case "educacion":
        return "#10b981";
      default:
        return "#64748b";
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }
}
