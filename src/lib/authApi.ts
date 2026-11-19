import {
  apiRequest,
  clearAccessToken,
  refreshSession,
  setAccessToken,
  type TokenPayload,
  type User,
} from "./api";

export type { TokenPayload, User } from "./api";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
  email?: string;
  current_password?: string;
}

export interface ChangePasswordInput {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface ResetPasswordInput {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface MessageResponse {
  message: string;
}

function storeToken(payload: TokenPayload): TokenPayload {
  setAccessToken(payload.access_token);
  return payload;
}

export async function login(
  email: string,
  password: string,
): Promise<TokenPayload> {
  return storeToken(
    await apiRequest<TokenPayload>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  );
}

export async function register(input: RegisterInput): Promise<TokenPayload> {
  return storeToken(
    await apiRequest<TokenPayload>("/auth/register", {
      method: "POST",
      body: input,
    }),
  );
}

/** Restores the session from the refresh cookie (single-flight). */
export function refresh(): Promise<TokenPayload> {
  return refreshSession();
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}

export async function logoutAll(): Promise<void> {
  try {
    await apiRequest<void>("/auth/logout-all", { method: "POST" });
  } finally {
    clearAccessToken();
  }
}

export async function me(): Promise<User> {
  const { data } = await apiRequest<{ data: User }>("/auth/me");
  return data;
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const { data } = await apiRequest<{ data: User }>("/users/me", {
    method: "PATCH",
    body: input,
  });
  return data;
}

/** Changing the password revokes other sessions and returns a fresh pair. */
export async function changePassword(
  input: ChangePasswordInput,
): Promise<TokenPayload> {
  return storeToken(
    await apiRequest<TokenPayload>("/users/me/password", {
      method: "PUT",
      body: input,
    }),
  );
}

export function forgotPassword(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(
  input: ResetPasswordInput,
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: input,
  });
}

export function resendVerificationEmail(): Promise<
  MessageResponse | undefined
> {
  return apiRequest<MessageResponse | undefined>("/auth/email/resend", {
    method: "POST",
  });
}
