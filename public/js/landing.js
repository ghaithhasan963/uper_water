import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030614);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// إضاءة
const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0x3b82f6, 1, 50);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// إنشاء حلزون مزدوج (double helix) لمزيد من الجمال
const particlesCount = 3000;
const positions = new Float32Array(particlesCount * 3);
const colors = new Float32Array(particlesCount * 3);

const color1 = new THREE.Color(0x3b82f6);
const color2 = new THREE.Color(0x8b5cf6);

for (let i = 0; i < particlesCount; i++) {
  const t = i / particlesCount;
  const angle = t * Math.PI * 30;
  const radius = 5 + t * 20;
  
  // حلزون أول
  const x1 = Math.cos(angle) * radius;
  const y1 = Math.sin(angle) * radius;
  const z1 = (t - 0.5) * 40;
  
  // حلزون ثاني (معاكس) - سنوزع النصف على هذا
  if (i % 2 === 0) {
    positions[i*3] = x1;
    positions[i*3+1] = y1;
    positions[i*3+2] = z1;
  } else {
    positions[i*3] = Math.cos(angle + Math.PI) * radius;
    positions[i*3+1] = Math.sin(angle + Math.PI) * radius;
    positions[i*3+2] = z1;
  }

  const mixedColor = color1.clone().lerp(color2, t);
  colors[i*3] = mixedColor.r;
  colors[i*3+1] = mixedColor.g;
  colors[i*3+2] = mixedColor.b;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const particlesMaterial = new THREE.PointsMaterial({
  size: 0.15,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// إضافة جسيمات صغيرة متطايرة حولها
const extraParticlesGeo = new THREE.BufferGeometry();
const extraCount = 500;
const extraPos = new Float32Array(extraCount * 3);
for (let i = 0; i < extraCount * 3; i += 3) {
  const r = 20 + Math.random() * 20;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);
  extraPos[i] = Math.sin(phi) * Math.cos(theta) * r;
  extraPos[i+1] = Math.sin(phi) * Math.sin(theta) * r;
  extraPos[i+2] = Math.cos(phi) * r;
}
extraParticlesGeo.setAttribute('position', new THREE.BufferAttribute(extraPos, 3));
const extraParticlesMat = new THREE.PointsMaterial({ color: 0x88aaff, size: 0.08, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
const extraParticles = new THREE.Points(extraParticlesGeo, extraParticlesMat);
scene.add(extraParticles);

// متغيرات للحركة
let clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const elapsedTime = performance.now() / 1000;

  // دوران الحلزون ببطء وتمايل
  particles.rotation.y = elapsedTime * 0.05;
  particles.rotation.x = Math.sin(elapsedTime * 0.2) * 0.1;
  particles.rotation.z = Math.cos(elapsedTime * 0.15) * 0.05;

  // دوران الجسيمات الخارجية بعكس الاتجاه
  extraParticles.rotation.y = elapsedTime * -0.02;
  extraParticles.rotation.x += 0.001;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});