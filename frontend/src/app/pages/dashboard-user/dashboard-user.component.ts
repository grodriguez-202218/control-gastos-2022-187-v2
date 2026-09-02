import { Component, OnInit, signal, ElementRef, ViewChild, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Chart, registerables } from "chart.js";
import { AuthService } from "../../core/services/auth.service";
import { ExpenseService, ExpenseInterface, ExpenseSummaryInterface, MonthData, CategoryData } from "../../core/services/expense.service";

Chart.register(...registerables);

@Component({
  selector: "app-dashboard-user",
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: "./dashboard-user.component.html",
  styleUrl: "./dashboard-user.component.css"
})
export class DashboardUserComponent implements OnInit, AfterViewInit {
  fullName = "";
  summary = signal<ExpenseSummaryInterface | null>(null);
  recentTransactions = signal<ExpenseInterface[]>([]);
  cashFlowData = signal<MonthData[]>([]);
  categoryData = signal<CategoryData[]>([]);

  // Modal
  showAddModal = false;
  transactionForm: FormGroup;
  modalError = "";

  @ViewChild("cashFlowChartRef") cashFlowChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild("categoryChartRef") categoryChartRef!: ElementRef<HTMLCanvasElement>;

  cashFlowChart: Chart | null = null;
  categoryChart: Chart | null = null;

  constructor(
    public authService: AuthService,
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

  get sessionMessage(): string {
    return this.authService.sessionMessage();
  }

  clearSessionMessage(): void {
    this.authService.clearSessionMessage();
  }

  ngOnInit(): void {
    this.fullName = localStorage.getItem("fullName") || "Usuario";
    const token = localStorage.getItem("token");
    if (token && !this.authService.isTokenExpired()) {
      this.authService.scheduleAutoLogout(token);
    }
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Los gráficos se inicializarán después de cargar los datos del backend
  }

  loadData(): void {
    // Cargar resumen de gastos
    this.expenseService.getSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
      },
      error: (err) => console.error("Error obteniendo resumen", err)
    });

    // Cargar últimas 5 transacciones
    this.expenseService.getAll(undefined, { limit: 5 }).subscribe({
      next: (transactions) => {
        this.recentTransactions.set(transactions);
      },
      error: (err) => console.error("Error cargando transacciones recientes", err)
    });

    // Cargar datos de gráficos
    this.expenseService.getChartsData().subscribe({
      next: (data) => {
        this.cashFlowData.set(data.cashFlow);
        this.categoryData.set(data.categories);
        this.initCharts();
      },
      error: (err) => console.error("Error obteniendo datos de gráficos", err)
    });
  }

  getProgressBarWidth(): string {
    const sum = this.summary();
    if (!sum || sum.presupuestoMensual <= 0) return "0%";
    const pct = (sum.gastosTotales / sum.presupuestoMensual) * 100;
    return `${Math.min(100, pct)}%`;
  }

  initCharts(): void {
    // Destruir gráficos previos si existen
    if (this.cashFlowChart) this.cashFlowChart.destroy();
    if (this.categoryChart) this.categoryChart.destroy();

    // 1. Gráfico de Flujo de Caja
    const cashCtx = this.cashFlowChartRef?.nativeElement?.getContext("2d");
    if (cashCtx) {
      const flow = this.cashFlowData();
      
      const gradientIncome = cashCtx.createLinearGradient(0, 0, 0, 200);
      gradientIncome.addColorStop(0, "rgba(152, 179, 21, 0.2)");
      gradientIncome.addColorStop(1, "rgba(152, 179, 21, 0)");

      this.cashFlowChart = new Chart(cashCtx, {
        type: "line",
        data: {
          labels: flow.map(f => f.month),
          datasets: [
            {
              label: "Ingresos",
              data: flow.map(f => f.income),
              borderColor: "#98B315",
              backgroundColor: gradientIncome,
              borderWidth: 2,
              pointBackgroundColor: "#283830",
              pointBorderColor: "#98B315",
              pointBorderWidth: 2,
              pointRadius: 4,
              fill: true,
              tension: 0.4
            },
            {
              label: "Gastos",
              data: flow.map(f => f.expense),
              borderColor: "#f87171",
              borderWidth: 2,
              borderDash: [5, 5],
              pointBackgroundColor: "#283830",
              pointBorderColor: "#f87171",
              pointBorderWidth: 2,
              pointRadius: 4,
              fill: false,
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#94a3b8",
                usePointStyle: true,
                boxWidth: 8,
                padding: 20
              }
            },
            tooltip: {
              mode: "index",
              intersect: false,
              backgroundColor: "#161d18",
              titleColor: "#fff",
              bodyColor: "#e2e8f0",
              borderColor: "#334155",
              borderWidth: 1
            }
          },
          scales: {
            x: {
              ticks: { color: "#94a3b8" },
              grid: { display: false }
            },
            y: {
              ticks: {
                color: "#94a3b8",
                callback: (val) => "Q" + (Number(val) / 1000).toFixed(0) + "k"
              },
              grid: { color: "rgba(255,255,255,0.05)" }
            }
          }
        }
      });
    }

    // 2. Gráfico de Categoría
    const catCtx = this.categoryChartRef?.nativeElement?.getContext("2d");
    if (catCtx) {
      const cats = this.categoryData();
      
      this.categoryChart = new Chart(catCtx, {
        type: "doughnut",
        data: {
          labels: cats.map(c => c.category),
          datasets: [{
            data: cats.map(c => c.amount),
            backgroundColor: [
              "#98B315",
              "#5d8a6e",
              "#344e41",
              "#43825F",
              "#1e2923"
            ],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "75%",
          plugins: {
            legend: {
              position: "right",
              labels: {
                usePointStyle: true,
                padding: 15,
                color: "#94a3b8"
              }
            }
          }
        }
      });
    }
  }

  // Métodos del Modal
  openModal(): void {
    this.showAddModal = true;
    this.modalError = "";
    this.transactionForm.reset({
      type: "expense",
      description: "",
      category: "Comestibles",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: ""
    });
  }

  closeModal(): void {
    this.showAddModal = false;
  }

  onSubmitTransaction(): void {
    if (this.transactionForm.invalid) return;

    this.expenseService.create(this.transactionForm.value).subscribe({
      next: () => {
        this.closeModal();
        this.loadData(); // Recargar datos
      },
      error: (err) => {
        this.modalError = err.error?.message || "Error al registrar la transacción";
      }
    });
  }

  logout(): void {
    this.authService.logout("Sesion cerrada");
    this.router.navigate(["/login"]);
  }
}