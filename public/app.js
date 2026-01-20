const API = "https://revision-eprex-web.onrender.com/api";

/* ===================== ETIQUETAS DE ELEMENTOS ===================== */

const etiquetas = {
  antifona_invitatorio: "Ant. Invitatorio",
  himno: "Himno",

  antifona_salmo_1: "Ant. 1 Salmo",
  salmo_1: "1 Salmo",
  antifona_salmo_2: "Ant. 2 Salmo",
  salmo_2: "2 Salmo",
  antifona_salmo_3: "Ant. 3 Salmo",
  salmo_3: "3 Salmo",

  versiculo: "Versículo",

  lectura_1: "1 Lectura Anual",
  responsorio_1: "1 Responsorio Anual",
  lectura_1_bienal: "1 Lectura Bienal",
  responsorio_1_bienal: "1 Responsorio Bienal",

  lectura_2: "2 Lectura Anual",
  responsorio_2: "2 Responsorio Anual",
  lectura_2_bienal: "2 Lectura Bienal",
  responsorio_2_bienal: "2 Responsorio Bienal",

  oracion: "Oración"
};

/* ===================== LOGIN ===================== */

async function login() {
  const usuario = document.getElementById("loginUsuario").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password })
  });

  const datos = await res.json();

  if (!datos.ok) {
    alert(datos.error || "Usuario o contraseña incorrectos");
    return;
  }

  localStorage.setItem("token", datos.token);
  localStorage.setItem("rol", datos.rol);

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";

  if (datos.rol === "supervisor") {
    document.getElementById("btnCrearUsuario").style.display = "inline-block";
    document.getElementById("zonaSupervisor").style.display = "inline-block";
    cargarAnios();
  }
}


function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("rol");
  location.reload();
}

/* ===================== CREAR USUARIO ===================== */

async function crearUsuario() {
  const usuario = document.getElementById("nuevoUsuario").value;
  const password = document.getElementById("nuevoPassword").value;
  const rol = document.getElementById("nuevoRol").value;

  const res = await fetch(`${API}/usuarios`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ usuario, password })

  });

  const datos = await res.json();

  if (datos.ok) {
    alert("Usuario creado correctamente");
    document.getElementById("nuevoUsuario").value = "";
    document.getElementById("nuevoPassword").value = "";
  } else {
    alert("Error: " + (datos.error || "No se pudo crear el usuario"));
  }
}

function mostrarCrearUsuario() {
  const div = document.getElementById("crearUsuario");
  div.style.display = div.style.display === "none" ? "block" : "none";
}

/* ===================== CARGAR DÍA ===================== */

async function cargarDia() {
  const fechaInput = document.getElementById("fecha");
  const contenedor = document.getElementById("resultado");

  if (!fechaInput.value) {
    contenedor.innerHTML = "<p>Selecciona una fecha.</p>";
    return;
  }

  const fecha = fechaInput.value;
  contenedor.innerHTML = "<p>Cargando...</p>";

  try {
    const res = await fetch(`${API}/dia/${fecha}`, {
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("token")
      }
    });

    if (!res.ok) {
      contenedor.innerHTML = "<p>No se encontraron datos para esta fecha.</p>";
      return;
    }

    const data = await res.json();
    renderDia(data, fecha);

  } catch (e) {
    contenedor.innerHTML = "<p>Error al cargar los datos.</p>";
    console.error(e);
  }
}

function renderDia(data, fecha) {
  const contenedor = document.getElementById("resultado");
  const { idLiturgico, ...horas } = data;

  let html = "";
  html += `<h2>${idLiturgico}</h2>`;
  html += `<p>Fecha: ${fecha}</p>`;

  const nombresHoras = {
    oficio_de_lecturas: "Oficio de Lecturas",
    laudes: "Laudes",
    tercia: "Tercia",
    sexta: "Sexta",
    nona: "Nona",
    visperas: "Vísperas",
    completas: "Completas",
    misa: "Misa"
  };

  html += `<div class="tabs">`;

  for (const hora in horas) {
    const resumen = calcularResumen(horas[hora]);
    const claseTab = obtenerClaseTab(resumen);

    html += `
      <div class="tab ${claseTab}" onclick="mostrarTab('${hora}')">
        ${nombresHoras[hora]}
        <span style="font-size:12px;">
          🟢${resumen.verde} 🟡${resumen.amarillo} 🔴${resumen.rojo} ⚪${resumen.pendiente}
        </span>
      </div>`;
  }

  html += `</div>`;

  for (const hora in horas) {
    html += `<div id="tab-${hora}" class="tab-content">`;

    html += `<h3>${nombresHoras[hora]}</h3>`;
    html += `<table>
      <tr>
        <th>Elemento</th>
        <th>Estado</th>
        <th>Observaciones</th>
        <th>Acciones</th>
      </tr>
    `;

    horas[hora].forEach((elem, index) => {
      const estado = elem.estado || "";
      const obs = elem.observaciones || "";

      html += `
        <tr class="${estado ? 'fila-' + estado : ''}">
          <td>${etiquetas[elem.tipo] || elem.tipo}</td>
          <td>${estado}</td>
          <td>
            <textarea id="obs-${hora}-${index}" rows="2" form="none">${obs}</textarea>

          </td>
          <td class="botones-estado">
            <button class="boton-verde" onclick="cambiarEstado('${fecha}', '${hora}', ${index}, 'verde')">Verde</button>
            <button class="boton-amarillo" onclick="cambiarEstado('${fecha}', '${hora}', ${index}, 'amarillo')">Amarillo</button>
            <button class="boton-rojo" onclick="cambiarEstado('${fecha}', '${hora}', ${index}, 'rojo')">Rojo</button>
            <button onclick="guardarObs('${fecha}', '${hora}', ${index})">Guardar obs.</button>
          </td>
        </tr>
      `;
    });

    html += `</table></div>`;
  }

  contenedor.innerHTML = html;

  const primera = Object.keys(horas)[0];
  mostrarTab(primera);
}

/* ===================== RESÚMENES Y PESTAÑAS ===================== */

function calcularResumen(lista) {
  let verde = 0, amarillo = 0, rojo = 0, pendiente = 0;

  lista.forEach(e => {
    if (!e.estado) pendiente++;
    else if (e.estado === "verde") verde++;
    else if (e.estado === "amarillo") amarillo++;
    else if (e.estado === "rojo") rojo++;
  });

  return { verde, amarillo, rojo, pendiente };
}

function obtenerClaseTab(resumen) {
  if (resumen.rojo > 0) return "tab-rojo";
  if (resumen.amarillo > 0) return "tab-amarillo";
  if (resumen.verde > 0 && resumen.pendiente === 0) return "tab-verde";
  return "tab-pendiente";
}

function mostrarTab(hora) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("activa"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("activa"));

  const tab = Array.from(document.querySelectorAll(".tab"))
    .find(t => t.getAttribute("onclick") === `mostrarTab('${hora}')`);
  if (tab) tab.classList.add("activa");

  const contenido = document.getElementById(`tab-${hora}`);
  if (contenido) contenido.classList.add("activa");
}

/* ===================== ESTADO Y OBSERVACIONES ===================== */

async function cambiarEstado(fecha, hora, index, estado) {
  await fetch(`${API}/api/dia/${fecha}/hora/${hora}/index/${index}/estado`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({
      estado,
      fecha,
      hora,
      index
    })
  });

  cargarDia();
}


async function guardarObs(fecha, hora, index) {
  const textarea = document.getElementById(`obs-${hora}-${index}`);
  const observaciones = textarea.value;

  await fetch(`${API}/api/dia/${fecha}/hora/${hora}/index/${index}/observaciones`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({
      observaciones,
      fecha,
      hora,
      index
    })
  });

  alert("Observaciones guardadas");
}



/* ===================== INFORMES ===================== */

async function cargarAnios() {
  try {
    const res = await fetch(`${API}/years`, {
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("token")
      }
    });
    const years = await res.json();
    const select = document.getElementById("selectYear");
    select.innerHTML = "";
    years.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Error cargando años", e);
  }
}

async function toggleInformes() {
  const panel = document.getElementById("panelInformes");
  if (panel.style.display === "none" || panel.style.display === "") {
    await cargarInforme();
    panel.style.display = "block";
  } else {
    panel.style.display = "none";
  }
}

async function cargarInforme() {
  const year = document.getElementById("selectYear").value;
  if (!year) return;

  document.getElementById("informeYear").textContent = year;
  document.getElementById("resumenInforme").innerHTML = "Cargando informe...";
  document.getElementById("tablaDiasFallos").innerHTML = "";
  document.getElementById("tablaDiasCompletos").innerHTML = "";

  try {
    const res = await fetch(`${API}/supervisor/${year}/informe`, {
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("token")
      }
    });
    const informe = await res.json();

    renderInforme(informe);

  } catch (e) {
    document.getElementById("resumenInforme").innerHTML = "Error cargando informe.";
    console.error(e);
  }
}

function renderInforme(informe) {
  const resumenDiv = document.getElementById("resumenInforme");
  resumenDiv.innerHTML = `
    <p><strong>Totales:</strong> 🟢${informe.totales.verde} 🟡${informe.totales.amarillo} 🔴${informe.totales.rojo} ⚪${informe.totales.pendiente}</p>
    <p><strong>Días con fallos:</strong> ${informe.diasConFallos.length}</p>
    <p><strong>Días completos:</strong> ${informe.diasCompletos.length}</p>
  `;

  const fallosDiv = document.getElementById("tablaDiasFallos");
  let htmlFallos = "<table><tr><th>Fecha</th><th>Id litúrgico</th><th>🟢</th><th>🟡</th><th>🔴</th><th>⚪</th></tr>";
  informe.diasConFallos.forEach(d => {
    htmlFallos += `<tr>
      <td>${d.fecha}</td>
      <td>${d.idLiturgico}</td>
      <td>${d.verde}</td>
      <td>${d.amarillo}</td>
      <td>${d.rojo}</td>
      <td>${d.pendiente}</td>
    </tr>`;
  });
  htmlFallos += "</table>";
  fallosDiv.innerHTML = htmlFallos;

  const completosDiv = document.getElementById("tablaDiasCompletos");
  let htmlCompletos = "<table><tr><th>Fecha</th><th>Id litúrgico</th><th>🟢</th></tr>";
  informe.diasCompletos.forEach(d => {
    htmlCompletos += `<tr>
      <td>${d.fecha}</td>
      <td>${d.idLiturgico}</td>
      <td>${d.verde}</td>
    </tr>`;
  });
  htmlCompletos += "</table>";
  completosDiv.innerHTML = htmlCompletos;
}

/* ===================== AUDITORÍA ===================== */

async function toggleAuditoria() {
  const panel = document.getElementById("panelAuditoria");
  if (panel.style.display === "none" || panel.style.display === "") {
    await cargarAuditoria();
    panel.style.display = "block";
  } else {
    panel.style.display = "none";
  }
}

async function cargarAuditoria() {
  try {
    const res = await fetch(`${API}/auditoria`, {
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("token")
      }
    });

    const datos = await res.json();

    if (!Array.isArray(datos)) {
      alert("Error cargando auditoría.");
      return;
    }

    let html = `
      <table class="tabla-auditoria">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Usuario ID</th>
            <th>Campo</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Índice</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const r of datos) {
      html += `
        <tr>
          <td>${r.timestamp || ""}</td>
          <td>${r.usuario_id || ""}</td>
          <td>${r.campo || ""}</td>
          <td>${r.fecha || ""}</td>
          <td>${r.hora || ""}</td>
          <td>${r.indice ?? ""}</td>
          <td>${r.valor ?? ""}</td>
        </tr>
      `;
    }

    html += `</tbody></table>`;

    document.getElementById("contenedorAuditoria").innerHTML = html;

  } catch (e) {
    console.error(e);
    alert("Error cargando auditoría.");
  }
}


/* ===================== INICIO ===================== */

window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("rol");

  if (token) {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (rol === "supervisor") {
      document.getElementById("btnCrearUsuario").style.display = "inline-block";
      document.getElementById("zonaSupervisor").style.display = "inline-block";
      cargarAnios();
    }
  }

  const fechaInput = document.getElementById("fecha");
  if (fechaInput) {
    fechaInput.addEventListener("change", cargarDia);
  }
});
