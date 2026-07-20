import type { Capability } from "./types";

/**
 * 六大 AI 能力配置。
 * 每个能力用不同的系统提示词驱动同一个 DeepSeek 模型，
 * 实现"能力聚合"——共用模型、共用界面，但行为各异。
 * 架构上预留了 model 字段，后续可让不同能力对接不同模型。
 */
export const CAPABILITIES: Capability[] = [
  {
    id: "chat",
    name: "智能对话",
    description: "通用多轮对话，问什么答什么",
    icon: "MessageCircle",
    systemPrompt:
      "你是一个知识渊博、乐于助人的 AI 助手。请用清晰、准确、有条理的中文回答用户的问题。若用户使用其他语言，也请用相应语言回答。遇到不确定的内容请如实说明。",
    placeholder: "问我任何问题…",
    examples: [
      "帮我规划一个三天的北京行程",
      "用通俗的话解释一下量子纠缠",
      "推荐几本入门经济学的好书",
    ],
    temperature: 0.7,
  },
  {
    id: "writer",
    name: "文案写作",
    description: "营销文案、文章、邮件、广告语",
    icon: "PenLine",
    systemPrompt:
      "你是一位资深文案撰稿人，擅长撰写各类营销文案、文章、邮件、广告语。请根据用户需求，产出有感染力、结构清晰、可直接使用的文案。如非特别说明，用中文撰写。可用 Markdown 排版。",
    placeholder: "描述你要写的文案，例如：给一款智能水杯写小红书种草文案",
    examples: [
      "给一款智能水杯写小红书种草文案",
      "写一封商务合作邀请邮件",
      "为咖啡店开业写三条朋友圈文案",
    ],
    temperature: 0.9,
  },
  {
    id: "translator",
    name: "文本翻译",
    description: "中英日韩等多语言互译",
    icon: "Languages",
    systemPrompt:
      "你是一位专业翻译。请将用户输入的文本翻译成目标语言。若用户未指定目标语言，默认在中英文之间互译（输入是中文则译为英文，否则译为中文）。翻译要准确、自然、符合目标语言习惯。只输出译文，不要附加解释。",
    placeholder: "粘贴要翻译的文本，可说明目标语言，如：翻译成日语：你好世界",
    examples: [
      "翻译成英语：今天天气真好",
      "Translate to Chinese: Hello, how are you?",
      "把这段日语翻译成中文：おはようございます",
    ],
    temperature: 0.3,
  },
  {
    id: "coder",
    name: "代码助手",
    description: "生成、解释、优化、调试代码",
    icon: "Code2",
    systemPrompt:
      "你是一位资深软件工程师。请帮助用户编写、解释、优化、调试代码。回答中使用 ```语言 标注的代码块，并附上必要的说明。代码要规范、可运行、含必要注释。复杂问题先讲思路再给代码。",
    placeholder: "描述你的编程需求，例如：用 Python 实现一个快速排序",
    examples: [
      "用 Python 实现快速排序并解释原理",
      "这段 JS 代码哪里报错了？",
      "写一个 SQL：统计每个部门的平均薪资",
    ],
    temperature: 0.2,
  },
  {
    id: "summarizer",
    name: "内容总结",
    description: "长文摘要、要点提炼",
    icon: "FileText",
    systemPrompt:
      "你是一位擅长提炼信息的助手。请将用户提供的长文本总结为简洁的要点：先用一句话概括主旨，再用分点列出 3-5 条关键信息。保持客观、准确，不添加原文没有的内容。用 Markdown 输出。",
    placeholder: "粘贴需要总结的长文本…",
    examples: [
      "（粘贴一篇新闻全文让我总结）",
      "（粘贴一段会议记录提炼要点）",
      "（粘贴一篇长文生成摘要）",
    ],
    temperature: 0.3,
  },
  {
    id: "creative",
    name: "创意生成",
    description: "故事、诗歌、点子、起名",
    icon: "Sparkles",
    systemPrompt:
      "你是一位充满想象力的创意作家。请根据用户的提示，创作故事、诗歌、广告创意、起名、点子等。发挥想象力，语言生动有感染力。可以用 Markdown 排版。",
    placeholder: "说出你的创意需求，例如：写一个关于时间旅行者的微小说",
    examples: [
      "写一个 200 字的科幻微小说",
      "给我的咖啡店起 5 个有格调的名字",
      "写一首关于秋天的现代诗",
    ],
    temperature: 1.0,
  },
];

/** 按 id 取能力配置 */
export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}
