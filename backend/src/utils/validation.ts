import { z } from "zod"

export const clientPFSchema = z.object({
  tipo: z.literal("PF"),
  nomeCompleto: z.string().min(1),
  cpf: z.string().min(11),
  rg: z.string().min(1),
  telefone: z.string().min(1),
  email: z.string().email(),
  endereco: z.string().min(1)
})

export const clientPJSchema = z.object({
  tipo: z.literal("PJ"),
  nomeEmpresa: z.string().min(1),
  cnpj: z.string().min(14),
  nomeResponsavel: z.string().min(1),
  telefone: z.string().min(1),
  email: z.string().email(),
  endereco: z.string().min(1)
})

export const clientSchema = z.union([clientPFSchema, clientPJSchema])

export const budgetItemSchema = z.object({
  descricao: z.string().min(1),
  quantidade: z.number().int().positive(),
  valorUnit: z.number().positive()
})

export const budgetCreateSchema = z.object({
  clientId: z.string().min(1),
  items: z.array(budgetItemSchema).min(1)
})

export const budgetEditSchema = z.object({
  items: z.array(budgetItemSchema).min(1)
})

export const statusSchema = z.object({
  status: z.enum(["PENDENTE", "APROVADO", "REALIZADO"]),
  nfNumero: z.string().optional(),
  pedidoCompraNumero: z.string().optional()
})
