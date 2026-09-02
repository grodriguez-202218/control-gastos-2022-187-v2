import { pool } from "../../config/db";

export interface Transaction {
  id?: number;
  user_id: number;
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  date: string; 
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface TransactionFilters {
  type?: string;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const TransactionModel = {
  create: async (tx: Transaction): Promise<Transaction> => {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, description, category, amount, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tx.user_id, tx.type, tx.description, tx.category, tx.amount, tx.date || new Date(), tx.notes || ""]
    );
    return result.rows[0];
  },

  findAll: async (userId: number, filters: TransactionFilters): Promise<Transaction[]> => {
    const { type, category, search, startDate, endDate, page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM transactions WHERE user_id = $1`;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (type && type !== "Todos" && type !== "Todas" && type !== "Tipo: Todos") {
      const isIncome = type.toLowerCase() === "ingreso" || type.toLowerCase() === "income";
      query += ` AND type IN ($${paramIndex++}, $${paramIndex++})`;
      params.push(isIncome ? "income" : "expense", isIncome ? "ingreso" : "gasto");
    }

    if (category && category !== "Todas" && category !== "Categoría: Todas") {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND description ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    if (startDate) {
      query += ` AND date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  },

  countAll: async (userId: number, filters: TransactionFilters): Promise<number> => {
    const { type, category, search, startDate, endDate } = filters;

    let query = `SELECT COUNT(*) FROM transactions WHERE user_id = $1`;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (type && type !== "Todos" && type !== "Todas" && type !== "Tipo: Todos") {
      const isIncome = type.toLowerCase() === "ingreso" || type.toLowerCase() === "income";
      query += ` AND type IN ($${paramIndex++}, $${paramIndex++})`;
      params.push(isIncome ? "income" : "expense", isIncome ? "ingreso" : "gasto");
    }

    if (category && category !== "Todas" && category !== "Categoría: Todas") {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND description ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    if (startDate) {
      query += ` AND date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  },

  findById: async (id: number): Promise<Transaction | null> => {
    const result = await pool.query("SELECT * FROM transactions WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  update: async (id: number, tx: Partial<Transaction>): Promise<Transaction | null> => {
    const fields: string[] = [];
    const params: any[] = [];
    let index = 1;

    const allowedFields = ["type", "description", "category", "amount", "date", "notes"];
    for (const key of allowedFields) {
      if (tx[key as keyof Transaction] !== undefined) {
        fields.push(`${key} = $${index++}`);
        params.push(tx[key as keyof Transaction]);
      }
    }

    if (fields.length === 0) return null;

    params.push(id);
    const query = `UPDATE transactions SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${index} RETURNING *`;
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  },

  delete: async (id: number): Promise<boolean> => {
    const result = await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  },

  getSummary: async (userId: number): Promise<{
    balanceTotal: number;
    ingresosTotales: number;
    gastosTotales: number;
    balanceNeto: number;
    presupuestoMensual: number;
    disponibleMensual: number;
  }> => {
    // Calculamos balance acumulado total histórico
    const totalRes = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('income', 'ingreso') THEN amount ELSE 0 END), 0) as total_income,
         COALESCE(SUM(CASE WHEN type IN ('expense', 'gasto') THEN amount ELSE 0 END), 0) as total_expense
       FROM transactions 
       WHERE user_id = $1`,
      [userId]
    );

    const totalIncome = parseFloat(totalRes.rows[0].total_income);
    const totalExpense = parseFloat(totalRes.rows[0].total_expense);
    const balanceTotal = totalIncome - totalExpense;

    const currentMonthRes = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('income', 'ingreso') THEN amount ELSE 0 END), 0) as month_income,
         COALESCE(SUM(CASE WHEN type IN ('expense', 'gasto') THEN amount ELSE 0 END), 0) as month_expense
       FROM transactions 
       WHERE user_id = $1 
         AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)`,
      [userId]
    );

    const monthIncome = parseFloat(currentMonthRes.rows[0].month_income);
    const monthExpense = parseFloat(currentMonthRes.rows[0].month_expense);

    const presupuestoMensual = 8000.00; 
    const disponibleMensual = Math.max(0, presupuestoMensual - monthExpense);

    return {
      balanceTotal,
      ingresosTotales: monthIncome,
      gastosTotales: monthExpense,
      balanceNeto: balanceTotal,
      presupuestoMensual,
      disponibleMensual
    };
  },

  getChartsData: async (userId: number): Promise<{
    cashFlow: { month: string; income: number; expense: number }[];
    categories: { category: string; amount: number; percentage: number }[];
  }> => {
    // Obtener flujo de caja de los últimos 12 meses
    const cashFlowRes = await pool.query(
      `SELECT 
         to_char(date, 'Mon') as month_name,
         date_trunc('month', date) as month_date,
         COALESCE(SUM(CASE WHEN type IN ('income', 'ingreso') THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type IN ('expense', 'gasto') THEN amount ELSE 0 END), 0) as expense
       FROM transactions 
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY month_date, month_name
       ORDER BY month_date ASC`,
      [userId]
    );

    const monthNamesEsMap: Record<string, string> = {
      Jan: "Ene", Feb: "Feb", Mar: "Mar", Apr: "Abr", May: "May", Jun: "Jun",
      Jul: "Jul", Aug: "Ago", Sep: "Sep", Oct: "Oct", Nov: "Nov", Dec: "Dic"
    };

    const cashFlow = cashFlowRes.rows.map((row) => ({
      month: monthNamesEsMap[row.month_name] || row.month_name,
      income: parseFloat(row.income),
      expense: parseFloat(row.expense)
    }));

    //  Obtener gastos por categoría
    const categoriesRes = await pool.query(
      `SELECT 
         category,
         COALESCE(SUM(amount), 0) as amount
       FROM transactions 
       WHERE user_id = $1 AND type IN ('expense', 'gasto')
       GROUP BY category
       ORDER BY amount DESC`,
      [userId]
    );

    const totalExpense = categoriesRes.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const categories = categoriesRes.rows.map((row) => {
      const amount = parseFloat(row.amount);
      return {
        category: row.category,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
      };
    });

    return { cashFlow, categories };
  }
};
