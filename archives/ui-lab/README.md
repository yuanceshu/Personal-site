# UI LAB 冻结源码

`sources` 是2026-09-15复制的10版源码；不自动追踪正式作品。来源原始路径/哈希和视觉比对放 `.local`（Git忽略），不发布。不要将外部原始README、Prompt、环境配置复制进来。

从 `apps/main` 运行 `node scripts/ui-lab/build-snapshots.mjs [experiment/variant]` 进行一次性打包；无参数打包全部。仅消费本目录，不读取正式组件。现有 esbuild 为 tsx 的已安装传递依赖，未新增包。React/ReactDOM/Zod从现有安装解析，具体版本见各构建 manifest。`adaptations` 仅替换Next运行时和离线演示，不重新设计原版。

浏览器验证与预览完成后运行 seal 脚本记录文件校验值，已封存目录禁止重建。主站 `build` 不运行归档脚本。未来结果新增版本，不覆盖封存档案。

首批10版已于2026-09-16封存。以下是本次一次性归档顺序，不应对已封存目录重跑：

1. 在非公开 `.local/sources.json` 核对逐文件来源及复制时SHA-256。
2. `node scripts/ui-lab/build-snapshots.mjs` 生成静态包。
3. 启动主站开发服务3000及以 `public` 为根的本地静态服务4187，再运行 `node scripts/ui-lab/capture-previews.mjs`；检查20张原版/快照比对及公开预览。
4. `npx playwright test --config=tests/ui-lab/playwright.config.ts snapshots.spec.ts` 单独生成10版交互验收报告。
5. `npx tsx scripts/ui-lab/seal-snapshots.ts` 检查来源、隐私和上述证据，写入manifest并激活清单。

上述工具按首批10版范围编写；新增批次需相应补齐来源、清单、测试与数量校验，不删除旧manifest绕过保护。复验现有版本只需 `npm run test:ui-lab` 与 `npm run test:ui-lab:browser`。
