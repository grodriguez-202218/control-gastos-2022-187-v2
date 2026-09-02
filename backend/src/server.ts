import dotenv from "dotenv";
import app from "./app";
import { initDatabase } from "./config/initDb";

dotenv.config();

const PORT = process.env.PORT || 3000;

// Inicializar base de datos y arrancar servidor
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error crítico inicializando base de datos:", error);
    process.exit(1);
  });