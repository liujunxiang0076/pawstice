import { icon, refreshIcons } from './icons.js';
import { actions, taskDefs } from '../config/game.js';
import {
  createPetProfile,
  normalizePetProfile,
  petPortrait,
  PET_SPECIES,
  PET_STYLE_PRESETS,
} from '../features/pet/profile.js';
import { saveGameState } from '../core/storage.js';
import { releases } from '../config/releases.js';
export function createInterface(state, { onPetChanged }) {
  const $ = (selector) => document.querySelector(selector);
  $('#app').innerHTML = `<header>
<div class="brand">
<div class="brand-icon">${icon('paw-print')}</div>
<div>
<strong>pawstice<span class="brand-dot">.</span>
</strong>
<small>爪间时光 / 暮蓝放映室</small>
</div>
</div>
<nav>
<button class="active" data-nav="home">${icon('house')}我的小屋</button>
<button data-nav="journal">${icon('book-open')}成长日记</button>
<button data-nav="guide">${icon('compass')}探索指南</button>
</nav>
<div class="top-right">
<div class="coins">${icon('circle-dollar-sign')}<b id="coins">${state.coins}</b>
</div>
<div class="avatar">${icon('user-round')}</div>
</div>
</header>
<main>
<div class="intro">
<div>
<div class="eyebrow">PAWSTICE / THE BLUE HOUR</div>
<h1>在小小世界，<em>慢慢奇遇。</em>
</h1>
<p>一间有温度的房间，一位有自己主意的小小室友。</p>
</div>
<div class="weather">${icon('sun')}<div>
<span id="time-label">午后 · 阳光正好</span>
<small>ROOM 01 · A MOMENT TO STAY</small>
</div>
</div>
</div>
<div class="layout">
<section>
<div class="room-wrap">
<div class="room-top">
<div class="room-label">
<i>
</i> 暮蓝客厅 ${icon('chevron-down')}</div>
<div class="day-switch">
<button id="day" class="active">${icon('sun')}白天</button>
<button id="night">${icon('moon')}夜晚</button>
</div>
</div>
<canvas id="scene" aria-label="3D 宠物房间：拖动旋转视角，点击家具互动">
</canvas>
<div id="bubble" class="bubble hidden">
</div>
<div class="scene-caption">THE ROOM IS YOUR LITTLE UNIVERSE.</div>
<div class="scene-controls">
<button class="icon-btn" id="zoom-in" aria-label="放大">${icon('plus')}</button>
<button class="icon-btn" id="zoom-out" aria-label="缩小">${icon('minus')}</button>
<button class="icon-btn" id="reset" aria-label="重置视角">${icon('rotate-ccw')}</button>
<button class="icon-btn" id="photo" aria-label="保存房间照片">${icon('camera')}</button>
</div>
<div class="room-bottom">
<div class="hint">${icon('mouse-pointer-2')}拖动旋转视角 · 滚轮缩放 · 点击物品互动</div>
<button class="sound" id="sound">${icon('volume-x')}<span>听听小屋的声音</span>
</button>
</div>
<div id="loading" class="loading">正在为你打开温暖的小屋…</div>
</div>
<div class="interactions">
<div class="section-label">
<strong>给这段时光，添一点故事</strong>
<span>CHOOSE A LITTLE MOMENT</span>
</div>
<div class="actions">${actions
    .map(
      ([id, ic, t, d]) => `<button class="action" data-action="${id}">
<span class="action-icon">${icon(ic)}</span>
<strong>${t}</strong>
<small>${d}</small>
</button>`,
    )
    .join('')}</div>
</div>
</section>
<aside class="sidebar">
<div class="card">
<div class="pet-head">
<div class="pet-avatar" id="pet-avatar">🐱</div>
<div class="pet-title">
<strong id="pet-name">
</strong>
<small id="pet-subtitle">
</small>
</div>
<button class="change" id="change">换一位</button>
</div>
<div class="mood">${icon('heart')}<span id="mood">今天也很开心有你在</span>
</div>${['饱食度', '心情值', '精力值', '清洁度']
    .map(
      (s, i) => `<div class="stat">
<div class="stat-head">
<div>${icon(['utensils', 'smile', 'moon', 'droplets'][i])}${s}</div>
<b id="stat-${i}">
</b>
</div>
<div class="track">
<div class="fill" id="fill-${i}">
</div>
</div>
</div>`,
    )
    .join('')}</div>
<div class="card">
<div class="card-title">
<strong>${icon('sprout')}今天的陪伴清单</strong>
<small id="task-count">0 / 3 完成</small>
</div>${taskDefs
    .map(
      ([id, t, n]) => `<div class="task" id="task-${id}">
<span class="check">
</span>
<span>${t}</span>
<span class="reward">+${n} ♧</span>
</div>`,
    )
    .join('')}<div class="daily-note">TODAY’S LITTLE MOMENTS</div>
</div>
<div class="quote">${icon('flower-2')}<div>每一声呼噜，<br>都是生活的配乐。<small>A SMALL ROOM. AN ENTIRE WORLD.</small>
</div>
</div>
</aside>
</div>
<footer>
<span>${icon('cloud')}陪伴记录自动保存在这台设备</span>
<button class="release-trigger" id="release-log">${icon('book-open')}系统更新日志 <span>v${releases[0].version}</span></button>
<span>用一点点时间，换一整天的治愈 ${icon('heart')}</span>
</footer>
</main>
<div id="modal-root">
</div>
<div id="toast" class="toast hidden">
</div>`;
  $('.card').insertAdjacentHTML(
    'beforeend',
    '<button class="customize-pet" id="customize-pet">自定义宠物 ↗</button>',
  );
  refreshIcons();
  function save() {
    if (!saveGameState(state)) toast('当前浏览器无法保存，请保持页面开启');
  }
  function updateUI() {
    $('#pet-name').textContent = state.name;
    $('#pet-avatar').innerHTML =
      `<img src="${petPortrait(state.petProfile)}" alt="自定义${PET_SPECIES[state.pet].label}肖像"/>`;
    $('#pet-subtitle').textContent =
      PET_SPECIES[state.pet].label + ' · ' + PET_SPECIES[state.pet].description;
    $('#coins').textContent = state.coins;
    state.stats.forEach((v, i) => {
      $(`#stat-${i}`).textContent = `${Math.round(v)} / 100`;
      $(`#fill-${i}`).style.width = `${v}%`;
    });
    taskDefs.forEach(([id]) => {
      $(`#task-${id}`).classList.toggle('done', state.tasks.includes(id));
      $(`#task-${id} .check`).textContent = state.tasks.includes(id) ? '✓' : '';
    });
    $('#task-count').textContent = `${state.tasks.length} / 3 完成`;
  }
  updateUI();
  let toastTimer;
  function toast(msg) {
    $('#toast').textContent = msg;
    $('#toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.add('hidden'), 3000);
  }
  function showModal(html) {
    $('#modal-root').innerHTML =
      `<div class="modal-backdrop"><div class="modal"><button class="close" aria-label="关闭">${icon('x')}</button>${html}</div></div>`;
    refreshIcons();
    $('.close').onclick = () => ($('#modal-root').innerHTML = '');
    $('.modal-backdrop').onclick = (e) => {
      if (e.target.classList.contains('modal-backdrop')) $('#modal-root').innerHTML = '';
    };
  }
  $('#release-log').onclick = () => {
    showModal(
      `<div class="release-heading"><small>PAWSTICE / WHAT’S NEW</small><h2 id="release-title">小屋在慢慢长大</h2><p>系统更新日志 · 记录每一次细微的进步</p></div><div class="release-list"></div>`,
    );
    const modal = $('.modal');
    modal.classList.add('release-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'release-title');
    releases.forEach((release, index) => {
      const entry = document.createElement('article');
      entry.className = 'release-entry';
      const meta = document.createElement('div');
      meta.className = 'release-meta';
      const version = document.createElement('strong');
      version.textContent = `v${release.version}${index === 0 ? ' · 当前版本' : ''}`;
      const date = document.createElement('time');
      date.dateTime = release.date;
      date.textContent = release.date;
      meta.append(version, date);
      const title = document.createElement('h3');
      title.textContent = release.title;
      entry.append(meta, title);
      release.changes.forEach((group) => {
        const heading = document.createElement('h4');
        heading.textContent = group.type;
        const list = document.createElement('ul');
        group.items.forEach((text) => {
          const item = document.createElement('li');
          item.textContent = text;
          list.append(item);
        });
        entry.append(heading, list);
      });
      $('.release-list').append(entry);
    });
    const close = () => {
      $('#modal-root').replaceChildren();
      $('#release-log').focus();
    };
    $('.close').onclick = close;
    $('.modal-backdrop').onclick = (e) => {
      if (e.target === e.currentTarget) close();
    };
    modal.onkeydown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        $('.close').focus();
      }
    };
    $('.close').focus();
  };
  $('#change').onclick = () => {
    let selected =
      PET_STYLE_PRESETS.find((p) => p.species === state.pet && p.fur === state.petProfile.fur)
        ?.id ?? state.pet;
    const adoptionCards = PET_STYLE_PRESETS.slice(0, 8)
      .map(
        (preset) =>
          `<button class="pet-option ${selected === preset.id ? 'selected' : ''}" data-pet="${preset.species}" data-style="${preset.id}"><span><img src="${petPortrait(preset)}" alt="${preset.name}"/></span>${preset.name}<small>${PET_SPECIES[preset.species].label} · ${preset.description}</small></button>`,
      )
      .join('');
    showModal(
      `<h2>遇见你的小小家人</h2><p>不同的外形，一样全心全意的陪伴。</p><div class="pet-options adoption-options">${adoptionCards}</div><label>给它一个专属的名字</label><input id="name-input" maxlength="12" placeholder="比如：奶糖"/><button class="primary" id="adopt">一起回家</button>`,
    );
    $('#name-input').value = state.name;
    document.querySelectorAll('[data-pet]').forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.style;
          document
            .querySelectorAll('[data-pet]')
            .forEach((x) => x.classList.toggle('selected', x === b));
          $('#name-input').value =
            PET_STYLE_PRESETS.find((p) => p.id === selected)?.name ?? '小可爱';
        }),
    );
    $('#adopt').onclick = () => {
      const preset = PET_STYLE_PRESETS.find((p) => p.id === selected);
      state.pet = preset?.species ?? selected;
      state.name = $('#name-input').value.trim() || '小可爱';
      state.petProfile = normalizePetProfile({
        ...createPetProfile(state.pet),
        ...preset,
        breed: preset.id,
        name: state.name,
      });
      onPetChanged();
      updateUI();
      save();
      $('#modal-root').innerHTML = '';
      toast(`${state.name}，欢迎回家！`);
    };
  };
  document.querySelectorAll('[data-nav]').forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.nav === 'journal') {
          showModal(
            `<h2>我们的成长日记</h2><p>把每一个平凡的小瞬间，认真收藏。</p><div id="entries"></div>`,
          );
          const entries = state.entries.length
            ? state.entries
            : [{ text: '你们的故事，从今天开始。试着喂食或一起玩耍吧。', time: '初次相遇' }];
          entries.slice(0, 8).forEach((e) => {
            const div = document.createElement('div');
            div.className = 'journal-entry';
            div.textContent = e.text;
            const small = document.createElement('small');
            small.textContent = e.time;
            div.appendChild(small);
            $('#entries').appendChild(div);
          });
        }
        if (b.dataset.nav === 'guide')
          showModal(
            '<h2>慢慢探索小屋</h2><p>01 · 拖动房间，360° 发现每个小角落。滚轮或双指捏合可以缩放。</p><p>02 · 点击食盆、球、小窝、浴盆或宠物，开始一次互动；也可以使用下方快捷按钮。</p><p>03 · 宠物会自己散步、吃饭和休息。它会绕开家具，请给它一点时间走到目的地。</p><p>04 · 完成今天的陪伴清单赚取爪爪币。需求与日记会自动保存，明天再来完成新的约定。</p><p>05 · 切换昼夜，听一段小屋白噪音，或用相机留下此刻。右上方的天气是小屋氛围。</p>',
          );
      }),
  );

  return {
    updateUI,
    toast,
    save,
    dispose() {
      clearTimeout(toastTimer);
      $('#modal-root').replaceChildren();
      $('#app').replaceChildren();
    },
  };
}
