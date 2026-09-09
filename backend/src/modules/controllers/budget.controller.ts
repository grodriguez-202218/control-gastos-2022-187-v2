import { Request, Response } from "express";
import { BudgetModel } from "../models/budget.model";

const getCurrentMonthString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const BudgetController = {
  getBudgets: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const month = (req.query.month as string) || getCurrentMonthString();
      const budgets = await BudgetModel.findByUserAndMonth(userId, month);
      const summary = await BudgetModel.getSummary(userId, month);

      return res.status(200).json({
        month,
        summary,
        budgets,
      });
    } catch (error: any) {
      console.error("Error al obtener presupuestos:", error);
      return res.status(500).json({ message: "Error al obtener presupuestos" });
    }
  },

  getSummary: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const month = (req.query.month as string) || getCurrentMonthString();
      const summary = await BudgetModel.getSummary(userId, month);

      return res.status(200).json(summary);
    } catch (error: any) {
      console.error("Error al obtener resumen de presupuestos:", error);
      return res.status(500).json({ message: "Error al obtener resumen de presupuestos" });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const { category, amount, month, type, notes } = req.body;

      if (!category || typeof category !== "string") {
        return res.status(400).json({ message: "La categoría es obligatoria" });
      }

      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "El monto debe ser un número positivo" });
      }

      const budgetMonth = month || getCurrentMonthString();
      const budgetType = type === "expense_limit" ? "expense_limit" : "goal";

      const budget = await BudgetModel.upsert({
        user_id: userId,
        category: category.trim(),
        amount: numericAmount,
        month: budgetMonth,
        type: budgetType,
        notes,
      });

      return res.status(201).json({
        message: "Presupuesto guardado con éxito",
        budget,
      });
    } catch (error: any) {
      console.error("Error al guardar presupuesto:", error);
      return res.status(500).json({ message: "Error al guardar presupuesto" });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const budgetId = parseInt(req.params.id, 10);
      if (isNaN(budgetId)) {
        return res.status(400).json({ message: "ID de presupuesto inválido" });
      }

      const { category, amount, type, notes } = req.body;
      const updateData: { category?: string; amount?: number; type?: "goal" | "expense_limit"; notes?: string } = {};

      if (category) updateData.category = category.trim();
      if (type) updateData.type = type === "expense_limit" ? "expense_limit" : "goal";
      if (amount !== undefined) {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
          return res.status(400).json({ message: "El monto debe ser un número positivo" });
        }
        updateData.amount = numericAmount;
      }
      if (notes !== undefined) updateData.notes = notes;

      const updated = await BudgetModel.update(budgetId, userId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Presupuesto no encontrado" });
      }

      return res.status(200).json({
        message: "Presupuesto actualizado con éxito",
        budget: updated,
      });
    } catch (error: any) {
      console.error("Error al actualizar presupuesto:", error);
      return res.status(500).json({ message: "Error al actualizar presupuesto" });
    }
  },

  contribute: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const budgetId = parseInt(req.params.id, 10);
      if (isNaN(budgetId)) {
        return res.status(400).json({ message: "ID de presupuesto/meta inválido" });
      }

      const { amount, notes, date } = req.body;
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "El monto a abonar debe ser un número positivo" });
      }

      const budget = await BudgetModel.findById(budgetId, userId);
      if (!budget) {
        return res.status(404).json({ message: "Meta o presupuesto no encontrado" });
      }

      const result = await BudgetModel.addContribution(budgetId, userId, numericAmount, notes, date);

      return res.status(201).json({
        message: "Abono registrado con éxito",
        contribution: result.contribution,
        budget: result.budget,
      });
    } catch (error: any) {
      console.error("Error al registrar abono:", error);
      return res.status(500).json({ message: "Error al registrar abono" });
    }
  },

  getContributions: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const budgetId = parseInt(req.params.id, 10);
      if (isNaN(budgetId)) {
        return res.status(400).json({ message: "ID de presupuesto/meta inválido" });
      }

      const contributions = await BudgetModel.getContributions(budgetId, userId);
      return res.status(200).json(contributions);
    } catch (error: any) {
      console.error("Error al obtener abonos:", error);
      return res.status(500).json({ message: "Error al obtener historial de abonos" });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const budgetId = parseInt(req.params.id, 10);
      if (isNaN(budgetId)) {
        return res.status(400).json({ message: "ID de presupuesto inválido" });
      }

      const deleted = await BudgetModel.delete(budgetId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Presupuesto no encontrado" });
      }

      return res.status(200).json({ message: "Presupuesto eliminado con éxito" });
    } catch (error: any) {
      console.error("Error al eliminar presupuesto:", error);
      return res.status(500).json({ message: "Error al eliminar presupuesto" });
    }
  },
};
