import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel, User } from "../models/user.model";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRY = "24h"; // 🔧 CAMBIO: 1m → 24h

export const AuthService = {
  register: async (data: User) => {
    // Validar que el email no esté registrado
    const existing = await UserModel.findByEmail(data.email);
    if (existing) {
      throw new Error("El correo ya está registrado");
    }

    // Validar contraseña
    if (data.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await UserModel.create({
      ...data,
      password: hashedPassword,
    });

    // Generar token para login automático
    const token = jwt.sign(
      { 
        id: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return {
      token,
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  },

  login: async (email: string, password: string) => {
    // Buscar usuario
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new Error("Credenciales inválidas");
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Credenciales inválidas");
    }

    // Generar JWT con 24h de duración
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }  // 🔧 CAMBIO: 1m → 24h
    );

    return {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    };
  },

  // Verificar y refrescar token si falta poco para expirar
  verifyAndRefreshToken: async (token: string) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return { valid: true, payload: decoded };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return { valid: false, reason: "expired" };
      }
      return { valid: false, reason: "invalid" };
    }
  },

  // Logout (en cliente se elimina el token del localStorage)
  logout: async () => {
    return { message: "Sesión cerrada" };
  },
};