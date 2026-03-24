import express from "express"
import cors from "cors"
import authRouter from "./routes/auth"
import clientsRouter from "./routes/clients"
import budgetsRouter from "./routes/budgets"

const app = express()
app.use(cors())
app.use(express.json())

app.use("/auth", authRouter)
app.use("/clients", clientsRouter)
app.use("/budgets", budgetsRouter)

app.get("/health", (_, res) => {
  res.json({ ok: true })
})

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001
app.listen(port, () => {
  process.stdout.write(`API running on http://localhost:${port}\n`)
})
