# poi-plugin-noro6-export

[poi](https://github.com/poooi/poi) 插件：将舰队编成与所持舰娘/装备数据导出至 [noro6 制空权模拟器](https://noro6.github.io/kc-web/)，并提供舰娘/装备管理数据的同步入口。

本仓库是 [oooo1111880/poi-plugin-noro6-export](https://github.com/oooo1111880/poi-plugin-noro6-export) 的 fork，由 [HyperKitakami](https://github.com/HyperKitakami) 维护，在上游基础上重做了导出逻辑与界面。

## 功能

- **导出编成至 noro6**：在内置窗口中打开制空权模拟器并直接传入当前编成（`?predeck=`），无需手动粘贴
- **导出编成至 [jervis](https://jervis.vercel.app/)**：以外链方式打开
- **舰队范围**：
  - 自动（默认）：连合舰队导出第 1+2 舰队并附带编成形式（`f1.t`）；第 3 舰队 7 舰编成（遊撃部隊）时导出第 3 舰队；否则导出第 1 舰队
  - 手动：自由勾选第 1~4 舰队
- **陆航导出**：按海域下拉选择，noro6 单次只读取 3 个航空队，超出时取前 3 队
- **舰娘/装备所持数据**：全部 / 仅锁定 × 舰娘 / 装备，一键复制 JSON，配合 noro6 的 `#import:` 同步所持数据
- **JSON 文本**：生成编成 JSON 供手动粘贴，附刷新摘要（各队舰数、陆航数量、时间）

## 相对上游的主要改动

- 修复装备导出 off-by-one（实例 ID 最大的装备会被漏掉）
- 修复装备 `api_level` 缺失时输出非法 JSON（`"rf":undefined`）
- 连合舰队自动写入 `f1.t`（上游缺失导致 noro6 按单舰队计算制空）
- 陆航改为按海域选择（上游按 `api_area_id >= 30` 过滤会丢弃常规图陆航）
- 界面重排：编成导出、所持数据复制、JSON 文本分区布局

## 致谢

- 上游原作者 [oooo1111880](https://github.com/oooo1111880) 的 [poi-plugin-noro6-export](https://github.com/oooo1111880/poi-plugin-noro6-export)
- [KyoMiko](https://github.com/KyoMiko) 的 Fleet Export（上游插件的参考原型）
- [noro6](https://github.com/noro6) 的 [制空权模拟器](https://noro6.github.io/kc-web/)

## License

[MIT](./LICENSE)，版权归属见 LICENSE 文件。
