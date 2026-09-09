import { pool } from "../../config/db";

export interface Budget {
  id?: number;
  user_id: number;
  category: string;
  amount: number;
  current_amount?: number;
  type?: "goal" | "expense_limit";
  month: string; // 'YYYY-MM'
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  spent?: number;
  remaining?: number;
  percentage?: number;
  status?: "normal" | "warning" | "exceeded" | "completed";
}

export interface BudgetContribution {
  id: number;
  budget_id: number;
  user_id: number;
  amount: number;
  date: string;
  notes?: string | null;
  created_at?: string;
}

export interface BudgetSummary {
  month: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  percentage: number;
  budgetsCount: number;
  warningCount: number;
  exceededCount: number;
  completedCount: number;
}

export const BudgetModel = {
  findByUserAndMonth: async (userId: number, month: string): Promise<Budget[]> => {
    // 1. Obtener presupuestos y metas del usuario
    const budgetsQuery = `
      SELECT id, user_id, category, amount, 
             COALESCE(current_amount, 0) as current_amount,
             COALESCE(type, 'goal') as type,
             month, notes, created_at, updated_at
      FROM budgets
      WHERE user_id = $1 AND month = $2
      ORDER BY amount DESC
    `;
    const budgetsRes = await pool.query(budgetsQuery, [userId, month]);

    // 2. Obtener gastos reales por categoría para el mismo mes
    const expensesQuery = `
      SELECT category, COALESCE(SUM(amount), 0) as spent
      FROM transactions
      WHERE user_id = $1
        AND to_char(date, 'YYYY-MM') = $2
        AND type IN ('expense', 'gasto')
      GROUP BY category
    `;
    const expensesRes = await pool.query(expensesQuery, [userId, month]);

    const expensesMap = new Map<string, number>();
    for (const row of expensesRes.rows) {
      expensesMap.set(row.category.toLowerCase(), parseFloat(row.spent));
    }

    return budgetsRes.rows.map((row) => {
      const amount = parseFloat(row.amount);
      const currentAmount = parseFloat(row.current_amount || "0");
      const isGoal = row.type !== "expense_limit";

      let spent: number;
      let remaining: number;
      let percentage: number;
      let status: "normal" | "warning" | "exceeded" | "completed" = "normal";

      if (isGoal) {
        spent = currentAmount;
        remaining = Math.max(0, amount - currentAmount);
        percentage = amount > 0 ? (currentAmount / amount) * 100 : 0;

        if (percentage >= 100) {
          status = "completed";
        } else if (percentage >= 75) {
          status = "warning";
        }
      } else {
        spent = expensesMap.get(row.category.toLowerCase()) || 0;
        remaining = amount - spent;
        percentage = amount > 0 ? (spent / amount) * 100 : 0;

        if (percentage >= 100) {
          status = "exceeded";
        } else if (percentage >= 75) {
          status = "warning";
        }
      }

      return {
        id: row.id,
        user_id: row.user_id,
        category: row.category,
        amount,
        current_amount: currentAmount,
        type: row.type as "goal" | "expense_limit",
        month: row.month,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        spent,
        remaining,
        percentage: Math.round(percentage * 10) / 10,
        status,
      };
    });
  },

  findById: async (id: number, userId: number): Promise<Budget | null> => {
    const result = await pool.query(
      "SELECT *, COALESCE(current_amount, 0) as current_amount, COALESCE(type, 'goal') as type FROM budgets WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      amount: parseFloat(row.amount),
      current_amount: parseFloat(row.current_amount),
    };
  },

  upsert: async (data: {
    user_id: number;
    category: string;
    amount: number;
    month: string;
    type?: "goal" | "expense_limit";
    notes?: string;
  }): Promise<Budget> => {
    const query = `
      INSERT INTO budgets (user_id, category, amount, month, type, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, category, month)
      DO UPDATE SET
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING id, user_id, category, amount, current_amount, type, month, notes, created_at, updated_at
    `;
    const result = await pool.query(query, [
      data.user_id,
      data.category,
      data.amount,
      data.month,
      data.type || "goal",
      data.notes || null,
    ]);
    const row = result.rows[0];
    return {
      ...row,
      amount: parseFloat(row.amount),
      current_amount: parseFloat(row.current_amount || "0"),
    };
  },

  update: async (
    id: number,
    userId: number,
    data: { amount?: number; category?: string; type?: "goal" | "expense_limit"; notes?: string }
  ): Promise<Budget | null> => {
    const query = `
      UPDATE budgets
      SET
        amount = COALESCE($1, amount),
        category = COALESCE($2, category),
        type = COALESCE($3, type),
        notes = COALESCE($4, notes),
        updated_at = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING id, user_id, category, amount, current_amount, type, month, notes, created_at, updated_at
    `;
    const result = await pool.query(query, [
      data.amount ?? null,
      data.category ?? null,
      data.type ?? null,
      data.notes ?? null,
      id,
      userId,
    ]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      amount: parseFloat(row.amount),
      current_amount: parseFloat(row.current_amount || "0"),
    };
  },

  delete: async (id: number, userId: number): Promise<boolean> => {
    const result = await pool.query(
      "DELETE FROM budgets WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  addContribution: async (
    budgetId: number,
    userId: number,
    amount: number,
    notes?: string,
    date?: string
  ): Promise<{ contribution: BudgetContribution; budget: Budget }> => {
    // 1. Insertar el abono
    const contribQuery = `
      INSERT INTO budget_contributions (budget_id, user_id, amount, notes, date)
      VALUES ($1, $2, $3, $4, COALESCE($5::DATE, CURRENT_DATE))
      RETURNING id, budget_id, user_id, amount, date, notes, created_at
    `;
    const contribRes = await pool.query(contribQuery, [
      budgetId,
      userId,
      amount,
      notes || null,
      date || null,
    ]);

    // 2. Incrementar current_amount en budgets
    const updateBudgetQuery = `
      UPDATE budgets
      SET current_amount = COALESCE(current_amount, 0) + $1,
          updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING id, user_id, category, amount, current_amount, type, month, notes, created_at, updated_at
    `;
    const budgetRes = await pool.query(updateBudgetQuery, [amount, budgetId, userId]);

    const contribRow = contribRes.rows[0];
    const budgetRow = budgetRes.rows[0];

    return {
      contribution: {
        ...contribRow,
        amount: parseFloat(contribRow.amount),
      },
      budget: {
        ...budgetRow,
        amount: parseFloat(budgetRow.amount),
        current_amount: parseFloat(budgetRow.current_amount),
      },
    };
  },

  getContributions: async (budgetId: number, userId: number): Promise<BudgetContribution[]> => {
    const query = `
      SELECT id, budget_id, user_id, amount, date, notes, created_at
      FROM budget_contributions
      WHERE budget_id = $1 AND user_id = $2
      ORDER BY date DESC, created_at DESC
    `;
    const res = await pool.query(query, [budgetId, userId]);
    return res.rows.map((row) => ({
      ...row,
      amount: parseFloat(row.amount),
    }));
  },

  getSummary: async (userId: number, month: string): Promise<BudgetSummary> => {
    const budgets = await BudgetModel.findByUserAndMonth(userId, month);

    const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);
    const totalSpent = budgets.reduce((acc, b) => acc + (b.spent || 0), 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const warningCount = budgets.filter((b) => b.status === "warning").length;
    const exceededCount = budgets.filter((b) => b.status === "exceeded").length;
    const completedCount = budgets.filter((b) => b.status === "completed").length;

    return {
      month,
      totalBudget,
      totalSpent,
      totalRemaining,
      percentage: Math.round(percentage * 10) / 10,
      budgetsCount: budgets.length,
      warningCount,
      exceededCount,
      completedCount,
    };
  },
};
