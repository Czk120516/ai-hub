/**
 * Chen-1.0 本地诊断引擎
 * ------------------------------------------------------------------
 * 设计目标：服务器运行状况能力「只走 Chen-1.0，不调 DeepSeek」。
 * 因此本模块是一个纯服务端、确定性的诊断函数，直接基于
 * GET /api/admin/server-status 返回的真实指标生成结构化中文报告，
 * 不依赖任何外部 LLM / API Key。
 *
 * 它接收的指标结构与 handleServerStatus 的返回一致；为避免与 auth-api
 * 的类型强耦合，这里用本地接口描述实际用到的字段。
 */

export interface ChenCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ChenStatus {
  status?: "healthy" | "degraded";
  timestamp?: string;
  uptimeSec?: number;
  runtime?: { node?: string; platform?: string; arch?: string };
  environment?: { vercel?: boolean; vercelEnv?: string; region?: string };
  memory?: {
    rssMb?: number;
    heapUsedMb?: number;
    heapTotalMb?: number;
    heapPercent?: number;
    externalMb?: number;
  };
  stats?: {
    users?: number;
    developers?: number;
    banned?: number;
    posts?: number;
    comments?: number;
  };
  storage?: { path?: string; exists?: boolean; writable?: boolean };
  checks?: ChenCheck[];
}

export interface ChenDiagnosisInput {
  status: ChenStatus | null;
  userText: string;
}

function fmtUptime(sec?: number): string {
  if (sec == null) return "未知";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} 天`);
  if (h) parts.push(`${h} 小时`);
  if (m) parts.push(`${m} 分`);
  parts.push(`${s} 秒`);
  return "约 " + parts.join(" ") + `（${sec} 秒）`;
}

function fmtBytes(mb?: number): string {
  if (mb == null) return "未知";
  if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB";
  return mb + " MB";
}

/** 判断用户提问的关注点，用于重点呈现对应章节 */
function focusOf(text: string): {
  memory: boolean;
  health: boolean;
  risk: boolean;
  advice: boolean;
  uptime: boolean;
} {
  const t = text.toLowerCase();
  return {
    memory: /内存|memory|heap|堆|ram|占用|泄漏/.test(t),
    health: /健康|状态|怎么样|如何|正常|概览|整体|summary|health/.test(t),
    risk: /风险|异常|报错|问题|瓶颈|危险|隐患|risk|error/.test(t),
    advice: /建议|优化|改进|怎么(办|做)|提升|调优|advice|optim/.test(t),
    uptime: /时长|运行了|多久|uptime|在线|启动/.test(t),
  };
}

export function runChenDiagnosis(input: ChenDiagnosisInput): string {
  const { status, userText } = input;

  if (!status) {
    return [
      "⚠️ 暂时未能获取到服务器的实时运行指标（可能是网络波动、部署重启或服务暂时不可达）。",
      "",
      "在拿到真实数据之前，我不会编造任何指标或诊断结论。请稍后重试「服务器运行状况」，或到部署平台确认服务实例是否在线。",
    ].join("\n");
  }

  const focus = focusOf(userText || "");
  const overall = status.status === "degraded" ? "降级" : "健康";
  const checks = status.checks ?? [];
  const failed = checks.filter((c) => !c.ok);
  const mem = status.memory ?? {};
  const heapPercent = mem.heapPercent ?? 0;
  const stats = status.stats ?? {};

  const lines: string[] = [];
  lines.push("# 🩺 Chen-1.0 服务器诊断报告");
  lines.push("");
  lines.push(
    `> 本报告由 **Chen-1.0 本地诊断引擎**基于服务器实时采集的真实指标生成，未调用任何外部大模型。数据采样时间：${
      status.timestamp ? new Date(status.timestamp).toLocaleString("zh-CN") : "未知"
    }。`
  );
  lines.push("");

  // ---- 1. 整体健康度 ----
  const healthLines: string[] = [];
  healthLines.push(`**整体健康度：${overall === "健康" ? "🟢 健康" : "🟡 降级"}**`);
  if (failed.length === 0) {
    healthLines.push("全部健康检查项通过，服务运行正常。");
  } else {
    healthLines.push(
      `存在 ${failed.length} 项检查未通过：${failed.map((c) => `「${c.name}」(${c.detail})`).join("、")}。`
    );
  }
  if (focus.health || (!focus.memory && !focus.risk && !focus.advice && !focus.uptime)) {
    lines.push("## 一、整体健康度判断");
    lines.push("");
    lines.push(...healthLines);
    lines.push("");
  }

  // ---- 2. 运行时与在线时长 ----
  const rt = status.runtime ?? {};
  const env = status.environment ?? {};
  const runtimeLines: string[] = [];
  runtimeLines.push(`- **运行时长**：${fmtUptime(status.uptimeSec)}`);
  runtimeLines.push(`- **Node 版本**：${rt.node || "未知"}`);
  runtimeLines.push(`- **平台/架构**：${[rt.platform, rt.arch].filter(Boolean).join(" / ") || "未知"}`);
  runtimeLines.push(
    `- **部署环境**：${env.vercel ? `Vercel（${env.vercelEnv || "production"}，区域 ${env.region || "?"}）` : "自托管 / 非 Vercel"}`
  );
  if (focus.uptime || (!focus.memory && !focus.risk && !focus.advice && !focus.health)) {
    lines.push("## 二、运行时与在线时长");
    lines.push("");
    lines.push(...runtimeLines);
    lines.push("");
  }

  // ---- 3. 资源（内存）使用分析 ----
  const memLines: string[] = [];
  memLines.push(
    `- **堆内存占用**：${fmtBytes(mem.heapUsedMb)} / ${fmtBytes(mem.heapTotalMb)}（使用率 ${heapPercent}%）`
  );
  memLines.push(`- **常驻内存 RSS**：约 ${fmtBytes(mem.rssMb)}`);
  memLines.push(`- **外部内存**：约 ${fmtBytes(mem.externalMb)}`);
  let memVerdict: string;
  if (heapPercent >= 90) memVerdict = "堆内存使用率极高，已接近上限，存在 OOM 风险，需立即关注。";
  else if (heapPercent >= 85) memVerdict = "堆内存使用率偏高，余量有限，建议持续观察并在流量高峰前优化。";
  else if (heapPercent >= 60) memVerdict = "堆内存使用率中等，目前充裕，属正常范围。";
  else memVerdict = "堆内存使用率较低，资源充裕。";
  memLines.push(`- **结论**：${memVerdict}`);
  if (focus.memory || (!focus.health && !focus.risk && !focus.advice && !focus.uptime)) {
    lines.push("## 三、资源（内存）使用分析");
    lines.push("");
    lines.push(...memLines);
    lines.push("");
  }

  // ---- 4. 健康检查明细 ----
  lines.push("## 四、健康检查明细");
  lines.push("");
  lines.push("| 检查项 | 状态 | 说明 |");
  lines.push("| --- | --- | --- |");
  for (const c of checks) {
    lines.push(`| ${c.name} | ${c.ok ? "✅ 正常" : "❌ 异常"} | ${c.detail} |`);
  }
  lines.push("");

  // ---- 5. 风险点 ----
  const riskLines: string[] = [];
  if (failed.length) {
    riskLines.push(...failed.map((c) => `- **${c.name}**：${c.detail}。`));
  }
  if (heapPercent >= 85) {
    riskLines.push(`- **内存压力**：堆使用率 ${heapPercent}%，接近告警线（85%），高并发时可能触发 OOM 或被平台重启。`);
  }
  if (env.vercel && (stats.users ?? 0) > 0 && (status.storage?.writable === false)) {
    riskLines.push(`- **存储只读**：数据目录不可写，新注册用户 / 帖子可能无法持久化。`);
  }
  if (riskLines.length === 0) {
    riskLines.push("- 当前未检测到明显风险点，各项指标均在安全范围内。");
  }
  if (focus.risk || (!focus.advice && !focus.memory && !focus.health && !focus.uptime)) {
    lines.push("## 五、发现的风险点");
    lines.push("");
    lines.push(...riskLines);
    lines.push("");
  }

  // ---- 6. 优化建议 ----
  const adviceLines: string[] = [];
  if (heapPercent >= 85) {
    adviceLines.push("- 排查内存泄漏：检查长生命周期对象 / 缓存是否无限增长；在 Vercel 等 Serverless 环境注意实例复用导致的累积。");
    adviceLines.push("- 为内存敏感路径（如大文件处理、批量查询）增加分页 / 流式处理，降低单次峰值。");
  }
  if (failed.some((c) => c.name.includes("DeepSeek"))) {
    adviceLines.push("- 配置 `DEEPSEEK_API_KEY` 环境变量，否则对话类能力将不可用。");
  }
  if (failed.some((c) => c.name.includes("SMTP"))) {
    adviceLines.push("- 当前环境不支持裸 TLS 邮件发送（如 Cloudflare Workers）。普通用户邮箱验证码登录暂不可用，开发者可走「免验证码登录」；如需开放注册，建议接入基于 HTTPS 的邮件 API。");
  }
  if (failed.some((c) => c.name.includes("数据存储") || c.name === "数据存储")) {
    adviceLines.push("- 确保数据目录可写；在 Serverless / 只读文件系统（如 Cloudflare Pages）应改用 KV / 数据库等持久化存储（本项目已内置 KV 适配）。");
  }
  adviceLines.push("- 接入监控与告警：对堆内存、错误率、健康检查失败项设置阈值告警，做到问题先于用户发现。");
  adviceLines.push("- 为关键只读接口（如本状态接口）加轻量缓存，降低重复采集开销。");
  if (focus.advice || (!focus.risk && !focus.memory && !focus.health && !focus.uptime)) {
    lines.push("## 六、可操作的优化建议");
    lines.push("");
    lines.push(...adviceLines);
    lines.push("");
  }

  // ---- 业务数据快照 ----
  lines.push("## 七、业务数据快照");
  lines.push("");
  lines.push(
    `- 用户 ${stats.users ?? 0} 人（开发者 ${stats.developers ?? 0} 人，已封禁 ${stats.banned ?? 0} 人）`
  );
  lines.push(`- 帖子 ${stats.posts ?? 0} 篇，评论 ${stats.comments ?? 0} 条`);
  lines.push(`- 存储：${status.storage?.exists ? "存在" : "不存在"}，${status.storage?.writable ? "可读写" : "只读"}`);
  lines.push("");
  lines.push("---");
  lines.push("*以上均由 Chen-1.0 基于真实指标生成。如需针对某项指标的深入分析，可直接提问，例如「内存为什么这么高」或「被封禁用户怎么解封」*");

  return lines.join("\n");
}
