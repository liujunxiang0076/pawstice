import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PetComponent } from './PetComponent.js';
import {
  normalizePetProfile,
  createPetProfile,
  PET_SPECIES,
  PATTERNS,
  COAT_PRESETS,
  parsePetProfile,
  serializePetProfile,
} from './profile.js';
import './pet-editor.css';

/** Isolated draft and WebGL preview; no access to game state or storage. */
export function openPetEditor({ profile, onSave, onClose = () => {} }) {
  let draft = normalizePetProfile(profile),
    dirty = false,
    closed = false,
    frame = 0,
    motion = 'idle',
    motionTime = 0,
    previewSpeed = 0;
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const events = new AbortController();
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop pet-editor-backdrop';
  overlay.innerHTML = `<section class="pet-editor" role="dialog" aria-modal="true" aria-labelledby="pet-editor-title">
    <div class="pet-editor-heading"><div><small>CHARACTER ATELIER / 01</small><h2 id="pet-editor-title">塑造你的独一无二</h2><p>从一抹毛色开始，认识你的小小室友。</p></div><button type="button" class="editor-close" aria-label="关闭宠物编辑器">×</button></div>
    <div class="pet-editor-grid"><div class="pet-preview-panel"><span class="preview-label">LIVE PORTRAIT · 实时预览</span><canvas aria-label="宠物 3D 预览，拖动可旋转"></canvas><div class="preview-motions">${[
      ['idle', '站立'],
      ['walk', '行走'],
      ['transition', '起步 / 刹停'],
      ['turn', '转弯'],
      ['pet', '撒娇'],
      ['sleep', '睡觉'],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" data-motion="${id}" aria-pressed="${id === 'idle'}">${label}</button>`,
      )
      .join('')}</div><small class="preview-hint">拖动旋转 · 滚轮 / 双指缩放</small></div>
    <form class="pet-editor-form"><fieldset><legend>01 / 小小身份</legend><div class="editor-species">${Object.entries(
      PET_SPECIES,
    )
      .map(
        ([id, s]) =>
          `<button type="button" data-species="${id}" aria-pressed="false">${s.label}<small>${s.description}</small></button>`,
      )
      .join(
        '',
      )}</div><label class="editor-field">名字<input name="name" maxlength="12" required autocomplete="off" /></label></fieldset>
    <fieldset><legend>02 / 专属色彩</legend><div class="coat-presets">${COAT_PRESETS.map((p, i) => `<button type="button" data-preset="${i}" style="--swatch:${p.fur}" aria-label="${p.name}配色" title="${p.name}配色"><span></span>${p.name}</button>`).join('')}</div><div class="editor-colors">${[
      ['fur', '毛色'],
      ['accent', '点缀色'],
      ['eyes', '眼睛'],
      ['collarColor', '项圈色'],
    ]
      .map(
        ([id, label]) =>
          `<label>${label}<input type="color" name="${id}" aria-label="${label}" /></label>`,
      )
      .join('')}</div></fieldset>
    <fieldset><legend>03 / 个性细节</legend><label class="editor-field">花纹<select name="pattern">${Object.entries(
      PATTERNS,
    )
      .map(([id, label]) => `<option value="${id}">${label}</option>`)
      .join(
        '',
      )}</select></label><label class="editor-size">体型 <output></output><input name="size" type="range" min="0.8" max="1" step="0.05" aria-label="宠物体型" /></label><label class="editor-collar"><input type="checkbox" name="collar" />佩戴项圈</label></fieldset>
    <p class="editor-error" role="alert"></p><div class="editor-files"><button type="button" data-command="import">导入配置</button><button type="button" data-command="export">导出配置</button><button type="button" data-command="reset">恢复默认</button><input type="file" accept=".json,application/json" class="hidden" aria-label="导入宠物配置文件" /></div><div class="editor-submit"><small>保存后应用到小屋 · 关闭则放弃修改</small><button type="submit" class="primary">保存我的宠物</button></div></form></div></section>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const $ = (selector) => overlay.querySelector(selector);
  const listen = (el, name, fn) => el.addEventListener(name, fn, { signal: events.signal });
  const error = (message) => {
    $('.editor-error').textContent = message;
  };
  const form = $('form');
  let renderer, pet, controls, observer, stage;
  const scene = new THREE.Scene();
  function close() {
    if (closed) return;
    closed = true;
    events.abort();
    cancelAnimationFrame(frame);
    observer?.disconnect();
    controls?.dispose();
    pet?.dispose();
    if (stage) {
      stage.geometry.dispose();
      stage.material.dispose();
    }
    renderer?.dispose();
    renderer?.forceContextLoss();
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus();
    onClose();
  }
  function sync() {
    for (const key of ['name', 'fur', 'accent', 'eyes', 'collarColor', 'pattern', 'size'])
      form.elements.namedItem(key).value = draft[key];
    form.elements.namedItem('collar').checked = draft.collar;
    form.elements.namedItem('collarColor').disabled = !draft.collar;
    $('output').textContent = `${Math.round(draft.size * 100)}%`;
    overlay
      .querySelectorAll('[data-species]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.species === draft.species)));
    overlay
      .querySelectorAll('[data-preset]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(COAT_PRESETS[Number(b.dataset.preset)].fur === draft.fur),
        ),
      );
    dirty = true;
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
    camera.position.set(2.3, 1.7, 3.3);
    controls = new OrbitControls(camera, $('canvas'));
    controls.target.set(0, 0.62, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.8;
    controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI / 2.05;
    scene.add(new THREE.HemisphereLight('#ffe6d1', '#7a96a7', 2.6));
    const key = new THREE.DirectionalLight('#fff0df', 2.3);
    key.position.set(3, 5, 4);
    scene.add(key);
    stage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.83, 0.87, 0.1, 64),
      new THREE.MeshStandardMaterial({ color: '#7393a0', roughness: 0.9 }),
    );
    stage.position.y = -0.065;
    scene.add(stage);
    pet = new PetComponent(draft);
    scene.add(pet.object3D);
    pet.object3D.rotation.y = 0.22;
    const resize = () => {
      const { width, height } = $('canvas').getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    observer = new ResizeObserver(resize);
    observer.observe($('canvas'));
    resize();
    let last = performance.now(),
      time = 0;
    function loop(now) {
      if (closed) return;
      frame = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (document.hidden) return;
      time += dt;
      if (dirty) {
        pet.setProfile(draft);
        dirty = false;
      }
      motionTime += dt;
      const desiredSpeed =
        motion === 'walk' || motion === 'turn' || (motion === 'transition' && motionTime % 5 < 2.8)
          ? 0.78
          : 0;
      const oldSpeed = previewSpeed;
      previewSpeed += THREE.MathUtils.clamp(desiredSpeed - previewSpeed, -1.6 * dt, 1.05 * dt);
      const turnRate = motion === 'turn' ? 1.1 : 0;
      pet.object3D.rotation.y += turnRate * dt;
      const pose =
        previewSpeed > 0.02 ? 'walk' : ['turn', 'transition'].includes(motion) ? 'idle' : motion;
      pet.update(pose, time, dt, {
        speed: previewSpeed,
        acceleration: dt > 0 ? (previewSpeed - oldSpeed) / dt : 0,
        turnRate,
        preview: true,
      });
      controls.update();
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(loop);
  } catch {
    error('当前设备无法打开 3D 预览，仍可编辑并保存外观配置。');
  }
  sync();
  listen(form, 'input', (e) => {
    const key = e.target.name;
    if (
      !['name', 'fur', 'accent', 'eyes', 'collarColor', 'pattern', 'size', 'collar'].includes(key)
    )
      return;
    draft[key] =
      key === 'collar'
        ? e.target.checked
        : key === 'size'
          ? Number(e.target.value)
          : e.target.value;
    // Do not rewrite a composing text input or change its cursor position.
    if (key !== 'name') sync();
    error('');
  });
  overlay.querySelectorAll('[data-species]').forEach((b) =>
    listen(b, 'click', () => {
      draft.species = b.dataset.species;
      sync();
      error('');
    }),
  );
  overlay.querySelectorAll('[data-preset]').forEach((b) =>
    listen(b, 'click', () => {
      const preset = COAT_PRESETS[Number(b.dataset.preset)];
      draft.fur = preset.fur;
      draft.accent = preset.accent;
      sync();
      error('');
    }),
  );
  overlay.querySelectorAll('[data-motion]').forEach((b) =>
    listen(b, 'click', () => {
      motion = b.dataset.motion;
      motionTime = 0;
      overlay
        .querySelectorAll('[data-motion]')
        .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }),
  );
  listen($('[data-command="reset"]'), 'click', () => {
    draft = createPetProfile(draft.species);
    sync();
    error('');
  });
  listen($('[data-command="export"]'), 'click', () => {
    if (!draft.name.trim()) {
      error('先给它起一个名字吧');
      return;
    }
    const url = URL.createObjectURL(
      new Blob([serializePetProfile(draft)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pawstice-pet.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  listen($('[data-command="import"]'), 'click', () => $('input[type="file"]').click());
  listen($('input[type="file"]'), 'change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 32768) throw new Error('配置文件不能超过 32KB');
      const imported = parsePetProfile(await file.text());
      if (closed) return;
      draft = imported;
      sync();
      error('');
    } catch (err) {
      if (!closed) error(err.message);
    } finally {
      e.target.value = '';
    }
  });
  listen(form, 'submit', (e) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      error('先给它起一个名字吧');
      return;
    }
    try {
      onSave(normalizePetProfile(draft));
      close();
    } catch {
      error('保存失败，请重试；当前修改仍保留在编辑器中。');
    }
  });
  listen($('.editor-close'), 'click', close);
  listen(overlay, 'click', (e) => {
    if (e.target === overlay) close();
  });
  listen(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    if (e.key === 'Tab') {
      const targets = [...overlay.querySelectorAll('button,input,select')].filter(
        (el) => !el.disabled && el.getClientRects().length,
      );
      const first = targets[0],
        last = targets.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  $('.editor-close').focus();
  return { close };
}
