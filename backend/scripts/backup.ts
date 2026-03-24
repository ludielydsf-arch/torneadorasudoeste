import fs from "fs"
import path from "path"

const prismaDb = path.resolve(process.cwd(), "prisma", "dev.db")
const backupsDir = path.resolve(process.cwd(), "backups")

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

async function run() {
  ensureDir(backupsDir)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const target = path.join(backupsDir, `dev-${stamp}.db`)
  if (!fs.existsSync(prismaDb)) {
    process.stderr.write("Database file not found\n")
    process.exit(1)
  }
  fs.copyFileSync(prismaDb, target)
  process.stdout.write(`Backup created at ${target}\n`)
}

run()
