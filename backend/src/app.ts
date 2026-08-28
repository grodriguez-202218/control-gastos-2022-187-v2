import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRouter from "./modules/routers/auth.router";
import transactionRouter from "./modules/routers/transaction.router";
import { initDatabase } from "./config/initDb";

dotenv.config();

const app = express();

app.use(cors({
  origin: [process.env.FRONTEND_URL || "http://localhost:4200", "http://localhost:4200"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.on("mount", async () => {
  try {
    await initDatabase();
    console.log(" Base de datos inicializada");
  } catch (error) {
    console.error("Error inicializando BD:", error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionRouter);

app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Ruta no encontrada",
    path: req.path,
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Error interno del servidor",
  });
});

export default app;