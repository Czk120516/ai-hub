# AI 能力聚合站 · DeepSeek

基于 [DeepSeek](https://www.deepseek.com/) 的 AI 能力聚合网站。**一个模型，六大能力**——通过不同的系统提示词驱动同一个 DeepSeek 模型，在统一界面下实现智能对话、文案写作、文本翻译、代码助手、内容总结、创意生成等场景。架构上预留了多模型扩展位，后续可方便地接入图片生成 / 语音等能力。

技术栈：**Next.js 14（App Router）+ TypeScript + Tailwind CSS + react-markdown + DeepSeek API（OpenAI 兼容格式，流式输出）**。

## 功能特性

- 🧩 **六大 AI 能力**：智能对话 / 文案写作 / 文本翻译 / 代码助手 / 内容总结 / 创意生成，左侧一键切换，对话历史各自独立。
- ⚡ **流式输出**：服务端 SSE 风格的纯文本流，前端打字机效果实时渲染。
- 🎨 **Markdown 渲染**：支持 GFM（表格、列表等）与代码高亮（highlight.js）。
- 🔐 **密钥安全**：API Key 仅存于服务端环境变量，前端永不接触。
- 🛑 **可中断生成**：流式过程中可随时停止。
- 🧪 **示例驱动**：每个能力内置示例，点击即填，零门槛上手。
- 🧱 **可扩展架构**：新增能力只需在 `lib/capabilities.ts` 增加一条配置；新增模型只需扩展 `lib/deepseek.ts`。

## 快速开始

### 1. 获取 DeepSeek API Key

前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并创建 API Key。新用户通常有免费额度。

### 2. 配置环境变量

复制示例文件并填入你的 Key：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
DEEPSEEK_API_KEY=sk-你的真实密钥
# 可选，默认 https://api.deepseek.com
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### 3. 安装依赖并启动

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 4. 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
ai-hub/
├── app/
│   ├── api/chat/route.ts   # 流式 API 路由（服务端调用 DeepSeek，保护密钥）
│   ├── globals.css         # 全局样式 + Markdown / 代码高亮主题
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 主页面（状态编排）
├── components/
│   ├── Header.tsx          # 顶部栏
│   ├── Sidebar.tsx         # 能力导航
│   ├── ChatPanel.tsx       # 消息列表 + 空状态示例
│   ├── MessageBubble.tsx   # 单条消息（Markdown 渲染）
│   └── InputArea.tsx       # 输入框 + 发送/停止
├── hooks/
│   └── useChat.ts          # 聊天状态 + 流式请求 Hook
├── lib/
│   ├── types.ts            # 类型定义
│   ├── capabilities.ts     # 六大能力配置（系统提示词等）
│   └── deepseek.ts         # DeepSeek 流式客户端
├── .env.local.example      # 环境变量示例
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 如何扩展

### 新增一个 AI 能力

在 `lib/capabilities.ts` 的 `CAPABILITIES` 数组里追加一项即可：

```ts
{
  id: "brainstorm",
  name: "头脑风暴",
  description: "围绕一个主题发散点子",
  icon: "Lightbulb",            // lucide-react 图标名
  systemPrompt: "你是一位创意引导师…",
  placeholder: "输入你想发散的主题…",
  examples: ["给社区活动想 10 个点子"],
  temperature: 0.95,
}
```

然后在 `components/Sidebar.tsx` 和 `components/ChatPanel.tsx` 的 `ICONS` 映射里加上对应图标（从 `lucide-react` 导入）。无需改动任何后端逻辑。

### 接入其他模型

`lib/deepseek.ts` 封装了兼容 OpenAI 格式的流式客户端。要接入其他厂商（如通义千问、智谱、Moonshot 等，只要兼容 OpenAI `/chat/completions` 格式），新增一个类似的客户端并在 `app/api/chat/route.ts` 里根据 `capability.model` 路由到对应客户端即可。`Capability` 类型已预留 `model` 字段。

## 技术说明

- DeepSeek API 完全兼容 OpenAI Chat Completions 格式，因此可直接复用 OpenAI 生态的调用方式。
- 流式响应采用纯文本 chunk 透传（非标准 SSE `data:` 帧），前端按 chunk 累加即可实现打字机效果，实现简单且兼容性好。
- 代码高亮使用 `rehype-highlight`（基于 highlight.js），深色主题样式在 `app/globals.css` 中定义。

## 常见问题

**Q：启动后对话报错 "DEEPSEEK_API_KEY 未配置"？**
A：检查项目根目录是否存在 `.env.local`（不是 `.env.local.example`），且其中 `DEEPSEEK_API_KEY` 已填入真实值。修改环境变量后需重启 dev server。

**Q：流式输出没有逐字显示，而是一次性出现？**
A：通常是反向代理缓冲导致。本地 `npm run dev` 不会有此问题；若部署到 Nginx 等，需关闭缓冲（已设置 `X-Accel-Buffering: no` 响应头辅助）。

**Q：如何切换 DeepSeek 的模型（deepseek-chat / deepseek-reasoner）？**
A：在对应能力的配置里加上 `model: "deepseek-reasoner"` 即可，默认为 `deepseek-chat`。

---

基于 DeepSeek API 构建，生成内容仅供参考。
