import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type Part,
  type Schema,
} from "@google/genai";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type InvokeParams = {
  messages: Message[];
  /** 使用モデル。省略時は ENV.geminiModel */
  model?: string;
  /**
   * Gemini の構造化出力スキーマ（OpenAPI サブセット）。指定すると responseMimeType=application/json と
   * 併せて出力の型・列挙値・必須キーをモデル側で強制できる（テキスト指示より確実）。
   */
  responseSchema?: Record<string, unknown>;
  responseFormat?: { type: "text" | "json_object" | "json_schema" };
  response_format?: { type: "text" | "json_object" | "json_schema" };
  maxTokens?: number;
  max_tokens?: number;
  /**
   * Gemini 2.5 系の思考トークン数。Gemini 3 系では無視され、thinkingLevel が使われる。
   */
  thinkingBudget?: number;
  /**
   * Gemini 3 系の思考レベル（thinkingBudget の後継）。
   */
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const THINKING_LEVEL_MAP: Record<NonNullable<InvokeParams["thinkingLevel"]>, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

async function urlToInlineData(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return {
    data: buffer.toString("base64"),
    mimeType: contentType.split(";")[0] || "image/jpeg",
  };
}

async function convertContentToParts(
  content: MessageContent | MessageContent[],
): Promise<Part[]> {
  const parts = Array.isArray(content) ? content : [content];
  const result: Part[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      result.push({ text: part });
    } else if (part.type === "text") {
      result.push({ text: part.text });
    } else if (part.type === "image_url") {
      const url = part.image_url.url;
      if (url.startsWith("data:")) {
        const [header, data] = url.split(",");
        const mimeType = header.split(":")[1].split(";")[0];
        result.push({ inlineData: { data, mimeType } });
      } else {
        const inlineData = await urlToInlineData(url);
        result.push({ inlineData });
      }
    }
  }

  return result;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey: ENV.geminiApiKey });

  const systemMessages = params.messages.filter((m) => m.role === "system");
  const conversationMessages = params.messages.filter((m) => m.role !== "system");

  const systemInstruction =
    systemMessages.length > 0
      ? systemMessages
          .map((m) => (typeof m.content === "string" ? m.content : ""))
          .filter(Boolean)
          .join("\n")
      : undefined;

  const responseFormatType =
    (params.responseFormat?.type ?? params.response_format?.type) === "json_object"
      ? "json_object"
      : undefined;

  const config: GenerateContentConfig = {
    // 決定論的出力: OCRのような正確性重視タスクではブレを排除する
    temperature: 0,
  };
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }
  if (params.maxTokens ?? params.max_tokens) {
    config.maxOutputTokens = params.maxTokens ?? params.max_tokens;
  }
  if (responseFormatType === "json_object") {
    config.responseMimeType = "application/json";
  }

  const modelName = params.model ?? ENV.geminiModel;
  if (params.responseSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = params.responseSchema as unknown as Schema;
  }

  // Gemini 3 系は thinkingLevel、2.5 系は thinkingBudget（両方送ると400エラー）
  const isGemini3 = modelName.startsWith("gemini-3");
  if (isGemini3) {
    const level =
      params.thinkingLevel ??
      (params.thinkingBudget && params.thinkingBudget > 0 ? "high" : undefined);
    if (level) {
      config.thinkingConfig = { thinkingLevel: THINKING_LEVEL_MAP[level] };
    }
  } else if (params.thinkingBudget && params.thinkingBudget > 0) {
    config.thinkingConfig = { thinkingBudget: params.thinkingBudget };
  }

  const contents: Content[] = [];
  for (const msg of conversationMessages) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: await convertContentToParts(msg.content),
    });
  }
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "" }] });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config,
  });

  const responseText = response.text ?? "";

  return {
    id: `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: modelName,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: responseText,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: response.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
