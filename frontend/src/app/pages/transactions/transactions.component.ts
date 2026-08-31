import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { ExpenseService, ExpenseInterface, ExpenseSummaryInterface } from "../../core/services/expense.service";

@Component({
  selector: "app-transactions",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: "./transactions.component.html",
  styleUrl: "./transactions.component.css"
})
export class TransactionsComponent implements OnInit {
  fullName = "";
  summary = signal<ExpenseSummaryInterface | null>(null);
  transactions = signal<ExpenseInterface[]>([]);
  
  // Filtros
  searchTerm = "";
  selectedType = "Todos";
  selectedCategory = "Todas";
  selectedDateFilter = "Histórico";

  // Paginación
  currentPage = 1;
  pageSize = 5; // tamaño de página de 5 para facilitar la visualización
  totalTransactions = 0;
  totalPages = 1;
  showingStart = 0;
  showingEnd = 0;

  // Modal
  showModal = false;
  isEditMode = false;
  editingId: number | null = null;
  transactionForm: FormGroup;
  modalError = "";

  // Vista de detalles (modal de ver)
  showDetailModal = false;
  selectedTx: ExpenseInterface | null = null;

  constructor(
    private authService: AuthService,
    private expenseService: ExpenseService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.transactionForm = this.fb.group({
      type: ["expense", Validators.required],
      description: ["", [Validators.required, Validators.maxLength(255)]],
      category: ["Comestibles", Validators.required],
      amount: ["", [Validators.required, Validators.min(0.01)]],
      date: [new Date().toISOString().split("T")[0], Validators.required],
      notes: [""]
    });
  }

  ngOnInit(): void {
    this.fullName = localStorage.getItem("fullName") || "Usuario";
    const token = localStorage.getItem("token");
    if (token && !this.authService.isTokenExpired()) {
      this.authService.scheduleAutoLogout(token);
    }
    this.loadSummary();
    this.loadTransactions();
  }

  loadSummary(): void {
    this.expenseService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
      error: (err) => console.error("Error obteniendo resumen", err)
    });
  }

  loadTransactions(): void {
    const filters: any = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.searchTerm.trim()) {
      filters.search = this.searchTerm.trim();
    }
    if (this.selectedType !== "Todos") {
      filters.type = this.selectedType === "Ingreso" ? "income" : "expense";
    }
    if (this.selectedCategory !== "Todas") {
      filters.category = this.selectedCategory;
    }
    if (this.selectedDateFilter === "Este Mes") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      filters.startDate = firstDay;
    }

    this.expenseService.getPaginated(filters).subscribe({
      next: (res) => {
        this.transactions.set(res.data || []);
        this.totalTransactions = res.pagination?.total || 0;
        this.totalPages = res.pagination?.totalPages || 1;
        this.currentPage = res.pagination?.page || 1;
        this.calculateShowingRange();
      },
      error: (err) => console.error("Error cargando transacciones", err)
    });
  }

  calculateShowingRange(): void {
    if (this.totalTransactions === 0) {
      this.showingStart = 0;
      this.showingEnd = 0;
      return;
    }
    this.showingStart = (this.currentPage - 1) * this.pageSize + 1;
    this.showingEnd = Math.min(this.currentPage * this.pageSize, this.totalTransactions);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadTransactions();
  }

  clearFilters(): void {
    this.searchTerm = "";
    this.selectedType = "Todos";
    this.selectedCategory = "Todas";
    this.selectedDateFilter = "Histórico";
    this.currentPage = 1;
    this.loadTransactions();
  }

  // Paginación
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadTransactions();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadTransactions();
    }
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadTransactions();
    }
  }

  getPagesArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // CRUD
  openAddModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.modalError = "";
    this.transactionForm.reset({
      type: "expense",
      description: "",
      category: "Comestibles",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: ""
    });
    this.showModal = true;
  }

  openEditModal(tx: ExpenseInterface): void {
    this.isEditMode = true;
    this.editingId = tx.id || null;
    this.modalError = "";
    
    // Formatear fecha para el input date (YYYY-MM-DD)
    let formattedDate = "";
    if (tx.date) {
      formattedDate = new Date(tx.date).toISOString().split("T")[0];
    }

    this.transactionForm.reset({
      type: tx.type,
      description: tx.description,
      category: tx.category,
      amount: tx.amount,
      date: formattedDate,
      notes: tx.notes || ""
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  openViewModal(tx: ExpenseInterface): void {
    this.selectedTx = tx;
    this.showDetailModal = true;
  }

  closeViewModal(): void {
    this.showDetailModal = false;
    this.selectedTx = null;
  }

  onSubmitTransaction(): void {
    if (this.transactionForm.invalid) return;

    if (this.isEditMode && this.editingId !== null) {
      this.expenseService.update(this.editingId, this.transactionForm.value).subscribe({
        next: () => {
          this.closeModal();
          this.loadSummary();
          this.loadTransactions();
        },
        error: (err) => {
          this.modalError = err.error?.message || "Error al actualizar la transacción";
        }
      });
    } else {
      this.expenseService.create(this.transactionForm.value).subscribe({
        next: () => {
          this.closeModal();
          this.loadSummary();
          this.loadTransactions();
        },
        error: (err) => {
          this.modalError = err.error?.message || "Error al registrar la transacción";
        }
      });
    }
  }

  deleteTransaction(id: number): void {
    if (confirm("¿Estás seguro de que deseas eliminar esta transacción?")) {
      this.expenseService.delete(id).subscribe({
        next: () => {
          this.loadSummary();
          this.loadTransactions();
        },
        error: (err) => console.error("Error al eliminar transacción", err)
      });
    }
  }

  logout(): void {
    this.authService.logout("Sesion cerrada");
    this.router.navigate(["/login"]);
  }
}
