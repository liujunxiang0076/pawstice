import * as THREE from 'three';
import { PetComponent } from '../features/pet/PetComponent.js';
import { openPetEditor } from '../features/pet/PetEditor.js';
import { loadGameState } from '../core/storage.js';
import { createNavigator } from '../core/navigation.js';
import { createViewport } from '../core/createViewport.js';
import { createRoom } from '../scenes/room/createRoom.js';
import { createInterface } from '../ui/createInterface.js';
import { icon, refreshIcons } from '../ui/icons.js';
import { taskDefs } from '../config/game.js';
import { PetMotor } from '../features/pet/motion.js';

export function createGame() {
  const $ = (selector) => document.querySelector(selector);
  const lifecycle = new AbortController();
  const listen = (target, event, handler) =>
    target.addEventListener(event, handler, { signal: lifecycle.signal });
  let animationFrame = 0,
    activeEditor = null;
  const state = loadGameState();
  const ui = createInterface(state, { onPetChanged: () => buildPet() });
  const { updateUI, toast, save } = ui;
  const canvas = $('#scene');
  const { renderer, scene, camera, controls, hemi, sun, fillLight } = createViewport(canvas);
  const { interactables, obstacles, back, left, feeding, ball, lamp } = createRoom(scene);
  const navigator = createNavigator(obstacles, () => petComponent.navigationRadius);
  const blocked = (x, z) => navigator.blocked(x, z);
  const route = (target) => navigator.findPath(petPos, target);
  function groundHeight(x = petPos.x, z = petPos.z) {
    const d = Math.hypot(x - 2.9, z + 0.83);
    return d < 0.73 ? 0.37 : d < 1.03 ? ((1.03 - d) / 0.3) * 0.37 : 0;
  }
  let pet,
    petComponent,
    petMeshes = [];
  let petPos = new THREE.Vector3(0.65, 0, 0.65);
  const motor = new PetMotor();
  let path = [],
    mode = 'idle',
    pending = null,
    actionTime = 0,
    idleTime = 0,
    bubbleUntil = 0,
    total = 0,
    editingPet = false;
  function buildPet() {
    const replacing = Boolean(petComponent);
    petMeshes.forEach((mesh) => {
      const i = interactables.indexOf(mesh);
      if (i >= 0) interactables.splice(i, 1);
    });
    if (petComponent) petComponent.setProfile(state.petProfile);
    else {
      petComponent = new PetComponent(state.petProfile);
      scene.add(petComponent.object3D);
    }
    if (replacing && blocked(petPos.x, petPos.z)) {
      let nearest = null,
        best = Infinity;
      for (let x = -3.5; x <= 3.5; x += 0.2)
        for (let z = -2.8; z <= 2.8; z += 0.2) {
          const d = (x - petPos.x) ** 2 + (z - petPos.z) ** 2;
          if (d < best && !blocked(x, z)) {
            best = d;
            nearest = new THREE.Vector3(x, 0, z);
          }
        }
      if (nearest) petPos.copy(nearest);
    }
    pet = petComponent.object3D;
    pet.position.copy(petPos);
    pet.position.y = groundHeight();
    pet.rotation.set(0, -0.35, 0);
    petMeshes = petComponent.pickables;
    interactables.push(...petMeshes);
    mode = 'idle';
    motor.reset();
    path = [];
    pending = null;
    idleTime = 0;
    actionTime = 0;
    bubbleUntil = 0;
    ball.position.set(1.35, 0.19, 1.65);
  }
  buildPet();
  $('#customize-pet').onclick = () => {
    if (editingPet) return;
    editingPet = true;
    activeEditor = openPetEditor({
      profile: state.petProfile,
      onSave: (profile) => {
        state.petProfile = profile;
        state.pet = profile.species;
        state.name = profile.name;
        buildPet();
        updateUI();
        save();
        toast('专属外观已保存，回小屋看看吧');
      },
      onClose: () => {
        activeEditor = null;
        editingPet = false;
        last = performance.now();
      },
    });
  };
  const destinations = {
    feed: new THREE.Vector3(-2.3, 0, 2.45),
    play: new THREE.Vector3(1.3, 0, 1.95),
    sleep: new THREE.Vector3(2.9, 0, -0.83),
    wash: new THREE.Vector3(1.9, 0, 1.4),
  };
  function speak(text, duration = 4) {
    $('#bubble').textContent = text;
    $('#bubble').classList.remove('hidden');
    bubbleUntil = total + duration;
  }
  function interact(action, auto = false) {
    if (mode !== 'idle' && mode !== 'walk') {
      if (!auto) toast('等它完成这件小事，再一起玩吧');
      return;
    }
    pending = { action, auto };
    if (action === 'pet') {
      path = [];
      beginAction();
      return;
    }
    path = route(destinations[action]);
    if (!path.length && petPos.distanceTo(destinations[action]) > 0.35) {
      pending = null;
      toast('这条路暂时走不通，换一个角度再试试');
      return;
    }
    mode = 'walk';
    speak(
      {
        feed: '闻到好吃的啦～',
        play: '小球球，我来啦！',
        sleep: '困困了，去小窝躺一会',
        wash: '去洗香香～',
      }[action],
    );
    if (!path.length) beginAction();
  }
  function beginAction() {
    mode = pending.action;
    actionTime = 0;
    speak(
      {
        feed: '啊呜啊呜，好香呀！',
        play: '再陪我玩一会嘛 ♡',
        sleep: 'Z z z …',
        pet: '呼噜呼噜，最喜欢你了 ♡',
        wash: '泡泡轻轻，香香软软',
      }[mode],
      6,
    );
  }
  function finishAction() {
    const action = mode;
    const effects = {
      feed: [24, 4, -2, 0],
      play: [-5, 24, -12, -4],
      sleep: [-3, 4, 32, 0],
      pet: [0, 16, 3, 0],
      wash: [0, 8, -3, 35],
    }[action];
    state.stats = state.stats.map((v, i) => Math.max(0, Math.min(100, v + effects[i])));
    if (!pending.auto) {
      const task = taskDefs.find((t) => t[0] === action);
      if (task && !state.tasks.includes(action)) {
        state.tasks.push(action);
        state.coins += task[2];
        toast(`完成小约定 · +${task[2]} 爪爪币`);
      }
      state.entries.unshift({
        text: `${state.name}${{ feed: '吃饱了，满足地舔了舔嘴巴。', play: '追着小球，度过了一段快乐时光。', sleep: '睡了一个软绵绵的好觉。', pet: '在你的掌心蹭了蹭，发出了开心的声音。', wash: '洗得香香的，准备迎接新的小冒险。' }[action]}`,
        time: new Date().toLocaleString('zh-CN'),
      });
      state.entries = state.entries.slice(0, 30);
    }
    updateUI();
    save();
    mode = 'idle';
    pending = null;
    idleTime = 0;
    pet.position.y = groundHeight();
    pet.rotation.x = 0;
    ball.position.set(1.35, 0.19, 1.65);
    speak('和你在一起，真好。', 3);
  }
  document
    .querySelectorAll('[data-action]')
    .forEach((b) => (b.onclick = () => interact(b.dataset.action)));
  const raycaster = new THREE.Raycaster();
  const pointerLook = new THREE.Vector3();
  const lookPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
  let pointerLookUntil = 0;
  let pointerStart = null;
  listen(canvas, 'pointerdown', (e) => (pointerStart = { x: e.clientX, y: e.clientY }));
  listen(canvas, 'pointerup', (e) => {
    if (!pointerStart || Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 7)
      return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    const hits = raycaster.intersectObjects(interactables);
    if (hits.length) interact(hits[0].object.userData.action);
  });
  listen(canvas, 'pointermove', (e) => {
    if (e.buttons) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    canvas.style.cursor = raycaster.intersectObjects(interactables).length ? 'pointer' : 'grab';
    if (raycaster.ray.intersectPlane(lookPlane, pointerLook)) pointerLookUntil = total + 3;
  });
  function setNight(n) {
    state.night = n;
    document.body.classList.toggle('night', n);
    $('#day').classList.toggle('active', !n);
    $('#night').classList.toggle('active', n);
    $('#time-label').textContent = n ? '夜晚 · 月色温柔' : '午后 · 阳光正好';
    hemi.color.set(n ? 0xa6b6e0 : 0xffeddf);
    hemi.intensity = n ? 1.15 : 2.5;
    sun.color.set(n ? 0xa9bfff : 0xffd6b5);
    sun.intensity = n ? 0.65 : 2.8;
    fillLight.intensity = n ? 0.25 : 1;
    lamp.intensity = n ? 12 : 0;
    renderer.toneMappingExposure = n ? 1 : 1.12;
    toast(n ? '晚安，愿你有一个温柔的梦' : '阳光洒进来了，新的一天慢慢过');
  }
  $('#day').onclick = () => setNight(false);
  $('#night').onclick = () => setNight(true);
  $('#zoom-in').onclick = () => {
    camera.position
      .sub(controls.target)
      .multiplyScalar(0.87)
      .clampLength(8, 22)
      .add(controls.target);
  };
  $('#zoom-out').onclick = () => {
    camera.position
      .sub(controls.target)
      .multiplyScalar(1.13)
      .clampLength(8, 22)
      .add(controls.target);
  };
  $('#reset').onclick = () => {
    camera.position.set(10, 10, 12);
    controls.target.set(0, 0.45, 0);
    controls.update();
  };
  $('#photo').onclick = () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.download = `pawstice-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('小屋的温柔瞬间，已存成照片');
  };
  let audioCtx,
    noiseSource,
    gain,
    isSound = false;
  $('#sound').onclick = () => {
    try {
      if (!audioCtx) {
        audioCtx = new AudioContext();
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 3, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
          last = (last + Math.random() * 0.04 - 0.02) / 1.02;
          data[i] = last * 3;
        }
        noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buf;
        noiseSource.loop = true;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 650;
        gain = audioCtx.createGain();
        gain.gain.value = 0;
        noiseSource.connect(filter).connect(gain).connect(audioCtx.destination);
        noiseSource.start();
      }
      audioCtx.resume();
      isSound = !isSound;
      gain.gain.setTargetAtTime(isSound ? 0.15 : 0, audioCtx.currentTime, 0.4);
      $('#sound').innerHTML =
        icon(isSound ? 'volume-2' : 'volume-x') +
        `<span>${isSound ? '小屋白噪音 · 开启' : '听听小屋的声音'}</span>`;
      refreshIcons();
    } catch {
      toast('当前设备暂不支持环境声音');
    }
  };
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.fov = camera.aspect < 1 ? 52 : 34;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  resize();
  $('#loading').classList.add('hidden');
  let last = performance.now(),
    decay = 0,
    saveTime = 0;
  const bubbleVector = new THREE.Vector3();
  function tick(now) {
    animationFrame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden || editingPet) return;
    total += dt;
    decay += dt;
    saveTime += dt;
    controls.update();
    back.visible = camera.position.z > -2.7;
    left.visible = camera.position.x > -3.5;
    if (mode === 'walk') {
      motor.step(petPos, pet, path, dt, state.pet);
      if (!path.length && pending) beginAction();
      else if (!path.length) {
        mode = 'idle';
        idleTime = 0;
      }
    } else if (mode === 'idle') {
      motor.step(petPos, pet, [], dt, state.pet);
      idleTime += dt;
      if (idleTime > 12) {
        idleTime = 0;
        if (state.stats[0] < 55) interact('feed', true);
        else if (state.stats[2] < 40) interact('sleep', true);
        else if (state.stats[3] < 55) interact('wash', true);
        else if (state.stats[1] < 55) interact('play', true);
        else
          for (let i = 0; i < 20; i++) {
            const target = new THREE.Vector3(
              -3.4 + Math.random() * 6.6,
              0,
              -2.7 + Math.random() * 5.4,
            );
            if (!blocked(target.x, target.z)) {
              const p = route(target);
              if (p.length) {
                path = p;
                mode = 'walk';
                pending = null;
                break;
              }
            }
          }
      }
    } else {
      motor.step(petPos, pet, [], dt, state.pet);
      actionTime += dt;
      if (mode === 'feed' || mode === 'wash') {
        const targetAngle =
          mode === 'feed'
            ? Math.atan2(feeding.position.x - petPos.x, feeding.position.z - petPos.z)
            : Math.PI / 2;
        pet.rotation.y +=
          Math.atan2(
            Math.sin(targetAngle - pet.rotation.y),
            Math.cos(targetAngle - pet.rotation.y),
          ) *
          (1 - Math.exp(-dt * 5));
      } else if (mode === 'play') {
        ball.position.x = 1.35 + Math.sin(total * 4) * 0.24;
        ball.position.y = 0.19 + Math.abs(Math.sin(total * 4)) * 0.18;
        ball.rotation.z = total * 2;
      }
      if (actionTime > (mode === 'sleep' ? 8 : 5)) finishAction();
    }
    pet.position.copy(petPos);
    pet.position.y = groundHeight();
    const lookTargets = [
      { position: ball.position },
      { position: feeding.position },
      { position: new THREE.Vector3(0, 1.6, -3) },
    ];
    if (pointerLookUntil > total) lookTargets.push({ position: pointerLook });
    if (isSound) lookTargets.push({ position: camera.position });
    petComponent.update(mode, total, dt, { ...motor, groundHeight, lookTargets });
    if (total < bubbleUntil) {
      pet.getWorldPosition(bubbleVector);
      bubbleVector.y += petComponent.height + 0.35;
      bubbleVector.project(camera);
      $('#bubble').style.left = `${(bubbleVector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
      $('#bubble').style.top = `${(-bubbleVector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
    } else $('#bubble').classList.add('hidden');
    if (decay > 15) {
      state.stats = state.stats.map((v, i) => Math.max(0, v - [0.5, 0.3, 0.35, 0.2][i]));
      decay = 0;
      updateUI();
      $('#mood').textContent =
        Math.min(...state.stats) < 35 ? '有一点需要照顾，来陪陪我吧' : '今天也很开心有你在';
    }
    if (saveTime > 30) {
      save();
      saveTime = 0;
    }
    renderer.render(scene, camera);
  }
  animationFrame = requestAnimationFrame(tick);
  listen(window, 'pagehide', save);
  listen(document, 'visibilitychange', () => {
    last = performance.now();
  });
  const debug = {
    state,
    get petComponent() {
      return petComponent;
    },
    get mode() {
      return mode;
    },
    get position() {
      return petPos.toArray();
    },
    interact,
    route,
    obstacles,
    scene,
    renderer,
    motor,
  };

  listen(document, 'keydown', (e) => {
    if (e.key === 'Escape') document.querySelector('#modal-root').innerHTML = '';
  });

  return {
    debug,
    dispose() {
      activeEditor?.close();
      cancelAnimationFrame(animationFrame);
      lifecycle.abort();
      resizeObserver.disconnect();
      controls.dispose();
      petComponent.dispose();
      audioCtx?.close();
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          for (const material of [object.material].flat()) {
            materials.add(material);
            if (material.map) textures.add(material.map);
          }
        }
      });
      geometries.forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      ui.dispose();
    },
  };
}
