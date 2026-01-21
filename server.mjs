import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import { supabase } from "./supabase.js";

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "cambia_esto_en_produccion";

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

/* ---------- Middleware de autenticación ---------- */

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Falta token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/* ---------- LOGIN ---------- */
app.post("/api/login", async (req, res) => {
  const { usuario, password } = req.body;

  console.log("LOGIN REQUEST:", usuario, password);

  const { data: user, error } = await supabase
    .from("usuarios")
    .select("*")
   .eq("usuario", usuario)

    .eq("password", password)
    .single();

  console.log("SUPABASE RESULT:", user, error);

  if (error || !user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

 const token = jwt.sign(
  { id: user.id, usuario: user.usuario, rol: user.rol },
  JWT_SECRET,
  { expiresIn: "12h" }
);


  res.json({
    ok: true,
    token,
    rol: user.rol
  });
});


/* ---------- CREAR USUARIO ---------- */
app.post("/api/usuarios", auth, async (req, res) => {
  const { usuario, password, rol } = req.body;


  try {
    const { data, error } = await supabase
      .from("usuarios")
     .insert([{
  usuario,
  password: password
,
  rol
}])

      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, usuario: data });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error creando usuario" });
  }
});


/* ---------- OBTENER DÍA LITÚRGICO ---------- */
// GET /api/dia/:fecha
app.get("/api/dia/:fecha", auth, async (req, res) => {
  const fecha = req.params.fecha;

  try {
    // 1. Buscar el día
    const { data: dia, error: errDia } = await supabase
      .from("dias")
      .select("*")
      .eq("fecha", fecha)
      .single();

    if (errDia || !dia) {
      return res.status(404).json({ error: "Fecha no encontrada" });
    }

    // 2. Buscar las horas del día
    const { data: horas, error: errHoras } = await supabase
      .from("horas")
      .select("*")
      .eq("dia_id", dia.id);

    if (errHoras) throw errHoras;

    // 3. Buscar los elementos de cada hora
    const respuesta = { idLiturgico: dia.id_liturgico };

    for (const h of horas) {
      const { data: elementos, error: errElem } = await supabase
        .from("elementos")
        .select("*")
        .eq("hora_id", h.id)
        .order("indice", { ascending: true });

      if (errElem) throw errElem;

     respuesta[h.nombre] = elementos.map(e => ({
  tipo: e.tipo,
  estado: e.estado,
  observaciones: e.observaciones
}));

    }

    res.json(respuesta);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error cargando datos desde Supabase" });
  }
});

/* ---------- ACTUALIZAR ESTADO ---------- */
app.put("/api/dia/:fecha/hora/:hora/index/:index/estado", auth, async (req, res) => {
  const { fecha, hora, index } = req.params;
  const { estado } = req.body;

  try {
    // 1. Buscar el día
    const { data: dia, error: errDia } = await supabase
      .from("dias")
      .select("*")
      .eq("fecha", fecha)
      .single();
    if (errDia || !dia) return res.status(404).json({ error: "Fecha no encontrada" });

    // 2. Buscar la hora litúrgica
    const { data: h, error: errHora } = await supabase
      .from("horas")
      .select("*")
      .eq("dia_id", dia.id)
      .eq("nombre", hora)
      .single();
    if (errHora || !h) return res.status(404).json({ error: "Hora no encontrada" });

    // 3. Buscar el elemento litúrgico
    const { data: elem, error: errElem } = await supabase
      .from("elementos")
      .select("*")
      .eq("hora_id", h.id)
      .eq("indice", Number(index))
      .single();
    if (errElem || !elem) return res.status(404).json({ error: "Elemento no encontrado" });

    // 4. Actualizar estado
    const { error: errUpdate } = await supabase
      .from("elementos")
      .update({ estado })
      .eq("id", elem.id);
    if (errUpdate) throw errUpdate;

    // 5. AUDITORÍA COMPLETA
    const { error: audError } = await supabase
      .from("auditoria")
      .insert([{
        fecha,
        hora,
        indice: Number(index),
        campo: "estado",
        elemento: elem.tipo || "",
        valor_antes: elem.estado || "",
        valor_despues: estado,
        usuario: req.user.usuario,
        usuario_id: req.user.id,
        fecha_cambio: new Date().toISOString().slice(0, 10),
        hora_cambio: new Date().toLocaleTimeString("es-ES"),
        timestamp: new Date().toISOString()
      }]);

    if (audError) {
      console.error("AUDITORIA ESTADO → ERROR", audError);
      return res.status(500).json({ error: "Error insertando auditoría estado" });
    }

    return res.json({ ok: true });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error actualizando estado" });
  }
});

/* ---------- ACTUALIZAR OBSERVACIONES ---------- */
app.put("/api/dia/:fecha/hora/:hora/index/:index/observaciones", auth, async (req, res) => {
  const { fecha, hora, index } = req.params;
  const { observacion } = req.body;

  try {
    // 1. Buscar el día
    const { data: dia, error: errDia } = await supabase
      .from("dias")
      .select("*")
      .eq("fecha", fecha)
      .single();
    if (errDia || !dia) return res.status(404).json({ error: "Fecha no encontrada" });

    // 2. Buscar la hora litúrgica
    const { data: h, error: errHora } = await supabase
      .from("horas")
      .select("*")
      .eq("dia_id", dia.id)
      .eq("nombre", hora)
      .single();
    if (errHora || !h) return res.status(404).json({ error: "Hora no encontrada" });

    // 3. Buscar el elemento litúrgico
    const { data: elem, error: errElem } = await supabase
      .from("elementos")
      .select("*")
      .eq("hora_id", h.id)
      .eq("indice", Number(index))
      .single();
    if (errElem || !elem) return res.status(404).json({ error: "Elemento no encontrado" });

    // 4. Actualizar observaciones
    const { error: errUpdate } = await supabase
      .from("elementos")
      .update({ observaciones: observacion })
      .eq("id", elem.id);
    if (errUpdate) throw errUpdate;

    // 5. AUDITORÍA COMPLETA
    const { error: audError } = await supabase
      .from("auditoria")
      .insert([{
        fecha,
        hora,
        indice: Number(index),
        campo: "observaciones",
        elemento: elem.tipo || "",
        valor_antes: elem.observaciones || "",
        valor_despues: observacion,
        usuario: req.user.usuario,
        usuario_id: req.user.id,
        fecha_cambio: new Date().toISOString().slice(0, 10),
        hora_cambio: new Date().toLocaleTimeString("es-ES"),
        timestamp: new Date().toISOString()
      }]);

    if (audError) {
      console.error("AUDITORIA OBS → ERROR", audError);
      return res.status(500).json({ error: "Error insertando auditoría observaciones" });
    }

    return res.json({ ok: true });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error actualizando observaciones" });
  }
});

/* ---------- AUDITORÍA ---------- */
// GET /api/auditoria
app.get("/api/auditoria", auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("auditoria")
      .select("*")
      .order("fecha_cambio", { ascending: false })
      .order("hora_cambio", { ascending: false })
      .order("timestamp", { ascending: false });

    if (error) throw error;

    res.json(data);

  } catch (e) {
    console.error("ERROR AUDITORIA:", e);
    res.status(500).json({ error: "Error cargando auditoría" });
  }
});

/* ---------- LISTA DE AÑOS ---------- */
app.get("/api/years", auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dias")
      .select("fecha");

    if (error) throw error;

    // Extraer años únicos
    const years = [...new Set(data.map(d => d.fecha.substring(0, 4)))];

    res.json(years);

  } catch (e) {
    console.error("ERROR YEARS:", e);
    res.status(500).json({ error: "Error cargando años" });
  }
});

/* ---------- ARRANQUE ---------- */

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
