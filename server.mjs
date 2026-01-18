import express from "express";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Servir frontend
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = "./data";
const SECRET = "clave_super_secreta";

/* ===================== MIDDLEWARES ===================== */

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Falta token" });

  const token = header.split(" ")[1];
  try {
    const datos = jwt.verify(token, SECRET);
    req.usuario = datos;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function soloSupervisor(req, res, next) {
  if (req.usuario.rol !== "supervisor") {
    return res.status(403).json({ error: "Acceso restringido a supervisores" });
  }
  next();
}

/* ===================== LOGIN / USUARIOS ===================== */

app.post("/api/login", (req, res) => {
  const { usuario, password } = req.body;

  const usuarios = JSON.parse(fs.readFileSync("./data/usuarios.json", "utf8"));
  const datos = usuarios[usuario];
  if (!datos) return res.status(401).json({ error: "Usuario no encontrado" });

  if (password !== datos.password) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  const token = jwt.sign(
    { usuario, rol: datos.rol },
    SECRET,
    { expiresIn: "12h" }
  );

  res.json({ ok: true, token, rol: datos.rol });
});

app.post("/api/usuarios", auth, soloSupervisor, (req, res) => {
  const { usuario, password, rol } = req.body;

  if (!usuario || !password || !rol) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const usuarios = JSON.parse(fs.readFileSync("./data/usuarios.json", "utf8"));

  if (usuarios[usuario]) {
    return res.status(400).json({ error: "El usuario ya existe" });
  }

  usuarios[usuario] = { password, rol };
  fs.writeFileSync("./data/usuarios.json", JSON.stringify(usuarios, null, 2));

  res.json({ ok: true });
});

/* ===================== AUXILIARES ===================== */

function cargarDiasLiturgicos(fecha) {
  const year = fecha.substring(0, 4);
  const ruta = `${DATA_DIR}/dias_liturgicos_${year}.json`;
  if (!fs.existsSync(ruta)) {
    throw new Error(`No existe archivo litúrgico para el año ${year}`);
  }
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

function cargarDiasContenido(fecha) {
  const year = fecha.substring(0, 4);
  const ruta = `${DATA_DIR}/dias_contenido_${year}.json`;
  if (!fs.existsExists(ruta)) {
    throw new Error(`No existe archivo de contenido para el año ${year}`);
  }
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

function guardarDiasContenido(fecha, contenido) {
  const year = fecha.substring(0, 4);
  const ruta = `${DATA_DIR}/dias_contenido_${year}.json`;
  fs.writeFileSync(ruta, JSON.stringify(contenido, null, 2));
}

function registrarAuditoria(accion, usuario, fecha, hora, index, antes, despues) {
  const ruta = "./data/auditoria.json";
  let log = [];
  if (fs.existsSync(ruta)) {
    log = JSON.parse(fs.readFileSync(ruta, "utf8"));
  }
  log.push({
    timestamp: new Date().toISOString(),
    usuario,
    accion,
    fecha,
    hora,
    index,
    antes,
    despues
  });
  fs.writeFileSync(ruta, JSON.stringify(log, null, 2));
}

/* ===================== AÑOS DISPONIBLES ===================== */

app.get("/api/years", auth, soloSupervisor, (req, res) => {
  const files = fs.readdirSync(DATA_DIR);
  const years = new Set();

  files.forEach(f => {
    const m = f.match(/^dias_liturgicos_(\d{4})\.json$/);
    if (m) years.add(m[1]);
  });

  res.json(Array.from(years).sort());
});

/* ===================== INFORME SUPERVISOR ===================== */

app.get("/api/supervisor/:year/informe", auth, soloSupervisor, (req, res) => {
  const year = req.params.year;

  try {
    const diasLiturgicos = JSON.parse(
      fs.readFileSync(`${