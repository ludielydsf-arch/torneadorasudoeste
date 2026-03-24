"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prismaDb = path_1.default.resolve(process.cwd(), "prisma", "dev.db");
const backupsDir = path_1.default.resolve(process.cwd(), "backups");
function ensureDir(p) {
    if (!fs_1.default.existsSync(p))
        fs_1.default.mkdirSync(p, { recursive: true });
}
async function run() {
    ensureDir(backupsDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = path_1.default.join(backupsDir, `dev-${stamp}.db`);
    if (!fs_1.default.existsSync(prismaDb)) {
        process.stderr.write("Database file not found\n");
        process.exit(1);
    }
    fs_1.default.copyFileSync(prismaDb, target);
    process.stdout.write(`Backup created at ${target}\n`);
}
run();
