export const APP_CONFIG = {
  name: "Mshwar",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  env: process.env.NODE_ENV || "development",
} as const;
