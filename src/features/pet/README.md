# PetComponent：可配置宠物组件

模型、动画、配置校验与编辑器已从房间脚本独立出来，不依赖 DOM 状态、房间家具或 localStorage。当前使用程序化模型，尚不支持任意 GLB 上传或自由骨架编辑。

## 半写实造型更新

猫狗现使用不同的躯干截面、口鼻长度、耳形和尾巴曲线，主躯干为连续曲面。`coat.js` 生成 512px 短毛纹理、表面条纹和渐细曲线，躯干叠加一层稀疏短毛线段；这是轻量程序效果，不是照片级毛发模拟。

四肢包含髋/肩、膝/肘和踝关节。`solveLeg` 按目标脚掌位置计算两段关节角度，四拍步态区分支撑期与摆动期；当前为平面步态修正，并未实现复杂地形的足底射线或完整骨骼蒙皮。睡姿降低躯干并收腿，进食加入下蹲低头，眨眼统一控制眼睛各部件。

原 v1 自定义配置保持兼容。纹理、细毛线段及几何体在重建/销毁时统一释放。

## 文件职责

| 文件            | 职责                                                    |
| --------------- | ------------------------------------------------------- |
| profile.js      | v1 配置、物种定义、校验、旧存档迁移、导入导出、动态肖像 |
| createPetRig.js | 创建猫狗模型与关节，集中管理几何体和材质生命周期        |
| PetComponent.js | 稳定的 object3D、动画更新、外观替换、拾取列表、销毁     |
| PetEditor.js    | 独立 3D 草稿预览、表单、配置文件、提交或取消            |
| pet-editor.css  | 暮蓝主题的编辑器与手机布局                              |

## 使用

```js
import { PetComponent } from './features/pet/PetComponent.js';
import { createPetProfile } from './features/pet/profile.js';

const pet = new PetComponent({
  ...createPetProfile('cat'),
  name: '小墨',
  fur: '#384650',
  accent: '#e6d9c8',
  eyes: '#71967c',
  pattern: 'socks',
  collar: true,
  collarColor: '#cd7854',
  size: 0.9,
});
scene.add(pet.object3D);
pet.object3D.position.set(0, 0, 0);
pet.update('walk', elapsedSeconds, deltaSeconds);
pet.setProfile({ ...pet.profile, fur: '#b97749' });
// 外观重建后重新获取 pickables，不能缓存旧的 Mesh 引用。
const targets = pet.pickables;
// 移除实例时释放其独立资源。
pet.dispose();
```

`object3D` 在 setProfile 前后保持不变，调用者拥有其世界坐标和朝向。动画只修改内部模型，不改变房间中的移动位置。多实例不共享待释放的材质。

动作：idle、walk、feed、play、sleep、pet、wash。房间继续负责寻路、需求值、奖励和动作何时完成；组件只负责表现。体型限于 0.8–1.0，寻路从 navigationRadius 读取净空参数。

## 外观编辑

```js
import { openPetEditor } from './features/pet/PetEditor.js';
const editor = openPetEditor({
  profile: pet.profile,
  onSave(profile) {
    pet.setProfile(profile);
  },
  onClose() {
    /* 恢复房间模拟 */
  },
});
// 也可由宿主关闭：editor.close();
```

编辑器持有独立草稿和 WebGL 实例；只有保存才触发 onSave。关闭、Escape 或遮罩点击会丢弃草稿，并释放帧循环、监听器、控制器、几何体、材质与预览上下文。宿主负责持久化，本项目编辑期间暂停房间模拟。

## 配置格式

所有颜色必须是 #RRGGBB；花纹为 solid、socks、stripes；size 为 0.8–1.0。导入限制 32KB，未知版本与不支持的物种明确报错。

```json
{
  "version": 1,
  "species": "cat",
  "name": "奶糖",
  "fur": "#d7bea0",
  "accent": "#f1e3c9",
  "eyes": "#3a362d",
  "pattern": "socks",
  "collar": false,
  "collarColor": "#cd7854",
  "size": 1
}
```

主存档继续使用原 key，新增 petProfile，旧 pet/name 字段保持同步。只有旧字段的存档会自动补齐外观默认值，需求、奖励、日记不因编辑外观而重置。

## 后续扩展

- 增加参数：先扩展配置 schema、校验与默认值，再接入模型工厂和编辑器控件；发生不兼容变更时增加 version 与迁移函数。
- 新增物种：在 PET_SPECIES 中登记元数据，并在模型工厂实现该物种的造型和 rig；不能仅登记名字就当作已支持新物种。
- 替换成 GLB：新增模型工厂，实现同等生命周期接口；骨骼动画建议另写 AnimationMixer 适配器，并提供取消异步加载与资源释放机制。当前工厂为同步程序网格，不具备现成的异步 GLB 接入能力。

运行 `npm test` 验证配置与组件生命周期；`npm run build` 进行构建。真机触控和不同 GPU 的预览性能仍需另测。
