import { pool } from "../../config/db";

export interface User {
  id?: number;
  full_name: string;
  email: string;
  password: string;
  role: "user" | "admin";
}

export const UserModel = {
  findByEmail: async (email: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
  },

  create: async (user: User): Promise<User> => {
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [user.full_name, user.email, user.password, user.role]
    );
    return result.rows[0];
  },

  findAll: async (): Promise<User[]> => {
    const result = await pool.query(
      "SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    return result.rows;
  },
};