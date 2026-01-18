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

// Servir frontend desde /public
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
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

  const usuarios = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "usuarios.json"), "utf8"));
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

  const usuarios = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "usuarios.json"), "utf8"));

  if (usuarios[usuario]) {
    return res.status(400).json({ error: "El usuario ya existe" });
  }

  usuarios[usuario] = { password, rol };
  fs.writeFileSync(path.join(DATA_DIR, "usuarios.json"), JSON.stringify(usuarios, null, 2));

  res.json({ ok: true });
});

/* ===================== AUXILIARES ===================== */

function cargarDiasLiturgicos(fecha) {
  const year = fecha.substring(0, 4);
  const ruta = path.join(DATA_DIR, `dias_liturgicos_${year}.json`);
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

function cargarDiasContenido(fecha) {
  const year = fecha.substring(0, 4);
  const ruta = path.join(DATA_DIR, `dias_contenido_${year}.json`);
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

function guardarDiasContenido(fecha, contenido) {
  const year = fecha.substring(0, 4);
  const ruta = path.join(DATA_DIR, `dias_contenido_${year}.json`);
  fs.writeFileSync(ruta, JSON.stringify(contenido, null, 2));
}

function registrarAuditoria(accion, usuario, fecha, hora, index, antes, despues) {
  const ruta = path.join(DATA_DIR, "auditoria.json");
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
      fs.readFileSync(path.join(DATA_DIR, `dias_liturgicos_${year}.json`), "utf8")
    );
    const diasContenido = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, `dias_contenido_${year}.json`), "utf8")
    );

    const informe = {
      totales: { verde: 0, amarillo: 0, rojo: 0, pendiente: 0 },
      dias: [],
      diasConFallos: [],
      diasCompletos: []
    };

    for (const fecha in diasLiturgicos) {
      const id = diasLiturgicos[fecha];
      const clave = id + fecha;
      const registro = diasContenido[clave];
      if (!registro) continue;

      let verde = 0, amarillo = 0, rojo = 0, pendiente = 0;

      for (const hora in registro.horas) {
        registro.horas[hora].forEach(e => {
          if (!e.estado) pendiente++;
          else if (e.estado === "verde") verde++;
          else if (e.estado === "amarillo") amarillo++;
          else if (e.estado === "rojo") rojo++;
        });
      }

      informe.totales.verde += verde;
      informe.totales.amarillo += amarillo;
      informe.totales.rojo += rojo;
      informe.totales.pendiente += pendiente;

      const dia = { fecha, idLiturgico: id, verde, amarillo, rojo, pendiente };
      informe.dias.push(dia);

      if (rojo > 0 || amarillo > 0) informe.diasConFallos.push(dia);
      if (pendiente === 0 && rojo === 0 && amarillo === 0) informe.diasCompletos.push(dia);
    }

    res.json(informe);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error generando informe" });
  }
});

/* ===================== AUDITORÍA ===================== */

app.get("/api/auditoria", auth, soloSupervisor, (req, res) => {
  const ruta = path.join(DATA_DIR, "auditoria.json");
  if (!fs.existsSync(ruta)) return res.json([]);
  const log = JSON.parse(fs.readFileSync(ruta, "utf8"));
  res.json(log);
});

/* ===================== ENDPOINTS PRINCIPALES ===================== */

app.get("/api/dia/:fecha", auth, (req, res) => {
  const fecha = req.params.fecha;

  try {
    const diasLiturgicos = cargarDiasLiturgicos(fecha);
    const diasContenido = cargarDiasContenido(fecha);

    const id = diasLiturgicos[fecha];
    if (!id) {
      return res.status(404).json({ error: "Fecha no encontrada" });
    }

    const clave = id + fecha;
    const registro = diasContenido[clave];

    if (!registro) {
      return res.status(404).json({ error: "No hay datos para esta fecha" });
    }

    const respuesta = {
      idLiturgico: id,
      ...registro.horas
    };

    res.json(respuesta);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error cargando datos" });
  }
});

app.post("/api/dia/:fecha/hora/:hora/index/:index/estado", auth, (req, res) => {
  const { fecha, hora, index } = req.params;
  const { estado } = req.body;

  try {
    const diasLiturgicos = cargarDiasLiturgicos(fecha);
    const diasContenido = cargarDiasContenido(fecha);

    const id = diasLiturgicos[fecha];
    const clave = id + fecha;

    const antes = diasContenido[clave].horas[hora][index].estado || null;
    diasContenido[clave].horas[hora][index].estado = estado;

    guardarDiasContenido(fecha, diasContenido);

    registrarAuditoria(
      "cambiar_estado",
      req.usuario.usuario,
      fecha,
      hora,
      index,
      antes,
      estado
    );

    res.json({ ok: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error guardando estado" });
  }
});

app.post("/api/dia/:fecha/hora/:hora/index/:index/observaciones", auth, (req, res) => {
  const { fecha, hora, index } = req.params;
  const { observaciones } = req.body;

  try {
    const diasLiturgicos = cargarDiasLiturgicos(fecha);
    const diasContenido = cargarDiasContenido(fecha);

    const id = diasLiturgicos[fecha];
    const clave = id + fecha;

    const antes = diasContenido[clave].horas[hora][index].observaciones || null;
    diasContenido[clave].horas[hora][index].observaciones = observaciones;

    guardarDiasContenido(fecha, diasContenido);

    registrarAuditoria(
      "guardar_observaciones",
      req.usuario.usuario,
      fecha,
      hora,
      index,
      antes,
      observaciones
    );

    res.json({ ok: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error guardando observaciones" });
  }
});

/* ===================== SERVIR index.html PARA RUTAS NO API ===================== */

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===================== SERVIDOR ===================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✔ revision_eprex_web funcionando en puerto ${PORT}`);
});
