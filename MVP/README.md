# 灵感气泡 (Inspiration Bubble) - MVP

## 项目简介

灵感气泡是一个集成 AI 总结、可视化关联图谱和联网灵感搜索的头脑风暴辅助工具。它能将琐碎的想法转化为结构化的关键词，并通过力导向图可视化呈现，帮助用户发现创意之间的潜在联系。

## 核心功能

* **AI 智能解析**：自动总结输入内容，提取核心关键词，并建立逻辑关联。
* **力导向关联图谱**：以动态气泡形式展示关键词，支持拖拽交互，连线粗细代表关联强度。
* **联网灵感推荐**：基于关键词自动搜索行业案例与参考资料，并由 AI 自动生成深度解读。
* **实时语音纪要**：利用浏览器 Web Speech API 支持语音转文字，实时记录灵感。
* **本地存储**：所有历史记录均保存在浏览器本地（LocalStorage），确保隐私。

## 启动准备

### 1. 环境要求

* **Node.js**: 需安装 Node.js 环境（用于运行后端 API 代理）。
* **浏览器**: 建议使用 Chrome 浏览器以获得最佳的语音识别与 CSS 动画效果。

### 2. 获取 API Key

项目需要配置以下两个 API 服务：

1. **ModelScope (魔搭社区)**: 用于 Qwen2.5 大模型调用。
2. **Serphouse**: 用于执行联网搜索功能。

### 3. 配置文件

在项目根目录下创建 `.env` 文件，内容格式如下：

```env
MODEL_SCOPE_API_KEY=你的_ModelScope_API_Key
SERPHOUSE_API_KEY=你的_Serphouse_API_Key
PORT=3000
```

## 快速安装与运行

### 步骤 1：安装依赖

在项目根目录下打开终端，执行：

```bash
npm install
```

### 步骤 2：启动后端代理服务

```bash
npm start
```

看到 `Backend API Gateway running at http://localhost:3000` 表示后端已就绪。

### 步骤 3：访问应用

直接使用浏览器打开 `index.html` 文件即可开始使用。

## 移植说明

若需将此项目移植到其他环境：

1. 确保后端 `server.js` 能够访问外网（以请求 ModelScope 和 Serphouse 接口）。
2. 如果更改了后端运行的端口或地址，请同步修改 `api.js` 中的 `BACKEND_URL` 常量。
3. 语音识别功能依赖 `https` 环境或 `localhost` 环境，在其他非加密域名下可能无法启用。
