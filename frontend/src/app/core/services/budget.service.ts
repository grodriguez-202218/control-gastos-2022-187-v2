import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, tap } from "rxjs/operators";

export interface BudgetInterface {
  id: number;
  user_id?: number;
  category: string;
  amount: number;
  current_amount?: number;
  type?: "goal" | "expense_limit";
  month: string;
  notes?: string;
  spent: number;
  remaining: number;
  percentage: number;
  status: "normal" | "warning" | "exceeded" | "completed";
  created_at?: string;
  updated_at?: string;
}

export interface BudgetSummaryInterface {
  month: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  percentage: number;
  budgetsCount: number;
  warningCount: number;
  exceededCount: number;
  completedCount?: number;
}

export interface BudgetsResponse {
  month: string;
  summary: BudgetSummaryInterface;
  budgets: BudgetInterface[];
}

export interface CreateBudgetDto {
  category: string;
  amount: number;
  type?: "goal" | "expense_limit";
  month?: string;
  notes?: string;
}

@Injectable({
  providedIn: "root",
})
export class BudgetService {
  private readonly apiUrl = "http://localhost:3000/api/budgets";
  private readonly storageKey = "aureo_budgets_local";

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): { Authorization: string } {
    const token = localStorage.getItem("token") || "";
    return { Authorization: `Bearer ${token}` };
  }

  getBudgets(month?: string): Observable<BudgetsResponse> {
    let params = new HttpParams();
    if (month) params = params.set("month", month);

    return this.http
      .get<BudgetsResponse>(this.apiUrl, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(
        tap((res) => {
          this.syncToLocal(res.budgets, res.month);
        }),
        catchError((err) => {
          console.warn("Backend /api/budgets no disponible, usando almacenamiento local:", err);
          return of(this.getLocalBudgets(month));
        })
      );
  }

  getSummary(month?: string): Observable<BudgetSummaryInterface> {
    let params = new HttpParams();
    if (month) params = params.set("month", month);

    return this.http
      .get<BudgetSummaryInterface>(`${this.apiUrl}/summary`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(
        catchError(() => {
          const local = this.getLocalBudgets(month);
          return of(local.summary);
        })
      );
  }

  create(data: CreateBudgetDto): Observable<{ message: string; budget: BudgetInterface }> {
    return this.http
      .post<{ message: string; budget: BudgetInterface }>(this.apiUrl, data, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        catchError(() => {
          const budget = this.createLocalBudget(data);
          return of({ message: "Presupuesto guardado localmente", budget });
        })
      );
  }

  update(id: number, data: Partial<CreateBudgetDto>): Observable<{ message: string; budget: BudgetInterface }> {
    return this.http
      .put<{ message: string; budget: BudgetInterface }>(`${this.apiUrl}/${id}`, data, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        catchError(() => {
          const budget = this.updateLocalBudget(id, data);
          return of({ message: "Presupuesto actualizado localmente", budget });
        })
      );
  }

  contribute(
    id: number,
    data: { amount: number; notes?: string; date?: string }
  ): Observable<{ message: string; budget: BudgetInterface }> {
    return this.http
      .post<{ message: string; budget: BudgetInterface }>(`${this.apiUrl}/${id}/contribute`, data, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        catchError(() => {
          const budget = this.contributeLocalBudget(id, data.amount);
          return of({ message: "Abono registrado localmente", budget });
        })
      );
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        catchError(() => {
          this.deleteLocalBudget(id);
          return of({ message: "Presupuesto eliminado localmente" });
        })
      );
  }

  // --- Manejo local resiliente ---
  private getCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  private getLocalList(): BudgetInterface[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : this.getDefaultBudgets();
    } catch {
      return this.getDefaultBudgets();
    }
  }

  private saveLocalList(list: BudgetInterface[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch (e) {
      console.error("Error guardando presupuestos locales:", e);
    }
  }

  private getDefaultBudgets(): BudgetInterface[] {
    const curMonth = this.getCurrentMonth();
    return [
      {
        id: 1,
        category: "Entretenimiento",
        amount: 5000,
        current_amount: 1500,
        type: "goal",
        month: curMonth,
        notes: "PS5",
        spent: 1500,
        remaining: 3500,
        percentage: 30,
        status: "normal",
      },
      {
        id: 2,
        category: "Ropa",
        amount: 800,
        current_amount: 250,
        type: "goal",
        month: curMonth,
        notes: "Guardarropa",
        spent: 250,
        remaining: 550,
        percentage: 31.2,
        status: "normal",
      },
      {
        id: 3,
        category: "Comestibles",
        amount: 2500,
        current_amount: 0,
        type: "expense_limit",
        month: curMonth,
        notes: "Supermercado mensual",
        spent: 1650,
        remaining: 850,
        percentage: 66,
        status: "normal",
      },
    ];
  }

  private syncToLocal(budgets: BudgetInterface[], month: string): void {
    if (!budgets || budgets.length === 0) return;
    const all = this.getLocalList().filter((b) => b.month !== month);
    this.saveLocalList([...all, ...budgets]);
  }

  private getLocalBudgets(month?: string): BudgetsResponse {
    const targetMonth = month || this.getCurrentMonth();
    const all = this.getLocalList();
    const filtered = all.filter((b) => b.month === targetMonth);

    const totalBudget = filtered.reduce((acc, b) => acc + b.amount, 0);
    const totalSpent = filtered.reduce((acc, b) => acc + (b.spent || 0), 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const warningCount = filtered.filter((b) => b.status === "warning").length;
    const exceededCount = filtered.filter((b) => b.status === "exceeded").length;
    const completedCount = filtered.filter((b) => b.status === "completed").length;

    return {
      month: targetMonth,
      summary: {
        month: targetMonth,
        totalBudget,
        totalSpent,
        totalRemaining,
        percentage: Math.round(percentage * 10) / 10,
        budgetsCount: filtered.length,
        warningCount,
        exceededCount,
        completedCount,
      },
      budgets: filtered,
    };
  }

  private createLocalBudget(data: CreateBudgetDto): BudgetInterface {
    const all = this.getLocalList();
    const month = data.month || this.getCurrentMonth();
    const id = Date.now();
    const type = data.type || "goal";
    const current_amount = 0;
    const spent = 0;
    const remaining = data.amount;
    const percentage = 0;

    const newBudget: BudgetInterface = {
      id,
      category: data.category,
      amount: data.amount,
      current_amount,
      type,
      month,
      notes: data.notes,
      spent,
      remaining,
      percentage,
      status: "normal",
    };

    all.push(newBudget);
    this.saveLocalList(all);
    return newBudget;
  }

  private updateLocalBudget(id: number, data: Partial<CreateBudgetDto>): BudgetInterface {
    const all = this.getLocalList();
    const index = all.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new Error("Presupuesto no encontrado");
    }

    const current = all[index];
    const amount = data.amount !== undefined ? data.amount : current.amount;
    const category = data.category || current.category;
    const type = data.type || current.type || "goal";
    const notes = data.notes !== undefined ? data.notes : current.notes;
    const isGoal = type === "goal";
    const spent = isGoal ? (current.current_amount || 0) : current.spent;
    const remaining = isGoal ? Math.max(0, amount - spent) : (amount - spent);
    const percentage = amount > 0 ? (spent / amount) * 100 : 0;
    let status: "normal" | "warning" | "exceeded" | "completed" = "normal";

    if (isGoal) {
      if (percentage >= 100) status = "completed";
      else if (percentage >= 75) status = "warning";
    } else {
      if (percentage >= 100) status = "exceeded";
      else if (percentage >= 75) status = "warning";
    }

    const updated: BudgetInterface = {
      ...current,
      category,
      amount,
      type,
      notes,
      remaining,
      percentage: Math.round(percentage * 10) / 10,
      status,
      updated_at: new Date().toISOString(),
    };

    all[index] = updated;
    this.saveLocalList(all);
    return updated;
  }

  private contributeLocalBudget(id: number, amount: number): BudgetInterface {
    const all = this.getLocalList();
    const index = all.findIndex((b) => b.id === id);
    if (index === -1) throw new Error("Meta no encontrada");

    const current = all[index];
    const newCurrent = (current.current_amount || 0) + amount;
    const remaining = Math.max(0, current.amount - newCurrent);
    const percentage = current.amount > 0 ? (newCurrent / current.amount) * 100 : 0;
    let status: "normal" | "warning" | "exceeded" | "completed" = "normal";

    if (percentage >= 100) status = "completed";
    else if (percentage >= 75) status = "warning";

    const updated: BudgetInterface = {
      ...current,
      current_amount: newCurrent,
      spent: newCurrent,
      remaining,
      percentage: Math.round(percentage * 10) / 10,
      status,
      updated_at: new Date().toISOString(),
    };

    all[index] = updated;
    this.saveLocalList(all);
    return updated;
  }

  private deleteLocalBudget(id: number): void {
    const all = this.getLocalList().filter((b) => b.id !== id);
    this.saveLocalList(all);
  }
}
