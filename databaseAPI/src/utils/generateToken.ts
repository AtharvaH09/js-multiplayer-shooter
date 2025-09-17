import jwt from "jsonwebtoken";

export const generateToken = (id: string, username: string) => {
  return jwt.sign(
    { id, username },                   // payload
    process.env.JWT_SECRET as string,   // secret from .env
    { expiresIn: "7d" }                 // token expiry
  );
};