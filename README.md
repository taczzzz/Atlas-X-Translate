# 该项目是通过CodeX编写的自用项目，仅供交流学习

# Atlas X Translate

因为当前Atlas的X并没有翻译功能？（可能是我没发现）给 `ChatGPT Atlas.app` 用的 unpacked extension，在 `x.com` / `twitter.com` 的帖子详情页里提供：

- 主帖正文整段翻译
- 主帖正文滑词翻译

首版只覆盖主帖正文，不处理回复区、图片 OCR、视频字幕和发帖输入框。

## 目录

- `manifest.json`: MV3 扩展入口
- `src/content/page_bridge.js`: 在页面主世界里调用浏览器内建 `Translator` / `LanguageDetector`
- `src/content/*.js`: 主帖识别、UI 注入、滑词翻译、运行时协调
- `src/options/*`: 扩展设置页
- `test/*.test.js`: 单测

## 安装

### 方式一：Atlas 开发者模式加载

1. 打开 `ChatGPT Atlas.app`
2. 进入扩展管理页
3. 开启开发者模式
4. 选择“加载已解压的扩展程序”
5. 选择当前目录：`/Users/xxx/xxx/xxx/atlas实时翻译`

### 方式二：启动参数兜底

如果 Atlas 没有暴露扩展管理 UI，先完全退出 Atlas，然后执行：

```bash
open -na "/Applications/ChatGPT Atlas.app" --args --load-extension="/Users/xxx/xxx/xxx/atlas实时翻译"
```

## 设置项

- `目标语言`: 默认 `zh-Hans`
- `正文翻译模式`: `manual` 或 `auto`
- `启用滑词翻译`: 默认开启

## 内建 AI 能力要求

扩展依赖 Chromium 内建：

- `LanguageDetector`
- `Translator`

如果当前 Atlas 构建、设备、磁盘空间或模型状态不满足要求，扩展会显示不可用状态，不会走第三方付费翻译接口。

相关文档：

- [Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)
- [Translator API](https://developer.chrome.com/docs/ai/translate-on-device)
- [Language Detector API](https://developer.chrome.com/docs/ai/language-detection)

## 测试

```bash
npm install
npm test
```

