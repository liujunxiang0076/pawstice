# Pawstice 架构

## 模块依赖

```text
main → app/createGame
            ├─ ui/createInterface → config、pet/profile、storage
            ├─ core/createViewport → Three.js
            ├─ scenes/room → Three.js
            ├─ core/navigation → Three.js Vector3
            └─ features/pet → Three.js、profile、模型工厂
```

`main.js` 只负责启动和热更新销毁。`createGame` 持有游戏状态、世界坐标与帧循环，通过公开接口协调界面和场景。

## 边界

- 房间工厂只接收 scene，返回家具、交互对象、障碍和灯，不访问 DOM 或存档。
- PetComponent 负责局部造型和姿态，世界坐标由游戏层拥有。替换模型后刷新拾取列表。
- 寻路函数接收起终点，通过回调读取净空半径，不依赖界面。
- 存档模块可注入 storage，测试无需浏览器；只保留合法需求值和已知任务。
- UI 渲染并控制界面，通过回调通知游戏替换宠物；数值变化和奖励由游戏层控制。
- 配置层存动作与任务描述，后续新增家具能力优先采用数据定义。

## 生命周期

销毁时关闭编辑器、取消动画帧、移除监听器、停止尺寸观察、释放渲染器与场景资源。编辑器单独管理自己的帧循环与 WebGL 上下文。开发热更新调用销毁，避免重复监听和残留窗口。

## 兼容与范围

正式名称 Pawstice · 爪间时光；保留原存档键。历史文档中的 `src/pet/` 现位于 `src/features/pet/`，`src/style.css` 现位于 `src/styles/global.css`。

采用按功能划分的原生 JavaScript 结构，不在此轮引入新 UI 框架或一次性 TypeScript 迁移。下一阶段可按需要进一步提取互动状态机、音频与输入控制。
