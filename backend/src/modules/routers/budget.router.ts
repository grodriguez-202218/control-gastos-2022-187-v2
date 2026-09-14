import { Router } from "express";
import { BudgetController } from "../controllers/budget.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Todas las rutas de presupuestos requieren token válido
router.use(verifyToken);

router.get("/", BudgetController.getBudgets);
router.get("/summary", BudgetController.getSummary);
router.post("/", BudgetController.create);
router.post("/:id/contribute", BudgetController.contribute);
router.get("/:id/contributions", BudgetController.getContributions);
router.put("/:id", BudgetController.update);
router.delete("/:id", BudgetController.delete);

export default router;
