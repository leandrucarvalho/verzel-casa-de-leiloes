const isProd = process.env.NODE_ENV === "production";

function secret(name: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`${name} is required in production`);
  return `dev-${name.toLowerCase()}`;
}

export const config = {
  jwtSecret: secret("JWT_SECRET"),
  hashSecret: secret("HASH_SECRET"),
};
