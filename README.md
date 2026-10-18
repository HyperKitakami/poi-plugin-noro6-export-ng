# noro6 舰队导出（poi-plugin-noro6-export-ng）

[poi](https://github.com/poooi/poi) 插件：把当前的**舰队编成**和**所持舰娘 / 装备**直接送进 [noro6 制空权模拟器](https://noro6.github.io/kc-web/)，不用再手工抄编成。

本仓库是 [oooo1111880/poi-plugin-noro6-export](https://github.com/oooo1111880/poi-plugin-noro6-export) 的 fork，由 [HyperKitakami](https://github.com/HyperKitakami) 维护。上游只做「所持数据导出」，本 fork 在此之上补齐了编成与陆航导出，并重做了界面。

![界面预览](https://raw.githubusercontent.com/HyperKitakami/poi-plugin-noro6-export-ng/main/IMG/001.png)

## 功能

- **打开制空权模拟器**：通过 `#import:` 打开内置 noro6 窗口，把当前所持舰娘 / 装备写入 noro6 本地库（`predeck` 留空，不带编成）。若内置窗口已存在则直接刷新
- **单独数据导出**：舰娘 / 装备 × 全部 / 仅锁定，四种组合下拉选择后一键复制 JSON，附 toast 提示
- **导出至 noro6**：按「舰队范围」与「陆航来源」的当前选择生成编成，在内置窗口里载入。若内置窗口已存在则直接刷新，不会重复开窗
- **编成导出至 [jervis](https://jervis.vercel.app/)**：交给系统浏览器打开
- **刷新编成文本**：按当前选择生成 JSON 并显示在下方文本框，可用于覆盖 noro6 里已有的编成，或另作他用；「清空」只清本地显示，不影响游戏数据
- **舰队范围**
  - 自动：联合舰队导出第 1 + 第 2 舰队并带上编成形式（机动 / 水上 / 输送）；第 3 舰队 7 舰满编时按游击部队导出第 3 舰队；否则导出第 1 舰队
  - 手动：自由勾选第 1 ~ 第 4 舰队
  - 勾选舰队为空时不带舰队，只按「陆航来源」导出陆航（未选海域则只剩版本头）
- **陆航导出**：按海域下拉选择，noro6 单次只读 3 队，超出时取前 3 队并标注
- **JSON 文本区**：可复制、可清空，刷新后给出摘要（各队舰数、陆航数量、时间），方便核对

## 相对上游的改动

**新增功能**

- 舰队编成导出（noro6 `predeck` v4）：舰娘 ID / 等级 / 运、装备 ID / 改修 / 熟练度，上游只有所持数据
- 编成导出至 jervis
- 联合舰队自动识别，并把编成形式写入 `f1.t`，noro6 才会按联合计算制空
- 游击部队（第 3 舰队 7 舰）自动识别；也支持手动勾选任意舰队组合
- 陆航按海域导出（`a1` ~ `a3`，含 `mode`），避免多海域基地混编后编号错位
- 内置窗口复用：反复导出只刷新内容，不会一开一堆窗口
- 所持数据改为下拉选择 + 复制，附带 toast 反馈
- 新增 JSON 文本区与刷新摘要；新增的编成导出对缺失字段做兜底（改修 / 运缺失时按 0 输出，熟练度缺失则不写该字段），不会生成非法 JSON

**BUG 修复**

- 装备「仅限已锁定」导出 off-by-one：用最后一格实例 ID 当循环上界，导致 ID 最大的那件装备永远被漏掉
- 复制到剪贴板被塞进导出函数里，光打开模拟器就会顺手改写剪贴板
- 导出结果写进了 `state` 里不存在的字段，界面拿不到内容，复制出去错了也无从核对
- 手拼 JSON 字符串改为对象序列化，消除空装备位留下的空对象与末尾多余逗号

**界面与工程**

- 重排为「内置窗口操作 / 单独数据导出 / 编成导出 / JSON 文本」四个分区，控件对齐
- 文案统一为简体中文，移除未使用的 i18n 目录
- 包名独立为 `poi-plugin-noro6-export-ng`，版本另起 `0.1.0`；保留上游作者署名与 MIT 许可

## 使用说明

**安装**

1. 下载或克隆本仓库。
2. 把整个目录放到 `%APPDATA%\poi\plugins-extra\node_modules\poi-plugin-noro6-export-ng`（**非 npm 安装必须放 plugins-extra，放进 `plugins` 会被 poi 的插件更新流程清掉**；目录名以 `poi-plugin-` 开头，poi 按这个前缀扫描）。
3. 重启 poi，在设置 → 插件里勾选启用，左侧栏会出现「noro6舰队导出」。

插件直接使用 `index.es` / `index.css`，由 poi 运行时转译，不需要额外安装依赖或构建。

**上手顺序**

1. 在 poi 里编好队，点「打开制空权模拟器」：首次会把所持舰娘 / 装备同步进 noro6（编成导出只带编成，不会带库存）。
2. 编成有变动后点「导出至 noro6」，已打开的内置窗口会刷新为当前编成。
3. 陆航默认「不导出」。要算陆航制空，先在「陆航来源」里选海域；同一海域最多 3 队，超出只取前 3 队。
4. 导出第 3 舰队（游击）时 noro6 默认停在第 1 舰队，按界面下方提示切一下标签页。
5. 只要文本就点「刷新编成文本」，复制后手动粘到 noro6。

**常见问题**

- 按钮没反应 / 数据是旧的：插件读的是 poi 内存中的最新数据，回港或编成变更后再点一次刷新即可。
- 「陆航来源」下拉是灰的：poi 里还没有任何航空队数据。
- noro6 侧制空算得不对：确认编成形式（联合 / 单舰队 / 游击）与舰队列是否和游戏内一致。

## 致谢

- 上游原作者 [oooo1111880](https://github.com/oooo1111880) 的 [poi-plugin-noro6-export](https://github.com/oooo1111880/poi-plugin-noro6-export)
- [KyoMiko](https://github.com/KyoMiko) 的 [poi-plugin-fleet-export](https://github.com/KyoMiko/poi-plugin-fleet-export)，上游插件的参考原型，本 fork 的编成导出思路也来自这里
- [poi 浏览器](https://github.com/poooi/poi)，插件运行的环境
- [noro6 制空权模拟器](https://noro6.github.io/kc-web/)，一切的终点

## License

[MIT](./LICENSE)，版权归属见 LICENSE 文件。
