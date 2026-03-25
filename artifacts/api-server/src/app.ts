import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    res.status(500).send("ADMIN_PASSWORD não configurada.");
    return;
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token === ADMIN_PASSWORD) { next(); return; }
  }
  res.status(401).json({ error: "Não autorizado." });
}

app.get("/api/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.post("/api/admin/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Senha incorreta." });
    return;
  }
  res.json({ ok: true, token: ADMIN_PASSWORD });
});

app.use("/api/admin", adminAuth);
app.use("/api", router);

export default app;
