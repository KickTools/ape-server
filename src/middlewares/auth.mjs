import { verifyToken } from "./token.mjs";

export function authenticateToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.sendStatus(401);

  const user = verifyToken(token);
  if (!user) return res.sendStatus(403);

  req.user = user;
  next();
}
