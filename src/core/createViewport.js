import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export function createViewport(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  camera.position.set(10, 10, 12);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.45, 0);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minPolarAngle = 0.25;
  controls.enablePan = false;
  const hemi = new THREE.HemisphereLight(0xffeddf, 0x7b91a2, 2.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd6b5, 2.8);
  sun.position.set(-3, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const fillLight = new THREE.DirectionalLight(0xffffff, 1);
  fillLight.position.set(7, 5, -3);
  scene.add(fillLight);

  return { renderer, scene, camera, controls, hemi, sun, fillLight };
}
