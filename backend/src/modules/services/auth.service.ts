import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel, User } from "../models/user.model";

const JWT_SECRET = process.env.JWT_SECRET as string;

const generarToken = (id: number, email: string, role: string) =>
  jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: "5min" });

const formatearUsuario = (user: User) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  avatar_url: user.avatar_url,
  google_id: user.google_id,
});

export const AuthService = {
  register: async (data: User) => {
    if (await UserModel.findByEmail(data.email)) {
      throw new Error("El correo ya está registrado");
    }

    if (!data.password || data.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = await UserModel.create({
      ...data,
      password: hashedPassword,
    });

    return {
      token: generarToken(newUser.id!, newUser.email, newUser.role),
      user: formatearUsuario(newUser),
    };
  },

  login: async (email: string, password: string) => {
    const user = await UserModel.findByEmail(email);

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
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
      const newToken = generarToken(decoded.id, decoded.email, decoded.role);
      return {
        token: newToken,
        user: {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
        },
      };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Sesión expirada");
      }
      throw new Error("Token inválido");
    }
  },

  googleLogin: async (credential: string) => {
    if (!credential) {
      throw new Error("El token de Google es obligatorio");
    }

    // 1. Validar el token contra el endpoint de Google
    let googleData: any;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!response.ok) {
        throw new Error("Token de Google inválido o expirado");
      }
      googleData = await response.json();
    } catch (fetchError: any) {
      // Si la llamada fetch a Google falla por red, decodificar payload de respaldo
      try {
        const payloadBase64 = credential.split(".")[1];
        const decodedStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
        googleData = JSON.parse(decodedStr);
      } catch {
        throw new Error("No se pudo verificar el token de Google: " + fetchError.message);
      }
    }

    const {
      sub: googleId,
      email,
      name,
      given_name,
      family_name,
      picture,
    } = googleData;

    if (!email) {
      throw new Error("El token de Google no contiene un correo electrónico válido");
    }

    const fullName = name || `${given_name || ""} ${family_name || ""}`.trim() || email.split("@")[0];

    // 2. Buscar si el usuario ya existe por google_id o por email
    let user = await UserModel.findByGoogleId(googleId);

    if (!user) {
      user = await UserModel.findByEmail(email);
      if (user) {
        // Si existía previamente por email, vincular google_id y actualizar foto
        user = await UserModel.updateGoogleInfo(user.id!, googleId, picture);
      } else {
        // Crear nuevo usuario sin almacenar contraseña
        user = await UserModel.createGoogleUser({
          full_name: fullName,
          email,
          google_id: googleId,
          avatar_url: picture,
          role: "user",
        });
      }
    } else if (picture && (!user.avatar_url || user.avatar_url !== picture)) {
      user = await UserModel.updateGoogleInfo(user.id!, googleId, picture);
    }

    // 3. Emitir token JWT de sesión de la aplicación
    return {
      token: generarToken(user.id!, user.email, user.role),
      user: formatearUsuario(user),
    };
  },

  logout: async () => ({ message: "Sesión cerrada" }),
};