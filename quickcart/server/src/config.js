const defaultCorsOrigins = "http://localhost:5173,http://localhost:5174";

const config = {
  port: Number(process.env.PORT) || 4000,
  corsOrigins: (process.env.CORS_ORIGINS || defaultCorsOrigins)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export default config;
