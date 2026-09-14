export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

export interface GoogleTokenPayload {
  iss?: string;
  nbf?: number;
  aud?: string;
  sub: string; // Google ID
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string; // Nombre
  family_name?: string; // Apellido
  picture?: string; // Foto de perfil
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface GoogleUser {
  googleId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  picture: string;
}
