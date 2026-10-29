# 声音素材说明

本插件除「片头」外，交互音效直接使用 **Visual Studio Code** 自带的
accessibility signal 音频（`progress` / `requestSent` / `responseReceived` /
`chatUserActionRequired` / `taskCompleted` / `save` / `diffLineInserted`），
构建时以 base64 内联进 `client.js`。

- 来源：Visual Studio Code 安装目录 `resources/app/out/vs/platform/accessibilitySignal/browser/media/`
- 版权：Copyright (c) Microsoft Corporation。VS Code 的**源代码**是 MIT 许可，
  但这些**媒体素材**并未在同一许可下明确授权再分发。
- 因此：本机自用没有问题；如果要公开发布（商店、GitHub Release 等），
  建议改用 `src/sound.js` 里同族的合成音色（把 `assets/vs/` 去掉重新构建即可），
  或者在插件里改成"检测到本机 VS Code 时才加载原声"。

品牌图形（鲸鱼）来自 DeepSeek 官方图标，同样仅用于本机个性化。