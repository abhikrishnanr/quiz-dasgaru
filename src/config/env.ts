import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().trim().min(1),
  NEXT_PUBLIC_DEFAULT_SESSION_ID: z.string().trim().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  ADMIN_SECRET: z.string().trim().min(1),
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_DEFAULT_SESSION_ID: process.env.NEXT_PUBLIC_DEFAULT_SESSION_ID,
});

/**
 * Server-only env accessor.
 *
 * IMPORTANT: do not import/use this in client components.
 * Use only in server route handlers (e.g. app/api/[...]/route.ts).
 */
export const getServerEnv = () => {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must only be used on the server.");
  }

  return serverEnvSchema.parse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_DEFAULT_SESSION_ID: process.env.NEXT_PUBLIC_DEFAULT_SESSION_ID,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
  });
};
