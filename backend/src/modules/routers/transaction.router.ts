import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Todas las rutas de transacciones requieren token válido
router.use(verifyToken);

router.post("/", TransactionController.create);
router.get("/", TransactionController.findAll);
router.get("/summary", TransactionController.getSummary);
router.get("/charts", TransactionController.getCharts);
router.put("/:id", TransactionController.update);
router.delete("/:id", TransactionController.delete);

export default router;
