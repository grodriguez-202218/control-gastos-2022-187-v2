import { Response } from "express";
import { TransactionModel } from "../models/transaction.model";

export const TransactionController = {
  create: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const { type, description, category, amount, date, notes } = req.body;

      if (!type || !description || !category || amount === undefined) {
        return res.status(400).json({ success: false, message: "Campos obligatorios faltantes" });
      }

      if (amount <= 0) {
        return res.status(400).json({ success: false, message: "El monto debe ser mayor que cero" });
      }

      const tx = await TransactionModel.create({
        user_id: userId,
        type,
        description,
        category,
        amount,
        date: date || new Date().toISOString().split("T")[0],
        notes: notes || "",
      });

      return res.status(201).json({ success: true, message: "Transacción creada", data: tx });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Error al crear transacción" });
    }
  },

  findAll: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const { type, category, search, page, limit } = req.query;

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 10;

      const filters = {
        type: type as string,
        category: category as string,
        search: search as string,
        page: pageNum,
        limit: limitNum,
      };

      const transactions = await TransactionModel.findAll(userId, filters);
      const total = await TransactionModel.countAll(userId, filters);

      return res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Error al obtener transacciones" });
    }
  },

  update: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" });
      }

      const tx = await TransactionModel.findById(id);
      if (!tx) {
        return res.status(404).json({ success: false, message: "Transacción no encontrada" });
      }

      if (tx.user_id !== userId) {
        return res.status(403).json({ success: false, message: "Acceso no autorizado a esta transacción" });
      }

      const updated = await TransactionModel.update(id, req.body);
      return res.status(200).json({ success: true, message: "Transacción actualizada", data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Error al actualizar transacción" });
    }
  },

  delete: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" });
      }

      const tx = await TransactionModel.findById(id);
      if (!tx) {
        return res.status(404).json({ success: false, message: "Transacción no encontrada" });
      }

      if (tx.user_id !== userId) {
        return res.status(403).json({ success: false, message: "Acceso no autorizado a esta transacción" });
      }

      await TransactionModel.delete(id);
      return res.status(200).json({ success: true, message: "Transacción eliminada" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Error al eliminar transacción" });
    }
  },

  getSummary: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const summary = await TransactionModel.getSummary(userId);
      return res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Error al obtener resumen de transacciones" });
    }
  },

  getCharts: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const chartsData = await TransactionModel.getChartsData(userId);
      return res.status(200).json({ success: true, data: chartsData });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Error al obtener datos de gráficos" });
    }
  }
};
