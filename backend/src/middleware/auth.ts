import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

const secret = process.env.JWT_SECRET || "dev-secret"

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header) {
    res.status(401).json({ error: "unauthorized" })
    return
  }
  const token = header.replace("Bearer ", "")
  try {
    const payload = jwt.verify(token, secret) as { userId: string }
    ;(req as any).userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: "invalid_token" })
  }
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, secret, { expiresIn: "7d" })
}
