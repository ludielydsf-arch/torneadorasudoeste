import { Router } from "express"
import prisma from "../db"
import bcrypt from "bcryptjs"
import { signToken } from "../middleware/auth"

const router = Router()

router.post("/register", async (req, res) => {
  const { email, name, password } = req.body || {}
  if (!email || !name || !password) {
    res.status(400).json({ error: "invalid_input" })
    return
  }
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    res.status(409).json({ error: "email_in_use" })
    return
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { email, name, password: hash } })
  const token = signToken(user.id)
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    res.status(400).json({ error: "invalid_input" })
    return
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: "invalid_credentials" })
    return
  }
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    res.status(401).json({ error: "invalid_credentials" })
    return
  }
  const token = signToken(user.id)
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

export default router
