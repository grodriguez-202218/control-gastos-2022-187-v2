import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel, User } from "../models/user.model";

const JWT_SECRET = process.env.JWT_SECRET as string;

const generarToken = (id: number, email: string, role: string) =>
  jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: "1min" });

const formatearUsuario = (user: User) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
});

export const AuthService = {
  register: async (data: User) => {
    if (await UserModel.findByEmail(data.email)) {
      throw new Error("El correo ya está registrado");
    }

    if (data.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    const newUser = await UserModel.create({
      ...data,
      password: await bcrypt.hash(data.password, 10),
    });

    return {
      token: generarToken(newUser.id!, newUser.email, newUser.role),
      user: formatearUsuario(newUser),
    };
  },

  login: async (email: string, password: string) => {
    const user = await UserModel.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Credenciales inválidas");
    }

    return {
      token: generarToken(user.id!, user.email, user.role),
      user: formatearUsuario(user),
    };
  },

  verifyAndRefreshToken: async (token: string) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return { valid: true, payload: decoded };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Sesión expirada");
      }
      throw new Error("Token inválido");
    }
  },

  logout: async () => ({ message: "Sesión cerrada" }),
};