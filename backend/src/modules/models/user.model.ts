import { pool } from "../../config/db";

export interface User {
  id?: number;
  full_name: string;
  email: string;
  password?: string | null;
  role: "user" | "admin";
  google_id?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export const UserModel = {
  findByEmail: async (email: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
  },

  findByGoogleId: async (googleId: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
    return result.rows[0] || null;
  },

  create: async (user: User): Promise<User> => {
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, google_id, avatar_url`,
      [user.full_name, user.email, user.password, user.role]
    );
    return result.rows[0];
  },

  createGoogleUser: async (data: {
    full_name: string;
    email: string;
    google_id: string;
    avatar_url?: string;
    role?: "user" | "admin";
  }): Promise<User> => {
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role, google_id, avatar_url)
       VALUES ($1, $2, NULL, $3, $4, $5)
       RETURNING id, full_name, email, role, google_id, avatar_url`,
      [data.full_name, data.email, data.role || "user", data.google_id, data.avatar_url || null]
    );
    return result.rows[0];
  },

  updateGoogleInfo: async (id: number, googleId: string, avatarUrl?: string): Promise<User> => {
    const result = await pool.query(
      `UPDATE users
       SET google_id = COALESCE(google_id, $2),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, full_name, email, role, google_id, avatar_url`,
      [id, googleId, avatarUrl || null]
    );
    return result.rows[0];
  },

  findAll: async (): Promise<User[]> => {
    const result = await pool.query(
      "SELECT id, full_name, email, role, google_id, avatar_url, created_at FROM users ORDER BY created_at DESC"
    );
    return result.rows;
  },
};