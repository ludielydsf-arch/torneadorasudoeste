import { Router } from "express"
import prisma from "../db"
import { requireAuth } from "../middleware/auth"
import { budgetCreateSchema, budgetEditSchema, statusSchema } from "../utils/validation"
import PDFDocument from "pdfkit"
import { format } from "date-fns"

const router = Router()

async function nextSeqForClient(clientId: string) {
  const count = await prisma.budget.count({ where: { clientId } })
  return count + 1
}

function calcTotals(items: { quantidade: number; valorUnit: number }[]) {
  const mapped = items.map(i => ({
    quantidade: i.quantidade,
    valorUnit: i.valorUnit,
    valorTotal: i.quantidade * i.valorUnit
  }))
  const totalGeral = mapped.reduce((sum, i) => sum + i.valorTotal, 0)
  return { mapped, totalGeral }
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = budgetCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", details: parsed.error.format() })
    return
  }
  const { clientId, items } = parsed.data
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) {
    res.status(404).json({ error: "client_not_found" })
    return
  }
  const seq = await nextSeqForClient(clientId)
  const chave = `${clientId}-${seq}`
  const totals = calcTotals(items)
  const created = await prisma.$transaction(async tx => {
    const budget = await tx.budget.create({
      data: {
        clientId,
        numeroSequencial: seq,
        numeroSequencialChave: chave,
        totalGeral: totals.totalGeral
      }
    })
    await tx.budgetItem.createMany({
      data: totals.mapped.map(i => ({
        budgetId: budget.id,
        descricao: items[totals.mapped.indexOf(i)].descricao,
        quantidade: i.quantidade,
        valorUnit: i.valorUnit,
        valorTotal: i.valorTotal
      }))
    })
    return budget
  })
  const full = await prisma.budget.findUnique({
    where: { id: created.id },
    include: { client: true, items: true }
  })
  res.status(201).json(full)
})

router.get("/", requireAuth, async (req, res) => {
  const { q, cpf, cnpj, date, startDate, endDate, month, year, status } = req.query
  const where: any = {}
  if (status && typeof status === "string") where.status = status
  const dateFilters: any = {}
  function parseDt(v: any) {
    if (v && typeof v === "string") {
      const d = new Date(v)
      if (!isNaN(d.getTime())) return d
    }
    return undefined
  }
  const d = parseDt(date)
  const sd = parseDt(startDate)
  const ed = parseDt(endDate)
  if (d) {
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    dateFilters.gte = start
    dateFilters.lte = end
  }
  if (sd) dateFilters.gte = sd
  if (ed) dateFilters.lte = ed
  if (month && year && typeof month === "string" && typeof year === "string") {
    const m = parseInt(month, 10) - 1
    const y = parseInt(year, 10)
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
    dateFilters.gte = start
    dateFilters.lte = end
  } else if (year && typeof year === "string") {
    const y = parseInt(year, 10)
    const start = new Date(y, 0, 1)
    const end = new Date(y, 11, 31, 23, 59, 59, 999)
    dateFilters.gte = start
    dateFilters.lte = end
  }
  if (Object.keys(dateFilters).length > 0) where.dataCriacao = dateFilters
  const clientWhere: any = {}
  if (q && typeof q === "string") {
    clientWhere.OR = [
      { nomeCompleto: { contains: q, mode: "insensitive" } },
      { nomeEmpresa: { contains: q, mode: "insensitive" } }
    ]
  }
  if (cpf && typeof cpf === "string") clientWhere.cpf = cpf
  if (cnpj && typeof cnpj === "string") clientWhere.cnpj = cnpj
  const budgets = await prisma.budget.findMany({
    where,
    include: { client: { where: clientWhere }, items: true },
    orderBy: { dataCriacao: "desc" }
  })
  const filtered = budgets.filter(b => b.client !== null)
  res.json(filtered)
})

router.get("/:id", requireAuth, async (req, res) => {
  const budget = await prisma.budget.findUnique({
    where: { id: req.params.id },
    include: { client: true, items: true }
  })
  if (!budget) {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.json(budget)
})

router.put("/:id", requireAuth, async (req, res) => {
  const parsed = budgetEditSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", details: parsed.error.format() })
    return
  }
  const { items } = parsed.data
  const totals = calcTotals(items)
  const updated = await prisma.$transaction(async tx => {
    await tx.budgetItem.deleteMany({ where: { budgetId: req.params.id } })
    await tx.budgetItem.createMany({
      data: totals.mapped.map((i, idx) => ({
        budgetId: req.params.id,
        descricao: items[idx].descricao,
        quantidade: i.quantidade,
        valorUnit: i.valorUnit,
        valorTotal: i.valorTotal
      }))
    })
    const b = await tx.budget.update({
      where: { id: req.params.id },
      data: { totalGeral: totals.totalGeral }
    })
    return b
  })
  const full = await prisma.budget.findUnique({
    where: { id: updated.id },
    include: { client: true, items: true }
  })
  res.json(full)
})

router.delete("/:id", requireAuth, async (req, res) => {
  await prisma.$transaction([
    prisma.budgetItem.deleteMany({ where: { budgetId: req.params.id } }),
    prisma.budget.delete({ where: { id: req.params.id } })
  ])
  res.status(204).end()
})

router.post("/:id/duplicate", requireAuth, async (req, res) => {
  const orig = await prisma.budget.findUnique({ where: { id: req.params.id }, include: { items: true } })
  if (!orig) {
    res.status(404).json({ error: "not_found" })
    return
  }
  const seq = await nextSeqForClient(orig.clientId)
  const chave = `${orig.clientId}-${seq}`
  const created = await prisma.$transaction(async tx => {
    const b = await tx.budget.create({
      data: {
        clientId: orig.clientId,
        numeroSequencial: seq,
        numeroSequencialChave: chave,
        status: "PENDENTE",
        totalGeral: orig.totalGeral
      }
    })
    await tx.budgetItem.createMany({
      data: orig.items.map(i => ({
        budgetId: b.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnit: i.valorUnit,
        valorTotal: i.valorTotal
      }))
    })
    return b
  })
  const full = await prisma.budget.findUnique({
    where: { id: created.id },
    include: { client: true, items: true }
  })
  res.status(201).json(full)
})

router.patch("/:id/status", requireAuth, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", details: parsed.error.format() })
    return
  }
  const { status, nfNumero, pedidoCompraNumero } = parsed.data
  if (status === "REALIZADO") {
    if (!nfNumero || !pedidoCompraNumero) {
      res.status(400).json({ error: "missing_fields_realizado" })
      return
    }
  }
  const b = await prisma.budget.update({
    where: { id: req.params.id },
    data: {
      status,
      nfNumero: status === "REALIZADO" ? nfNumero ?? null : null,
      pedidoCompraNumero: status === "REALIZADO" ? pedidoCompraNumero ?? null : null
    },
    include: { client: true, items: true }
  })
  res.json(b)
})

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const b = await prisma.budget.findUnique({
    where: { id: req.params.id },
    include: { client: true, items: true }
  })
  if (!b) {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `inline; filename=orcamento-${b.numeroSequencial}.pdf`)
  const doc = new PDFDocument({ margin: 40 })
  doc.pipe(res)
  doc.fontSize(18).text("Orçamento", { align: "center" })
  doc.moveDown()
  doc.fontSize(12).text(`Número: ${b.numeroSequencial}`)
  doc.text(`Data de emissão: ${format(b.dataCriacao, "dd/MM/yyyy")}`)
  doc.text(`Status: ${b.status}`)
  doc.moveDown()
  const c = b.client
  if (c.tipo === "PF") {
    doc.text(`Cliente: ${c.nomeCompleto}`)
    doc.text(`CPF: ${c.cpf}`)
    doc.text(`RG: ${c.rg}`)
  } else {
    doc.text(`Empresa: ${c.nomeEmpresa}`)
    doc.text(`CNPJ: ${c.cnpj}`)
    doc.text(`Responsável: ${c.nomeResponsavel}`)
  }
  doc.text(`Telefone: ${c.telefone}`)
  doc.text(`Email: ${c.email}`)
  doc.text(`Endereço: ${c.endereco}`)
  doc.moveDown()
  doc.text("Serviços")
  doc.moveDown(0.5)
  b.items.forEach(i => {
    doc.text(`${i.descricao}`)
    doc.text(`Qtd: ${i.quantidade}  Valor unitário: R$ ${Number(i.valorUnit).toFixed(2)}  Total: R$ ${Number(i.valorTotal).toFixed(2)}`)
    doc.moveDown(0.5)
  })
  doc.moveDown()
  doc.fontSize(14).text(`Total geral: R$ ${Number(b.totalGeral).toFixed(2)}`, { align: "right" })
  doc.end()
})

router.get("/dashboard/metrics", requireAuth, async (req, res) => {
  const { clientId, startDate, endDate, month, year } = req.query
  const where: any = {}
  if (clientId && typeof clientId === "string") where.clientId = clientId
  const dateFilters: any = {}
  function parseDt(v: any) {
    if (v && typeof v === "string") {
      const d = new Date(v)
      if (!isNaN(d.getTime())) return d
    }
    return undefined
  }
  const sd = parseDt(startDate)
  const ed = parseDt(endDate)
  if (month && year && typeof month === "string" && typeof year === "string") {
    const m = parseInt(month, 10) - 1
    const y = parseInt(year, 10)
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
    dateFilters.gte = start
    dateFilters.lte = end
  } else {
    if (sd) dateFilters.gte = sd
    if (ed) dateFilters.lte = ed
  }
  if (Object.keys(dateFilters).length > 0) where.dataCriacao = dateFilters
  const totalCriados = await prisma.budget.count({ where })
  const totalAprovados = await prisma.budget.count({ where: { ...where, status: "APROVADO" } })
  const totalRealizados = await prisma.budget.count({ where: { ...where, status: "REALIZADO" } })
  const realizados = await prisma.budget.findMany({
    where: { ...where, status: "REALIZADO" },
    select: { totalGeral: true }
  })
  const somaValoresRealizados = realizados.reduce((sum, b) => sum + Number(b.totalGeral), 0)
  res.json({ totalCriados, totalAprovados, totalRealizados, somaValoresRealizados })
})

export default router
