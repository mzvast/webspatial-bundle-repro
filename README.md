# WebSpatial 旧版 Vite 插件包体积复现实验

本仓库实际构建三组最小 React 应用，验证 `@webspatial/vite-plugin` 的编译时隔离是否减少 Web 产物体积，并测量 Web 版本相对纯 React 的增量。

SDK 固定为 [`webspatial/webspatial-sdk@0d6989338ce0d81298e37dec0cceeae655b81194`](https://github.com/webspatial/webspatial-sdk/tree/0d6989338ce0d81298e37dec0cceeae655b81194)。脚本自动获取该提交并从源码构建 SDK。

## 实测结论

在本最小 Demo 中，Web 编译时隔离生效。Web 比 AVP 少 **101.71 KiB raw、26.35 KiB gzip**；Web 相对纯 React 仅增加 **189 B raw、66 B gzip**。

| 构建组 | JS raw | JS gzip | 相对纯 React 的 raw 增量 | 相对纯 React 的 gzip 增量 |
| --- | ---: | ---: | ---: | ---: |
| 纯 React，无 WebSpatial 插件和 SDK | 143,629 B | 46,122 B | — | — |
| WebSpatial 插件 + Web | 143,818 B | 46,188 B | 189 B（0.132%） | 66 B（0.143%） |
| WebSpatial 插件 + AVP | 247,965 B | 73,174 B | 104,336 B（72.643%） | 27,052 B（58.653%） |

以 AVP 为分母，Web 节省 **42.00% raw、36.88% gzip**。以 Web 为分母，AVP 增加 **72.42% raw、58.43% gzip**。两种百分比使用不同分母。

这里 `1 KiB = 1024 B`。Vite 日志中的 `kB` 使用十进制。

## 一键复现

需要 Git、Node.js 和 pnpm，可联网访问 GitHub 与公共 npm 源。实验脚本使用 POSIX 环境变量命令，适用于 macOS、Linux 或 WSL。验证环境为 macOS arm64；Linux 和 WSL 可按相同命令运行，结果以本机产出为准。

参考环境：Node.js **24.7.0**、pnpm **9.0.0**。仓库 `.nvmrc` 固定 Node 版本；脚本接受 Node 22 及以上。Node/zlib 版本会影响 gzip 字节数，精确对比请采用参考环境。

```sh
git clone https://github.com/mzvast/webspatial-bundle-repro.git
cd webspatial-bundle-repro

# 已安装 nvm 时使用；也可自行安装 Node.js 24.7.0。
nvm install
nvm use

# 已有 pnpm 9.0.0 时可跳过。
npm install --global pnpm@9.0.0

# 无需预先安装项目依赖。
node scripts/reproduce.mjs
```

脚本执行以下工作：

1. 获取固定 SDK 提交到 `.cache/sdk`，校验 HEAD，按 SDK 原锁文件安装构建依赖。
2. 从源码构建 Core SDK 和 React SDK。
3. 按两份锁文件安装 Demo 与纯 React 基准依赖。
4. 构建纯 React、Web、AVP 三组生产产物。
5. 校验业务源码、生产构建参数、依赖版本和实际 Runtime/SDK 入口。
6. 输出全部最终 JS 的 raw、gzip、差值、百分比和 SHA-256。
7. 比较 Web 与纯 React 的最终 JavaScript，验证 Web 增量来自 SDK 元数据初始化。

成功时结尾显示：

```text
Reproduction passed. Inspect evidence/sizes.json and evidence/web-overhead.json.
```

`pnpm reproduce` 是同一入口的快捷命令。首次运行需下载 SDK 源码和依赖；后续运行复用 checkout 和包缓存。脚本检测到 SDK 已跟踪文件有本地改动时停止，保留已有编辑。

## 逐步执行

```sh
node scripts/prepare-sdk.mjs
pnpm install --frozen-lockfile --ignore-scripts
pnpm --dir baseline install --frozen-lockfile --ignore-scripts

pnpm run build:baseline
pnpm run build:web
pnpm run build:avp

pnpm verify
pnpm measure
node scripts/verify-overhead.mjs
```

`pnpm install` 中的 `--ignore-scripts` 跳过安装生命周期脚本。SDK 的实际构建由准备脚本显式执行。

## 三组如何保持可比

业务文件均为：

```tsx
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(<div enable-xr>Hello</div>);
```

纯 React 基准保留同样的 `enable-xr` 属性，确保业务输入一致。Web/AVP 的 JSX Runtime 决定该属性如何被处理。本实验验证生产构建和包体积。

| 项目 | 纯 React | Web | AVP |
| --- | --- | --- | --- |
| React / React DOM | 18.3.1 | 18.3.1 | 18.3.1 |
| Vite | 6.4.2 | 6.4.2 | 6.4.2 |
| `@vitejs/plugin-react` | 4.4.1 | 4.4.1 | 4.4.1 |
| `@webspatial/vite-plugin` | 无 | 1.0.1 | 1.0.1 |
| React SDK / Core SDK | 无 | 目标提交源码，1.6.1 | 目标提交源码，1.6.1 |
| JSX 输入来源 | React | WebSpatial | WebSpatial |
| 平台变量 | 清除 `XR_ENV` | 清除 `XR_ENV` | `XR_ENV=avp` |

插件版本 `1.0.1` 来自独立的 [web-builder-plugins](https://github.com/webspatial/web-builder-plugins) 项目。SDK 目标提交的锁文件未记录此插件，本实验明确锁定这一发布版本。

三组共同使用 production 模式、Vite 默认浏览器目标、esbuild 压缩、默认摇树优化和 source map。统一去重 React/React DOM，确保链接 SDK 使用 Demo 的同一 React 实例。

Web、AVP 共用同一个 `src/main.tsx`、依赖清单、锁文件和 Vite 配置；切换环境变量后，旧版插件自动改变 JSX Runtime、SDK 别名、base、输出目录与清空目录行为。纯 React 基准独立安装，仅依赖 React、React DOM、Vite 和 React 插件。

验收脚本核对三组业务源码哈希、production 模式和生产 `build` 参数。比较时排除插件自动设置的输出目录及清空行为。基准的全部已安装包版本均出现在 SDK 组中，确保共同间接依赖版本一致。

## 实际入口与模块证据

观测插件记录 Vite 实际解析结果、Rollup 模块图和各模块的渲染贡献。记录中的 `<repo>` 代表当前仓库根目录，便于跨机器比较。

| 项目 | 纯 React | Web | AVP |
| --- | --- | --- | --- |
| 实际打包 JSX Runtime | `react/jsx-runtime` | SDK `dist/jsx/jsx-runtime.web.js` | SDK `dist/jsx/jsx-runtime.js` |
| SDK 主入口解析结果 | 无 | SDK `dist/web/index.js` | SDK `dist/default/index.js` |
| 实际打包 React SDK 主入口 | 无 | 本 Demo 无该依赖 | SDK `dist/default/index.js` |
| 实际打包 Core SDK | 无 | 无 | Core SDK `dist/index.js` |

Web Runtime 直接转发 React 的 `jsx`、`jsxs` 和 `Fragment`。该最小业务无需导入 Web SDK 主入口；入口解析探针确认 `/web` 的目标路径，模块图确认主入口没有被打包。这两个结果分别记录，避免把别名配置当成实际加载证据。

AVP Runtime 导入 `withSpatialized2DElementContainer`、`withSpatialMonitor` 和 `Model`，并继续引入 React SDK 主入口与 Core SDK。编译时平台分流在此形成不同依赖链。

## 体积差异来自哪里

### Web 相对纯 React

Web 仅保留以下元数据初始化的压缩形式：创建 `window.__webspatialsdk__`，写入 `react-sdk-version = "1.6.1"` 和 `XR_ENV = "web"`。

`verify-overhead.mjs` 从实际最终 JS 移除这段初始化，并衔接相邻变量声明；source map 文件名归一化后，代码与纯 React 产物逐字相同。增加的 raw 大小恰为 **189 B**。gzip 增量 **66 B** 来自对完整最终文件的实际压缩，其中包含各自 source map 文件名。

因此本 Demo 中 Web 开销接近零，保留少量版本与环境元数据。

### AVP 相对 Web

Rollup 提供以下摇树优化后、最终压缩前的模块贡献：

| SDK 模块 | Web 字符数 | AVP 字符数 |
| --- | ---: | ---: |
| Web JSX Runtime | 258 | 0 |
| AVP JSX Runtime | 0 | 1,470 |
| React SDK 主入口 | 0 | 107,662 |
| Core SDK 主入口 | 0 | 103,917 |

React SDK 保留空间容器、Portal、二维画面同步、DOM 代理、空间事件及样式同步实现。Core SDK 保留平台适配、原生桥接、场景和空间实体命令实现。SDK 经 tsup 预构建，Vite 分别将这些入口视为一个模块；职责划分依据固定提交源码与预构建产物。

三组的 React、React DOM、scheduler 基础模块贡献相同。AVP 还引入少量 CommonJS 辅助代码及 SDK 所引用的 production `jsx-dev-runtime` 包装。文件名包含 `dev`，实际构建仍使用 production 条件。

`renderedLength` 是代码字符数，用于模块归因。最终 raw 和 gzip 直接测量实际文件。gzip 共享跨模块字典，模块压缩大小无法直接相加。

## 结果文件与计算口径

| 路径 | 内容 |
| --- | --- |
| `evidence/sizes.json` | 本机三组 raw/gzip、产物哈希、基准增量、Web/AVP 双向对比 |
| `evidence/environment.json` | 一键复现时记录的 Node、pnpm、zlib、平台和 SDK 提交 |
| `evidence/baseline.json`、`web.json`、`avp.json` | 本机模块图、解析结果、输入哈希和有效配置 |
| `evidence/web-overhead.json` | Web 189 B 增量的代码比较证据 |
| `evidence/build-*.log` | 一键复现保存的三组实际构建日志 |
| [`results/`](results/) | 本仓库提交时的参考结果与日志 |

产物目录：

- 纯 React：`baseline/dist/assets/`。
- Web：`dist/assets/`。
- AVP：`dist/webspatial/avp/assets/`。

统计依据每个平台实际发出的 JS chunk 清单。Web 目录下嵌套的 AVP 文件不会被重复计入。HTML、source map 和 SDK 中间构建产物不计入最终 JS 统计。gzip 使用 Node `gzipSync`，level 6，对每个文件独立压缩后求和。

```text
相对基准增量 = 平台体积 - 纯 React 体积
相对基准增量百分比 = 相对基准增量 / 纯 React 体积 × 100%
Web 相对 AVP 节省百分比 = (AVP - Web) / AVP × 100%
AVP 相对 Web 增长百分比 = (AVP - Web) / Web × 100%
```

参考结果环境：Node `v24.7.0`、pnpm `9.0.0`、zlib `1.3.1-470d3a2`、macOS arm64。三组各输出一个 JS 文件。切换 Node/zlib、压缩工具、业务导入或 SDK 版本后，应以重新生成的结果为准。

本结论适用于所列提交、依赖和最小业务。真实应用显式使用 SDK API 后，需要测量其实际依赖图和产物。AVP 空间交互的运行时行为可另用设备或模拟器验证。
