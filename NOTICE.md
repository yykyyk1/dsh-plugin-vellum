# 第三方素材声明 / Third-Party Notices

本仓库中以下素材**不属于** MIT 许可范围，版权归各自权利人所有。

## 1. 音效（`plugin/assets/vs/*.mp3`）

来源：Visual Studio Code 安装目录

```
resources/app/out/vs/platform/accessibilitySignal/browser/media/
```

文件对应关系：

| 本仓库文件 | 原文件 | 用途 |
| --- | --- | --- |
| click.mp3 | diffLineInserted.mp3 | 点击输入框按钮 |
| open.mp3 | save.mp3 | 点击空态舞台 |
| send.mp3 | requestSent.mp3 | 发送消息 |
| think.mp3 | progress.mp3 | 生成中循环 |
| response.mp3 | responseReceived1.mp3 | 回答到达 |
| ask.mp3 | chatUserActionRequired.mp3 | 需要用户操作 |
| done.mp3 | taskCompleted.mp3 | 任务完成 |

版权：Copyright (c) Microsoft Corporation。
VS Code 的**源代码**采用 MIT 许可，但这些**媒体素材**并未在同一许可下明确授权再分发。
本仓库仅为**本机自用与学习**收录；公开发布前请替换为自有音效。

## 2. 桌宠模型

`lowpoly_trump_dance.glb`（未直接包含在仓库中，仅包含由它渲染出的 WebM）。
该模型疑似来自 Sketchfab / Super Smash Bros. 相关资源，人物形象涉及肖像权。
版权与肖像权归原权利人。本仓库仅为**本机自用**收录。

## 3. 品牌图形

鲸鱼图标（`plugin/icon.svg`）与界面中的 `DEEPSEEK` 字样属于 DeepSeek 官方品牌资产。
本插件为非官方主题，与 DeepSeek 无隶属关系。

## 4. 片头动画

`plugin/tools/boot-splash.mjs` 用于重建 DSH 自带的 `deepseek-boot` 启动动画负载，
仅供本机使用与学习交流。

---

如果你要在此基础上公开分发或商用，请把以上素材全部替换为自有或有明确授权的资源。