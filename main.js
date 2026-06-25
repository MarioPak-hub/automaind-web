import * as THREE from 'three';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }     from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder }  from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';

const isTouch = window.matchMedia('(hover: none)').matches;

/* ===== GLB LOADER ===== */
const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

function loadGLB(url, onProgress){
  return new Promise((res, rej) => gltfLoader.load(url, g => res(g.scene), onProgress, rej));
}

/* ===== MODEL PREP (center, scale, z-fighting fix) ===== */
function prepModel(obj, targetRadius, initRot){
  const box = new THREE.Box3().setFromObject(obj);
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const c   = box.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.scale.setScalar(targetRadius / (sph.radius || 1));
  if(initRot) wrap.rotation.set(initRot.x||0, initRot.y||0, initRot.z||0);

  /* Clone materials per mesh so polygon offsets don't bleed between meshes.
     FrontSide on all eliminates back-face fighting from doubleSided GLB materials. */
  let meshIdx = 0;
  obj.traverse(node => {
    if(!node.isMesh) return;
    if(Array.isArray(node.material)){
      node.material = node.material.map(m => m ? m.clone() : m);
    } else if(node.material){
      node.material = node.material.clone();
    }
    const mats   = Array.isArray(node.material) ? node.material : [node.material];
    const offset = Math.min(meshIdx, 40) * 2;
    mats.forEach(mat => {
      if(!mat) return;
      const isGlass = mat.transparent
                   || mat.opacity < 0.99
                   || (mat.transmission !== undefined && mat.transmission > 0)
                   || /glass|vidrio|cristal|transp|window|acryl/i.test(mat.name || '');
      if(isGlass){
        mat.transparent  = true;
        mat.depthWrite   = false;
        mat.depthTest    = true;
        mat.side         = THREE.FrontSide;
        mat.alphaTest    = 0;
        mat.needsUpdate  = true;
        node.renderOrder = 2;
      } else {
        mat.side                = THREE.FrontSide;
        mat.polygonOffset       = true;
        mat.polygonOffsetFactor = 4 + offset;
        mat.polygonOffsetUnits  = 4 + offset;
        mat.depthTest           = true;
        mat.depthWrite          = true;
        mat.needsUpdate         = true;
      }
    });
    meshIdx++;
  });

  const spinner = new THREE.Group();
  spinner.add(wrap);
  return spinner;
}

/* ===== REUSABLE 3D VIEWER ===== */
function createViewer(canvas, opts = {}){
  const o = Object.assign({ orbit:false, parallax:false, dist:6.4, spin:0.3, autoRotateSpeed:1.1 }, opts);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias:true, alpha:true,
    logarithmicDepthBuffer:true,
    powerPreference:'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  camera.position.set(0, 0.2, o.dist);

  scene.add(new THREE.AmbientLight(0xbcd4e6, 0.8));
  const key  = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4, 6, 5);  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88c8ff, 0.8); fill.position.set(-6, 1, 3); scene.add(fill);
  const rim  = new THREE.DirectionalLight(0xf47920, 1.4); rim.position.set(-3, 4, -6); scene.add(rim);

  const rig = new THREE.Group(); scene.add(rig);
  const spinners = [];
  let baseX = 0;

  let controls = null;
  const useOrbit = o.orbit && !isTouch;
  if(o.orbit){
    controls = new OrbitControls(camera, canvas);
    controls.enableZoom = false; controls.enablePan = false;
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = true; controls.autoRotateSpeed = o.autoRotateSpeed;
    controls.minPolarAngle = Math.PI * 0.22; controls.maxPolarAngle = Math.PI * 0.78;
    controls.enabled = useOrbit;
    controls.target.set(0, 0, 0); controls.update(); controls.saveState();
  }

  const mouse = { x:0, y:0, tx:0, ty:0 };
  if(o.parallax && !isTouch){
    window.addEventListener('mousemove', e => {
      mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if(!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  requestAnimationFrame(resize);

  const clock = new THREE.Clock();
  let running = false;
  function frame(){
    if(!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if(useOrbit){
      controls.update();
    } else {
      for(const s of spinners) s.rotation.y += dt * o.spin;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      rig.rotation.y = mouse.x * 0.22;
      rig.rotation.x = mouse.y * 0.10;
      rig.position.x = baseX + mouse.x * 0.3;
    }
    renderer.render(scene, camera);
  }
  new IntersectionObserver(es => {
    es.forEach(e => { running = e.isIntersecting; if(running){ clock.getDelta(); frame(); } });
  }, { threshold: 0.01 }).observe(canvas);

  return {
    add(obj)      { rig.add(obj); },
    addSpinner(s) { rig.add(s); spinners.push(s); },
    setOffsetX(x) { baseX = x; rig.position.x = x; },
    resetView()   { if(controls) controls.reset(); },
  };
}

/* ===== HERO ===== */
const loaderEl   = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct  = document.getElementById('loaderPct');

(async function initHero(){
  const v = createViewer(document.getElementById('heroCanvas'), { orbit:false, parallax:true, dist:7.0, spin:0.22 });
  try{
    const mdl = await loadGLB('models/hero-model.glb?v=20260617b', e => {
      if(e.lengthComputable){
        const p = Math.round(e.loaded / e.total * 100);
        loaderFill.style.width = p + '%';
        loaderPct.textContent  = 'Cargando experiencia · ' + p + '%';
      }
    });
    const spinner = prepModel(mdl, 1.55);
    v.addSpinner(spinner);
    v.setOffsetX(window.matchMedia('(max-width:768px)').matches ? 0.2 : 1.7);
  } catch(err){
    console.error('Hero 3D:', err);
  }
  loaderEl.classList.add('hide');
})();

/* ===== SHOWCASE 3D ===== */
const showDefs = [
  { url:'models/showcase-model.glb?v=20260617', radius:1.6, initRot:{x:0,         y:0, z:0} },
  { url:'models/model-c.glb?v=20260617b',       radius:1.6, initRot:{x:0,         y:0, z:0} },
  { url:'models/model-b.glb?v=20260617',        radius:1.7, initRot:{x:0,         y:0, z:0} },
  { url:'models/model-a.glb?v=20260617',        radius:1.7, initRot:{x:Math.PI/2, y:0, z:0} },
];
let showInit = false;

async function initShowcase(){
  const canvas  = document.getElementById('showCanvas');
  const loading = document.getElementById('showLoading');
  const v = createViewer(canvas, { orbit:true, parallax:false, dist:6.5, autoRotateSpeed:1.0 });
  const holders = [];
  try{
    for(let i = 0; i < showDefs.length; i++){
      const d   = showDefs[i];
      const mdl = await loadGLB(d.url);
      const spinner = prepModel(mdl, d.radius, d.initRot);
      spinner.visible = (i === 0);
      v.add(spinner);
      holders.push(spinner);
    }
    loading.style.display = 'none';
  } catch(err){
    console.error('Showcase 3D:', err);
    loading.textContent = 'No se pudieron cargar los modelos 3D.';
    return;
  }
  document.querySelectorAll('.model-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.model;
      holders.forEach((h, j) => h.visible = (j === idx));
      document.querySelectorAll('.model-tab').forEach(b => b.classList.toggle('active', b === btn));
      v.resetView();
    });
  });
}

const equiposEl = document.getElementById('page-equipos');
if(equiposEl){
  new IntersectionObserver((es, obs) => {
    if(es[0].isIntersecting && !showInit){ showInit = true; obs.disconnect(); initShowcase(); }
  }, { rootMargin:'250px' }).observe(equiposEl);
}

/* ===== SERVICE & CAPABILITY DATA ===== */
const SERVICES = [
  {
    num:'01',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>`,
    title:'Diseño y fabricación de moldes',
    short:'Moldes para inyección de plásticos diseñados y fabricados con precisión y durabilidad garantizadas.',
    detail:'Diseñamos y fabricamos moldes de inyección de plásticos en acero de herramienta (P20, H13). Cada molde es validado con pruebas de inyección antes de la entrega, garantizando ciclos de vida prolongados y cavidades dimensionalmente precisas.',
    bullets:['1 a 32 cavidades','Moldes de hasta 8 toneladas','Maquinado CNC de 3, 4 y 5 ejes','Electroerosión (EDM) para geometrías complejas','Pruebas de inyección incluidas','Garantía en funcionamiento'],
  },
  {
    num:'02',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 7l3 3M5 19l9-9 1.5 1.5L6.5 20.5 3 21l.5-3.5z"/><circle cx="18" cy="6" r="3"/></svg>`,
    title:'Maquinados y herramentales',
    short:'Nuestros ingenieros colaboran desde el diseño para fabricar herramentales de calidad y resultados superiores.',
    detail:'Contamos con centros de maquinado CNC de 3 y 4 ejes, torno CNC y procesos de electroerosión para fabricar herramentales de alta precisión. Participamos desde la etapa de diseño para garantizar funcionalidad y durabilidad.',
    bullets:['Fresado, torneado y rectificado CNC','Precisión hasta ±0.005 mm','Acero de herramienta, aluminio y titanio','Herramentales de corte, doblado y estampado','Troqueles progresivos y de transferencia'],
  },
  {
    num:'03',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 14h18M8 10V6h8v4"/></svg>`,
    title:'Pallets especializados',
    short:'Fabricamos pallets de ola y pallets viajeros para diversos procesos, con cualquier material que requieras.',
    detail:'Fabricamos pallets de ola (wave soldering) y pallets viajeros para líneas de ensamble en PCB con el material y geometría que tu proceso requiera. Incluyen marcado láser y grabado CNC para trazabilidad.',
    bullets:['Pallets de ola para soldadura SMT','Pallets viajeros para líneas de ensamble','Materiales: aluminio, nylon, FR4, policarbonato','Marcado láser y grabado CNC','Diseño desde planos o muestras físicas'],
  },
  {
    num:'04',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/><circle cx="12" cy="12" r="3"/></svg>`,
    title:'Fixturas a la medida',
    short:'Fixturas de ensamble, pruebas de fugas, torque y validación de productos para todos tus procesos.',
    detail:'Diseñamos y fabricamos fixturas para todas las etapas de producción: ensamble, prueba, inspección y empaque. Garantizamos repetibilidad y precisión en cada ciclo de producción mediante sistemas validados y calificados.',
    bullets:['Fixturas de ensamble manual y semiautomático','Pruebas de fuga neumática e hidráulica','Pruebas de torque y par de apriete','Sistemas de visión artificial integrados','Validación y calificación incluida'],
  },
  {
    num:'05',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 7l6-3 6 3v6l-6 3-6-3z"/><path d="M12 4v6M6 7l6 3 6-3M12 16v5"/></svg>`,
    title:'Impresión 3D y maquila',
    short:'Prototipos de herramentales críticos con alta precisión y maquila en serie, optimizando tiempos y costos.',
    detail:'Producimos prototipos funcionales y piezas en serie con tecnologías FDM, SLA y SLS. Reducimos tiempos de desarrollo y costos de herramental hasta en un 70% comparado con métodos convencionales.',
    bullets:['Tecnologías FDM, SLA y SLS','Materiales: PLA, ABS, Nylon, PETG, resinas técnicas','Tolerancias hasta ±0.1 mm','Prototipos en 24 a 72 horas','Maquila en serie disponible'],
  },
  {
    num:'06',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`,
    title:'Maquinaria de precisión',
    short:'Equipos sofisticados de la más alta calidad que garantizan la precisión en cada pieza fabricada.',
    detail:'Contamos con equipos de medición certificados y maquinaria de última generación para garantizar la calidad dimensional de cada pieza. Toda medición tiene trazabilidad metrológica completa.',
    bullets:['CMM (máquina de medición por coordenadas)','Fresadora CNC vertical y horizontal','Torno CNC con eje C','EDM de penetración e hilo','Rectificadora superficial y cilíndrica'],
  },
  {
    num:'07',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg>`,
    title:'Maniobras industriales',
    short:'Montaje y desmontaje de estructuras, movimiento de maquinaria y maniobras de equipo crítico.',
    detail:'Realizamos montaje, desmontaje, traslado e instalación de maquinaria y equipos industriales pesados con personal y equipo de izaje certificado, garantizando seguridad, puntualidad y puesta en marcha.',
    bullets:['Izaje con grúas, diferenciales y elevadores','Personal certificado y asegurado','Traslado de maquinaria pesada','Reinstalación y puesta en marcha','Coordinación de permisos y logística'],
  },
  {
    num:'08',
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
    title:'Obra y servicios eléctricos',
    short:'Obra eléctrica en media y baja tensión, aérea y subterránea; pruebas y mantenimiento a subestaciones.',
    detail:'Ejecutamos obra eléctrica en media y baja tensión, aérea y subterránea. Mantenemos subestaciones, transformadores y sistemas de distribución con personal especializado conforme a la normativa NMX/NOM vigente.',
    bullets:['Media tensión hasta 34.5 kV','Subestaciones en gabinete y exterior','Pruebas de termografía y calidad de energía','Obra civil-eléctrica','Mantenimiento preventivo y correctivo'],
  },
];

const CAPS = [
  {
    num:'01', img:'assets/cap-automatizacion.jpg', title:'Automatización industrial',
    short:'Celdas robotizadas y líneas de producción a la medida.',
    detail:'Diseñamos sistemas completos de automatización: ingeniería conceptual, integración de PLCs, HMIs, robótica, visión artificial y comunicaciones industriales. De la idea al sistema funcionando en producción.',
    bullets:['PLCs Siemens, Allen-Bradley, Omron','HMIs y SCADA','Robótica colaborativa y tradicional','Visión artificial e inspección','Comunicaciones PROFINET, EtherNet/IP'],
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>`,
  },
  {
    num:'02', img:'assets/cap-electrico.jpg', title:'Diseño eléctrico',
    short:'Tableros de control y obra eléctrica en media y baja tensión.',
    detail:'Elaboramos memorias de cálculo, planos y diagramas eléctricos conforme a normas NMX, NOM e IEC. Fabricamos tableros de control y centros de carga completamente probados y listos para operar.',
    bullets:['Tableros de control y fuerza','Centros de carga y distribución','Normativa NMX, NOM, IEC, UL','Diseño en AutoCAD Electrical / EPLAN','Pruebas de continuidad y aislamiento'],
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
  },
  {
    num:'03', img:'assets/cap-industrial.jpg', title:'Diseño industrial',
    short:'Ingeniería y diseño mecánico, del concepto al plano.',
    detail:'Nuestro equipo usa SolidWorks, Catia y Fusion 360 para crear modelos 3D, renderizados fotorrealistas y planos de manufactura con tolerancias GD&T. Simulación FEA estructural incluida.',
    bullets:['Modelado 3D (SolidWorks, Catia, Fusion 360)','Simulación FEA y análisis estructural','Diseño para manufactura (DFM)','Renderizado y animación de producto','Planos con GD&T y tolerancias críticas'],
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19l7-7-4-4-7 7v4z"/><path d="M14 7l3 3"/></svg>`,
  },
  {
    num:'04', img:'assets/cap-maquinados.jpg', title:'Maquinados de precisión',
    short:'Maquinados CNC y herramentales de alta precisión.',
    detail:'Taller de maquinado con CNC de última generación para piezas con tolerancias muy ajustadas en aceros, aluminio, latón, cobre y plásticos técnicos. Control estadístico de proceso incluido.',
    bullets:['CNC 3, 4 y 5 ejes simultáneos','Tolerancias hasta ±0.005 mm','Fresado, torneado, rectificado, EDM','Materiales: acero, aluminio, latón, plásticos','Control estadístico de calidad (SPC)'],
    icon:`<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`,
  },
];

/* ===== RENDER GRIDS ===== */
function renderServiceGrid(){
  const grid = document.getElementById('serviceGrid');
  if(!grid) return;
  grid.innerHTML = SERVICES.map((s, i) => `
    <article class="card rounded-2xl p-7 reveal flex flex-col">
      <div class="flex items-center gap-3 text-accent mb-4">${s.icon}<span class="text-xs text-slate-300 font-mono">${s.num}</span></div>
      <h3 class="font-display font-semibold text-lg mb-2 text-slate-900">${s.title}</h3>
      <p class="text-slate-600 text-sm leading-relaxed flex-1">${s.short}</p>
      <button class="open-svc mt-5 text-accent text-sm font-semibold hover:underline text-left" data-idx="${i}">Ver más →</button>
    </article>
  `).join('');
  grid.querySelectorAll('.open-svc').forEach(btn => {
    btn.addEventListener('click', () => openModal('svc', +btn.dataset.idx));
  });
}

function renderCapGrid(){
  const grid = document.getElementById('capGrid');
  if(!grid) return;
  grid.innerHTML = CAPS.map((c, i) => `
    <button class="card group relative rounded-2xl overflow-hidden h-72 reveal open-cap text-left" data-idx="${i}">
      <img src="${c.img}?v=20260617" alt="${c.title}" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"></div>
      <div class="absolute inset-x-0 bottom-0 p-6">
        <span class="text-accent2 text-xs font-mono">${c.num}</span>
        <h3 class="font-display font-semibold text-lg mt-1 text-white">${c.title}</h3>
        <p class="text-white/70 text-sm mt-1 leading-snug">${c.short}</p>
        <span class="mt-3 inline-block text-accent2 text-xs font-semibold">Ver detalles →</span>
      </div>
    </button>
  `).join('');
  grid.querySelectorAll('.open-cap').forEach(btn => {
    btn.addEventListener('click', () => openModal('cap', +btn.dataset.idx));
  });
}

renderServiceGrid();
renderCapGrid();

/* ===== MODAL ===== */
const modalEl     = document.getElementById('modal');
const modalClose  = document.getElementById('modalClose');
const modalIcon   = document.getElementById('modalIcon');
const modalNum    = document.getElementById('modalNum');
const modalTitle  = document.getElementById('modalTitle');
const modalDetail = document.getElementById('modalDetail');
const modalBullet = document.getElementById('modalBullets');

function openModal(type, idx){
  const d = type === 'svc' ? SERVICES[idx] : CAPS[idx];
  modalIcon.innerHTML     = d.icon || '';
  modalNum.textContent    = `${d.num} · ${type === 'svc' ? 'Servicio' : 'Capacidad'}`;
  modalTitle.textContent  = d.title;
  modalDetail.textContent = d.detail;
  modalBullet.innerHTML   = d.bullets.map(b => `<div class="modal-bullet">${b}</div>`).join('');
  modalEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(){
  modalEl.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalEl.addEventListener('click', e => { if(e.target === modalEl) closeModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

/* ===== CAROUSEL ===== */
const carSlides = [...document.querySelectorAll('.car-slide')];
const carDots   = [...document.querySelectorAll('.car-dot')];
let carCurrent = 0;
let carTimer;

function carGoTo(n){
  carSlides[carCurrent].classList.remove('active');
  carDots[carCurrent]?.classList.remove('active');
  carCurrent = ((n % carSlides.length) + carSlides.length) % carSlides.length;
  carSlides[carCurrent].classList.add('active');
  carDots[carCurrent]?.classList.add('active');
  clearTimeout(carTimer);
  carTimer = setTimeout(() => carGoTo(carCurrent + 1), 5200);
}

document.getElementById('carPrev')?.addEventListener('click', () => carGoTo(carCurrent - 1));
document.getElementById('carNext')?.addEventListener('click', () => carGoTo(carCurrent + 1));
carDots.forEach(d => d.addEventListener('click', () => carGoTo(+d.dataset.i)));
carTimer = setTimeout(() => carGoTo(1), 5200);

/* ===== SPA ROUTER ===== */
const nav = document.getElementById('nav');

const ALL_PAGES = ['page-inicio','page-nosotros','page-servicios','page-equipos','page-proyectos','page-contacto','page-ubicacion'];
const GROUPS = {
  inicio:    ['page-inicio','page-equipos','page-proyectos'],
  nosotros:  ['page-nosotros'],
  servicios: ['page-servicios'],
  contacto:  ['page-contacto','page-ubicacion'],
};
const ROUTES = {
  inicio:    { group:'inicio' },
  equipos:   { group:'inicio',   scroll:'page-equipos' },
  proyectos: { group:'inicio',   scroll:'page-proyectos' },
  nosotros:  { group:'nosotros' },
  servicios: { group:'servicios' },
  contacto:  { group:'contacto' },
  ubicacion: { group:'contacto', scroll:'page-ubicacion' },
};

function navigate(hash){
  const route = ROUTES[hash] || ROUTES.inicio;
  const show  = GROUPS[route.group];

  ALL_PAGES.forEach(id => document.getElementById(id)?.classList.toggle('active', show.includes(id)));

  document.querySelectorAll('#nav a[href^="#"]').forEach(a =>
    a.classList.toggle('nav-active', a.getAttribute('href') === '#' + hash));

  if(route.group !== 'inicio'){
    setTimeout(() => show.forEach(id =>
      document.getElementById(id)?.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in'))), 50);
  }

  if(route.scroll){
    if(route.scroll === 'page-equipos' && !showInit){ showInit = true; initShowcase(); }
    setTimeout(() => {
      const t = document.getElementById(route.scroll);
      t?.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in'));
      t?.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 90);
  } else {
    window.scrollTo({ top:0, behavior:'instant' });
  }

  updateNavTheme();
}

window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'inicio'));

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if(!a) return;
  e.preventDefault();
  const hash = a.getAttribute('href').slice(1) || 'inicio';
  history.pushState(null, '', '#' + hash);
  navigate(hash);
  closeModal();
  resetHamburger();
});

navigate(location.hash.slice(1) || 'inicio');

/* ===== NAV: hamburger + scroll theme ===== */
const menuBtn    = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

function setHamburger(open){
  const bars = menuBtn.querySelectorAll('.hb');
  if(open){
    bars[0].style.transform = 'translateY(7px) rotate(45deg)';
    bars[1].style.opacity   = '0';
    bars[2].style.transform = 'translateY(-7px) rotate(-45deg)';
  } else {
    bars[0].style.transform = '';
    bars[1].style.opacity   = '1';
    bars[2].style.transform = '';
  }
  menuBtn.setAttribute('aria-expanded', String(open));
}

function resetHamburger(){
  mobileMenu.classList.add('hidden');
  setHamburger(false);
}

menuBtn.addEventListener('click', () => {
  const willOpen = mobileMenu.classList.contains('hidden');
  mobileMenu.classList.toggle('hidden', !willOpen);
  setHamburger(willOpen);
});

function updateNavTheme(){
  const homeActive = document.getElementById('page-inicio').classList.contains('active');
  nav.classList.toggle('scrolled', homeActive ? (window.scrollY > window.innerHeight - 90) : true);
}

window.addEventListener('scroll', updateNavTheme, { passive:true });

const scrollbar = document.getElementById('scrollbar');
window.addEventListener('scroll', () => {
  const h = document.documentElement;
  const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
  scrollbar.style.width = (p * 100) + '%';
}, { passive:true });

/* ===== REVEAL ON SCROLL ===== */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

document.getElementById('year').textContent = new Date().getFullYear();

/* ===== CONTACT FORM (Formspree) ===== */
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/TU_ID_AQUI';

const form      = document.getElementById('contactForm');
const formMsg   = document.getElementById('formMsg');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async e => {
  e.preventDefault();
  if(form._gotcha.value) return;
  if(!form.nombre.value.trim() || !form.email.value.trim() || !form.mensaje.value.trim()){
    formMsg.textContent = 'Completa los campos obligatorios.';
    formMsg.className = 'text-sm text-amber-600'; return;
  }
  submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; formMsg.textContent = '';

  if(FORMSPREE_ENDPOINT.includes('TU_ID_AQUI')){
    submitBtn.disabled = false; submitBtn.textContent = 'Enviar mensaje';
    formMsg.textContent = '⚠ Configura tu endpoint de Formspree en main.js para activar el envío.';
    formMsg.className = 'text-sm text-amber-600'; return;
  }
  try{
    const data = new FormData(form);
    data.append('_subject', 'Nueva solicitud desde automaind.com.mx');
    const res = await fetch(FORMSPREE_ENDPOINT, { method:'POST', body:data, headers:{ Accept:'application/json' } });
    if(res.ok){
      form.reset();
      formMsg.textContent = '✓ ¡Mensaje enviado! Te contactaremos pronto.';
      formMsg.className = 'text-sm text-green-600';
    } else throw new Error();
  } catch{
    formMsg.textContent = '✗ Ocurrió un error. Escríbenos directamente a ventas@automaind.com.mx';
    formMsg.className = 'text-sm text-red-600';
  } finally{
    submitBtn.disabled = false; submitBtn.textContent = 'Enviar mensaje';
  }
});
