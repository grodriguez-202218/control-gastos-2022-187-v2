import { Component, OnInit, signal, ElementRef, ViewChild, AfterViewInit } from "@angular/core";
import { Chart, ChartData, ChartOptions } from "chart.js";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { ExpenseService, ExpenseInterface, ExpenseSummaryInterface, MonthData, CategoryData } from "../../core/services/expense.service";

@Component({
  selector: "app-dashboard-admin",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dashboard-admin.component.html",
  styleUrl: "../../core/styles/dashboard.css",
})
export class DashboardAdminComponent implements OnInit, AfterViewInit {
  fullName = "";
  expenses = signal<ExpenseInterface[]>([]);
  summary: ExpenseSummaryInterface | null = null; // Propiedad regular
  incomeByMonth = signal<MonthData[]>([]);
  expenseByCategory = signal<CategoryData[]>([]);
  userId = signal<number | null>(null);

  @ViewChild("cashFlowChartRef") cashFlowChartRef!: ElementRef;
  @ViewChild("categoryChartRef") categoryChartRef!: ElementRef;

  cashFlowChart: any = null;
  categoryChart: any = null;

  constructor(
    private authService: AuthService,
    private expenseService: ExpenseService,
    private router: Router
  ) {}

  ngOnInit = async (): Promise<void> => {
    this.fullName = localStorage.getItem("fullName") || "Administrador";
    const token = localStorage.getItem("token");
    if (token && !this.authService.isTokenExpired()) {
      this.authService.scheduleAutoLogout(token);
    }

    this.userId.set(1);

    this.loadDashboardData();
  };

  private loadDashboardData(): void {
    const userId = this.userId();
    if (!userId) return;

    this.expenseService.getAll(userId).subscribe({
      next: (expenses) => this.expenses.set(expenses),
      error: (err) => console.error("Error cargando gastos", err),
    });

    this.expenseService.getSummary(userId).subscribe({
      next: (summary) => (this.summary = summary),
      error: (err) => console.error("Error obteniendo resumen", err),
    });

    this.expenseService.getIncomeByMonth(userId).subscribe({
      next: (data) => this.incomeByMonth.set(data),
      error: (err) => console.error("Error obteniendo ingresos por mes", err),
    });

    this.expenseService.getExpenseByCategory(userId).subscribe({
      next: (data) => this.expenseByCategory.set(data),
      error: (err) => console.error("Error obteniendo gastos por categoría", err),
    });
  };

  ngAfterViewInit(): void {
    this.initCharts();
  }

  private initCharts(): void {
    // Cash Flow Chart
    const cashCtx = (this.cashFlowChartRef.nativeElement as HTMLCanvasElement)
      .getContext("2d");
    if (!cashCtx) return;

    const incomeData = this.incomeByMonth().map((item: MonthData) => item.amount);
    const expenseData = this.expenseByCategory()
      .map((item: CategoryData) => item.amount)
      .concat(Array(12 - this.expenseByCategory().length).fill(0));

    this.cashFlowChart = new Chart(cashCtx, {
      type: "line",
      data: {
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        datasets: [
          {
            label: "Ingresos",
            data: incomeData,
            borderColor: "#98B315",
            backgroundColor: "rgba(152, 179, 21, 0.2)",
            borderWidth: 2,
            pointBackgroundColor: "#283830",
            pointBorderColor: "#98B315",
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
            tension: 0.4,
          },
          {
            label: "Gastos",
            data: expenseData,
            borderColor: "#f87171",
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: "#283830",
            pointBorderColor: "#f87171",
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: false,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            align: "center",
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              padding: 20,
            },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "#161d18",
            titleColor: "#fff",
            bodyColor: "#e2e8f0",
            borderColor: "#334155",
            borderWidth: 1,
          },
        },
scales: {
      x: {
        grid: { display: false },
      },
      y: {
        grid: {
          color: "rgba(255,255,255,0.05)",
        },
        ticks: {
          callback: function (value: any) {
            return "Q" + (value / 1000) + "k";
          },
        },
      },
    },
      },
    });

    // Category Chart
    const catCtx = (this.categoryChartRef.nativeElement as HTMLCanvasElement)
      .getContext("2d");
    if (!catCtx) return;

    this.categoryChart = new Chart(catCtx, {
      type: "doughnut",
      data: {
        labels: this.expenseByCategory().map((item: CategoryData) => item.category),
        datasets: [
          {
            data: this.expenseByCategory().map((item: CategoryData) => item.amount),
            backgroundColor: [
              "#98B315",
              "#5d8a6e",
              "#344e41",
              "#43825F",
              "#1e2923",
            ],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
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
              color: "#94a3b8",
            },
          },
        },
      },
    });
  }

  logout = (): void => {
    this.authService.logout("Sesion cerrada");
    this.router.navigate(["/login"]);
  };
}