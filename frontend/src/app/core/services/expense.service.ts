import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

const API_URL = "http://localhost:3000/api/transactions";

export interface ExpenseInterface {
  id?: number;
  user_id?: number;
  type: "income" | "expense" | "ingreso" | "gasto" | string;
  description: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExpenseSummaryInterface {
  balanceTotal: number;
  ingresosTotales: number;
  gastosTotales: number;
  balanceNeto: number;
  presupuestoMensual: number;
  disponibleMensual: number;
}

export interface MonthData {
  month: string;
  income: number;
  expense: number;
  amount: number; 
}

export interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

@Injectable({
  providedIn: "root",
})
export class ExpenseService {
  constructor(private http: HttpClient) {}

  // Se añade userId opcional para mantener compatibilidad con dashboard-admin
  getAll = (userId?: number, filters: any = {}): Observable<ExpenseInterface[]> => {
    let params: any = { ...filters };
    return this.http.get<any>(API_URL, { params }).pipe(
      map((res) => res.data || [])
    );
  };

  getPaginated = (filters: any = {}): Observable<any> => {
    return this.http.get<any>(API_URL, { params: filters });
  };

  getSummary = (userId?: number): Observable<ExpenseSummaryInterface> => {
    return this.http.get<any>(`${API_URL}/summary`).pipe(
      map((res) => res.data)
    );
  };

  getChartsData = (): Observable<{ cashFlow: MonthData[]; categories: CategoryData[] }> => {
    return this.http.get<any>(`${API_URL}/charts`).pipe(
      map((res) => res.data)
    );
  };

  // Compatibilidad con los nombres viejos usados en admin-dashboard
  getIncomeByMonth = (userId?: number): Observable<MonthData[]> => {
    return this.getChartsData().pipe(
      map((data) =>
        data.cashFlow.map((item) => ({
          ...item,
          amount: item.income, // compatibilidad con el gráfico
        }))
      )
    );
  };

  getExpenseByCategory = (userId?: number): Observable<CategoryData[]> => {
    return this.getChartsData().pipe(
      map((data) => data.categories)
    );
  };

  create = (data: ExpenseInterface): Observable<any> => {
    // Asegurar que el monto sea un número
    const payload = { ...data, amount: Number(data.amount) };
    return this.http.post<any>(API_URL, payload);
  };

  update = (id: number, data: Partial<ExpenseInterface>): Observable<any> => {
    const payload = { ...data };
    if (payload.amount !== undefined) {
      payload.amount = Number(payload.amount);
    }
    return this.http.put<any>(`${API_URL}/${id}`, payload);
  };

  delete = (id: number): Observable<any> => {
    return this.http.delete<any>(`${API_URL}/${id}`);
  };
}
