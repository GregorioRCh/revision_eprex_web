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
    .eq("nombre", usuario)
    .eq("password_hash", password)
    .single();

  console.log("SUPABASE RESULT:", user, error);

  if (error || !user) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = jwt.sign(
    { id: user.id, usuario: user.nombre, rol: user.rol },
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
  const { nombre, email, password, rol } = req.body;

  try {
    const { data, error } = await supabase
      .from("usuarios")
      .insert([{
        nombre,
        email,
        password_hash: password,
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
        texto: e.texto,
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
// PUT /api/dia/:fecha/hora/:hora/index/:index/estado
// body: { estado }
app.put("/api/dia/:fecha/hora/:hora/index/:index/estado", auth, async (req, res) => {
  const { fecha, hora, index } = req.params;
  const { estado } = req.body;

  try {
    // 1. Día
    const { data: dia, error: errDia } = await supabase
      .from("dias")
      .select("*")
      .eq("fecha", fecha)
      .single();
    if (errDia || !dia) return res.status(404).json({ error: "Fecha no encontrada" });

    // 2. Hora
    const { data: h, error: errHora } = await supabase
      .from("horas")
      .select("*")
      .eq("dia_id", dia.id)
      .eq("nombre", hora)
      .single();
    if (errHora || !h) return res.status(404).json({ error: "Hora no encontrada" });

    // 3. Elemento
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

    // 5. Auditoría
    await supabase.from("auditoria").insert([{
      fecha,
      hora,
      indice: Number(index),
      campo: "estado",
      valor: estado,
      usuario_id: req.user?.id || null,
      timestamp: new Date().toISOString()
    }]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error actualizando estado" });
  }
});

/* ---------- ACTUALIZAR OBSERVACIONES ---------- */
// PUT /api/dia/:fecha/hora/:hora/index/:index/observaciones
// body: { observaciones }
app.put("/api/dia/:fecha/hora/:hora/index/:index/observaciones", auth, async (req, res) => {
  const { fecha, hora, index } = req.params;
  const { observaciones } = req.body;

  try {
    // 1. Día
    const { data: dia, error: errDia } = await supabase
      .from("dias")
      .select("*")
      .eq("fecha", fecha)
      .single();
    if (errDia || !dia) return res.status(404).json({ error: "Fecha no encontrada" });

    // 2. Hora
    const { data: h, error: errHora } = await supabase
      .from("horas")
      .select("*")
      .eq("dia_id", dia.id)
      .eq("nombre", hora)
      .single();
    if (errHora || !h) return res.status(404).json({ error: "Hora no encontrada" });

    // 3. Elemento
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
      .update({ observaciones })
      .eq("id", elem.id);

    if (errUpdate) throw errUpdate;

    // 5. Auditoría
    await supabase.from("auditoria").insert([{
      fecha,
      hora,
      indice: Number(index),
      campo: "observaciones",
      valor: observaciones,
      usuario_id: req.user?.id || null,
      timestamp: new Date().toISOString()
    }]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error actualizando observaciones" });
  }
});

/* ---------- ARRANQUE ---------- */

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
