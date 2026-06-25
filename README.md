# AUTOMAIND · Sitio web 3D

Sitio informativo de una sola página (single page) con tema claro (blanco suave / off-white),
hero oscuro cinematográfico y un escenario 3D oscuro interactivo. HTML + Tailwind (CDN) + Three.js (CDN).

**Modelos 3D:** la máquina protagonista vive en el hero (parallax + giro suave). Los 3 modelos
(máquina, pieza, placa) se pueden inspeccionar a fondo en la sección **«Equipos 3D»**, cada uno en
su propio escenario oscuro y **arrastrando con el mouse para girarlo**. El parpadeo (z-fighting de
CAD) se corrige con buffer logarítmico de profundidad, sin auto-sombra y con `polygonOffset`.

## Estructura
```
automaind-web/
├── index.html        ← todo el sitio (HTML + CSS + Three.js) en un solo archivo
├── serve.mjs         ← mini servidor local (opcional, para probar)
├── assets/           ← logo + fotos (industrias y capacidades), ya optimizadas
└── models/
    ├── model-a.glb   ← placa/molde plano  (sección Proyectos)
    ├── model-b.glb   ← pieza compacta      (sección Servicios)
    └── model-c.glb   ← máquina protagonista (Hero/Inicio)
```
Los modelos están comprimidos (meshopt + webp): pasaron de **226 MB a 5.5 MB** en total.
Las fotos del ZIP que enviaste se integraron en dos lugares: **Capacidades** (Automatización,
Diseño Eléctrico, Diseño Industrial, Maquinados) e **Industrias que atendemos** (Metalmecánica,
Electrónica, Alimenticia, Farmacéutica, Tequilera). El **logo** oficial está en el nav, el footer
y la pantalla de carga, y la paleta de acento se ajustó al **naranja de la marca**.

## Cómo probarlo (necesita un servidor local)
Los modelos `.glb` se cargan por `fetch`, y Chrome bloquea eso si abres el HTML con doble clic
(`file://`). Por eso hay que servirlo. Cualquiera de estas opciones funciona:

```bash
# Opción 1 — Node (incluido aquí)
node serve.mjs
# luego abre http://localhost:4173

# Opción 2 — Python
python3 -m http.server 4173
# luego abre http://localhost:4173

# Opción 3 — VS Code: extensión "Live Server" → clic derecho en index.html → Open with Live Server
```

## Activar el formulario de contacto
En `index.html`, busca `FORMSPREE_ENDPOINT` y reemplaza `TU_ID_AQUI` por tu endpoint de
[Formspree](https://formspree.io) (gratis). Los mensajes llegarán a tu correo, sin recargar la
página. Si prefieres **EmailJS**, hay un bloque comentado justo debajo con las instrucciones.

## Pendiente de confirmar
- **Dirección exacta:** se usó la ubicación compartida con Plastitaps (Carretera a Nogales,
  San Juan de Ocotán, C.P. 45019, Zapopan). Confirma el **número y bodega exactos de AUTOMAIND**
  en la sección «Ubicación» y, si cambia, ajusta también las coordenadas del botón del mapa.

## Subir a producción (opcional)
Funciona en cualquier hosting estático (GoDaddy, Netlify, Vercel, etc.): sube la carpeta tal cual.
Para producción real conviene cambiar Tailwind CDN por el build de Tailwind (sólo es un aviso de
consola, no afecta el funcionamiento).
