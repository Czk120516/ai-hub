// ===== 类型定义 =====

export type Role = "user" | "assistant" | "system";

/** 与 DeepSeek API 交互的消息格式 */
export interface ChatMessage {
  role: Role;
  content: string;
}

/** 前端展示用的消息 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

/** 一个 AI 能力（能力聚合站的核心配置单元） */
export interface Capability {
  id: string;
  name: string;
  description: string;
  /** lucide-react 图标名 */
  icon: string;
  /** 系统提示词，决定该能力的"人设"与行为 */
  systemPrompt: string;
  /** 输入框占位文案 */
  placeholder: string;
  /** 示例输入，点击即填 */
  examples: string[];
  /** 采样温度 */
  temperature?: number;
  /** 使用的模型，默认 deepseek-chat */
  model?: string;
}

/** 前端 → /api/chat 的请求体 */
export interface ChatRequestBody {
  capabilityId: string;
  /** 历史消息（含本次用户输入） */
  messages: ChatMessage[];
}

/** /api/chat 的错误响应 */
export interface ChatErrorResponse {
  error: string;
}
