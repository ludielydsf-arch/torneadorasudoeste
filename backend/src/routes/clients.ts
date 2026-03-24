import { Router } from "express"
import prisma from "../db"
import { clientSchema } from "../utils/validation"
import { requireAuth } from "../middleware/auth"

const router = Router()

router.post("/", requireAuth, async (req, res) => {
  const parsed = clientSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", details: parsed.error.format() })
    return
  }
  const data = parsed.data
  if (data.tipo === "PF") {
    const exists = await prisma.client.findUnique({ where: { cpf: data.cpf! } })
    if (exists) {
      res.status(409).json({ error: "cpf_in_use" })
      return
    }
  } else {
    const exists = await prisma.client.findUnique({ where: { cnpj: data.cnpj! } })
    if (exists) {
      res.status(409).json({ error: "cnpj_in_use" })
      return
    }
  }
  const client = await prisma.client.create({
    data: {
      tipo: data.tipo,
      nomeCompleto: data.tipo === "PF" ? data.nomeCompleto : null,
      cpf: data.tipo === "PF" ? data.cpf : null,
      rg: data.tipo === "PF" ? data.rg : null,
      nomeEmpresa: data.tipo === "PJ" ? data.nomeEmpresa : null,
      cnpj: data.tipo === "PJ" ? data.cnpj : null,
      nomeResponsavel: data.tipo === "PJ" ? data.nomeResponsavel : null,
      telefone: data.telefone,
      email: data.email,
      endereco: data.endereco
    }
  })
  res.status(201).json(client)
})

router.get("/", requireAuth, async (req, res) => {
  const { q, cpf, cnpj } = req.query
  const where: any = {}
  if (q && typeof q === "string") {
    where.OR = [
      { nomeCompleto: { contains: q, mode: "insensitive" } },
      { nomeEmpresa: { contains: q, mode: "insensitive" } }
    ]
  }
  if (cpf && typeof cpf === "string") where.cpf = cpf
  if (cnpj && typeof cnpj === "string") where.cnpj = cnpj
  const clients = await prisma.client.findMany({
    where,
    orderBy: { updatedAt: "desc" }
  })
  res.json(clients)
})

router.get("/:id", requireAuth, async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } })
  if (!client) {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.json(client)
})

router.put("/:id", requireAuth, async (req, res) => {
  const parsed = clientSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", details: parsed.error.format() })
    return
  }
  const data = parsed.data
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: {
      tipo: data.tipo,
      nomeCompleto: data.tipo === "PF" ? data.nomeCompleto : null,
      cpf: data.tipo === "PF" ? data.cpf : null,
      rg: data.tipo === "PF" ? data.rg : null,
      nomeEmpresa: data.tipo === "PJ" ? data.nomeEmpresa : null,
      cnpj: data.tipo === "PJ" ? data.cnpj : null,
      nomeResponsavel: data.tipo === "PJ" ? data.nomeResponsavel : null,
      telefone: data.telefone,
      email: data.email,
      endereco: data.endereco
    }
  })
  res.json(client)
})

router.delete("/:id", requireAuth, async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } })
  res.status(204).end()
})

export default router
