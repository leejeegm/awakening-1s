"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { withTimeout } from "@/lib/requestTimeout";

type Mode = "local" | "server";
type Feature = "image_cut" | "comic_4panel";
type LocalEnginePreset = "a1111" | "comfyui" | "custom";

type Props = {
  open: boolean;
  onClose: () => void;
  nickname: string;
  /** 「내 자각 실험 결과 보기」조회 후 받은 비밀번호 SHA-256 hex */
  authHash?: string;
  baseText: string;
};

const DEFAULT_LOCAL_ENGINE_URL =
  process.env.NEXT_PUBLIC_LOCAL_IMAGE_ENGINE_URL?.trim() || "http://127.0.0.1:7860/sdapi/v1/txt2img";
const LOCAL_ENGINE_RECENT_URLS_KEY = "local_image_engine_recent_urls";
const LOCAL_ENGINE_AUTO_SAVE_KEY = "local_image_engine_auto_save";
const LOCAL_ENGINE_PRESET_KEY = "local_image_engine_preset";
const LOCAL_ENGINE_COMFY_WORKFLOW_KEY = "local_image_engine_comfy_workflow";
const LOCAL_ENGINE_COMFY_QUICK_SETTINGS_KEY = "local_image_engine_comfy_quick_settings";
const LOCAL_ENGINE_COMFY_NODE_TARGETS_KEY = "local_image_engine_comfy_node_targets";
const MAX_RECENT_LOCAL_ENGINE_URLS = 5;
const DEFAULT_COMFY_WORKFLOW = `{
  "3": {
    "inputs": {
      "seed": 1,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": {
      "ckpt_name": "PUT_YOUR_MODEL.safetensors"
    },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": {
      "width": 768,
      "height": 512,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": {
      "text": "positive prompt",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": {
      "text": "negative prompt",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": ["8", 0]
    },
    "class_type": "SaveImage"
  }
}`;
const COMFY_WORKFLOW_TEMPLATE_COMIC = `{
  "3": {
    "inputs": {
      "seed": 1,
      "steps": 24,
      "cfg": 7,
      "sampler_name": "dpmpp_2m",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": {
      "ckpt_name": "PUT_YOUR_MODEL.safetensors"
    },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": {
      "text": "positive prompt",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": {
      "text": "negative prompt",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyComic",
      "images": ["8", 0]
    },
    "class_type": "SaveImage"
  }
}`;
const COMFY_POLL_ATTEMPTS = 40;
const COMFY_POLL_INTERVAL_MS = 1500;

type LocalEngineTestResult = {
  tone: "success" | "warning" | "error";
  message: string;
};

type LocalEngineSavedEntry = {
  url: string;
  label: string;
  preset: LocalEnginePreset;
};

type ComfyWorkflowTemplate = {
  id: "default" | "comic";
  label: string;
  description: string;
  workflow: string;
};

type ComfyQuickSettings = {
  samplerName: string;
  scheduler: string;
  cfgValue: string;
  steps: string;
  width: string;
  height: string;
};

type ComfyNodeTargets = {
  positivePromptNodeId: string;
  negativePromptNodeId: string;
  checkpointNodeId: string;
  samplerNodeId: string;
  latentNodeId: string;
  outputNodeId: string;
};

type ComfyWorkflowNodeListItem = {
  id: string;
  classType: string;
};

type ComfyNodeRoleKey =
  | "positivePromptNodeId"
  | "negativePromptNodeId"
  | "checkpointNodeId"
  | "samplerNodeId"
  | "latentNodeId"
  | "outputNodeId";

const COMFY_WORKFLOW_TEMPLATES: ComfyWorkflowTemplate[] = [
  {
    id: "default",
    label: "기본 템플릿",
    description: "일반 단일 이미지용 기본 워크플로",
    workflow: DEFAULT_COMFY_WORKFLOW,
  },
  {
    id: "comic",
    label: "웹툰 템플릿",
    description: "4컷/정사각 구성에 맞춘 기본 워크플로",
    workflow: COMFY_WORKFLOW_TEMPLATE_COMIC,
  },
];

function dataUrlFromBase64(b64: string) {
  // A1111 returns raw base64 png without prefix
  if (b64.startsWith("data:")) return b64;
  return `data:image/png;base64,${b64}`;
}

function formatLocalGenerationError(error: unknown, engineUrl?: string, engineName = "로컬 엔진") {
  const target = engineUrl ? `\`${engineUrl}\`` : "입력한 엔진 주소";
  if (error instanceof Error && error.message === "REQUEST_TIMEOUT") {
    return `${engineName} 응답 시간이 초과되었습니다. 주소는 맞지만 엔진이 바쁘거나 생성 시간이 길 수 있습니다. 잠시 후 다시 시도해 주세요.`;
  }
  if (error instanceof TypeError) {
    return `${engineName}는 이 브라우저에서 ${target} 로 직접 접속합니다. 브라우저의 로컬/사설 네트워크 접근 허용이 필요하고, 해당 주소에서 엔진이 실행 중이어야 합니다. 휴대폰 접속에서는 같은 기기의 엔진이 아니면 보통 동작하지 않습니다.`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolveLocalEngineUrl(raw: string, preset: LocalEnginePreset) {
  const trimmed = raw.trim() || DEFAULT_LOCAL_ENGINE_URL;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("로컬 엔진 주소 형식이 올바르지 않습니다. 예: http://127.0.0.1:7860 또는 http://192.168.0.10:7860");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("로컬 엔진 주소는 http 또는 https로 시작해야 합니다.");
  }
  if (preset === "a1111" && (parsed.pathname === "/" || parsed.pathname === "")) {
    parsed.pathname = "/sdapi/v1/txt2img";
  }
  if (preset === "comfyui" && (parsed.pathname === "/" || parsed.pathname === "")) {
    parsed.pathname = "/prompt";
  }
  if (preset === "custom" && (parsed.pathname === "/" || parsed.pathname === "")) {
    throw new Error("직접 경로 입력 프리셋은 전체 엔드포인트 경로까지 입력해야 합니다. 예: http://192.168.0.10:7860/sdapi/v1/txt2img");
  }
  return parsed.toString();
}

function buildLocalEngineProbeUrl(raw: string, preset: LocalEnginePreset) {
  const target = new URL(resolveLocalEngineUrl(raw, preset));
  const probe = new URL(target.toString());
  probe.search = "";
  probe.hash = "";
  if (preset === "a1111" && probe.pathname.endsWith("/sdapi/v1/txt2img")) {
    probe.pathname = probe.pathname.replace(/\/sdapi\/v1\/txt2img$/, "/sdapi/v1/options");
  }
  if (preset === "comfyui" && probe.pathname.endsWith("/prompt")) {
    probe.pathname = probe.pathname.replace(/\/prompt$/, "/system_stats");
  }
  return probe.toString();
}

function buildComfyViewUrl(promptUrl: string, image: { filename?: string; subfolder?: string; type?: string }) {
  const viewUrl = new URL("/view", promptUrl);
  if (image.filename) viewUrl.searchParams.set("filename", image.filename);
  if (image.subfolder) viewUrl.searchParams.set("subfolder", image.subfolder);
  if (image.type) viewUrl.searchParams.set("type", image.type);
  return viewUrl.toString();
}

function buildLocalEngineDefaultLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.host || "로컬 엔진";
  } catch {
    return "로컬 엔진";
  }
}

function normalizeRecentLocalEngineEntries(items: unknown): LocalEngineSavedEntry[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: LocalEngineSavedEntry[] = [];
  for (const item of items) {
    const url =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object" && "url" in item && typeof item.url === "string"
          ? item.url.trim()
          : "";
    if (!url || seen.has(url)) continue;
    const label =
      item && typeof item === "object" && "label" in item && typeof item.label === "string" && item.label.trim()
        ? item.label.trim()
        : buildLocalEngineDefaultLabel(url);
    const preset =
      item && typeof item === "object" && "preset" in item && (item.preset === "custom" || item.preset === "comfyui")
        ? item.preset
        : "a1111";
    seen.add(url);
    out.push({ url, label, preset });
    if (out.length >= MAX_RECENT_LOCAL_ENGINE_URLS) break;
  }
  return out;
}

function buildPromptTexts(feature: Feature, prompt: string, negativePrompt: string) {
  const positiveText =
    feature === "comic_4panel"
      ? `${prompt}\n\n4 panel comic, 2x2 grid layout, korean webtoon style`
      : prompt;
  return {
    positiveText,
    negativeText: negativePrompt,
  };
}

type ComfyWorkflowNode = {
  class_type?: string;
  inputs?: Record<string, unknown>;
};

function applyComfyWorkflowOverrides(
  workflow: Record<string, ComfyWorkflowNode>,
  args: {
    positiveText: string;
    negativeText: string;
    width: number;
    height: number;
    steps: number;
    checkpointName?: string;
    samplerName?: string;
    scheduler?: string;
    cfgValue?: number | null;
    nodeTargets?: ComfyNodeTargets;
  }
) {
  const next = JSON.parse(JSON.stringify(workflow)) as Record<string, ComfyWorkflowNode>;
  const targetPositiveNodeId = args.nodeTargets?.positivePromptNodeId.trim() ?? "";
  const targetNegativeNodeId = args.nodeTargets?.negativePromptNodeId.trim() ?? "";
  const targetCheckpointNodeId = args.nodeTargets?.checkpointNodeId.trim() ?? "";
  const targetSamplerNodeId = args.nodeTargets?.samplerNodeId.trim() ?? "";
  const targetLatentNodeId = args.nodeTargets?.latentNodeId.trim() ?? "";
  const clipNodes = Object.entries(next).filter(([, node]) => node.class_type === "CLIPTextEncode");
  const positiveNode =
    (targetPositiveNodeId ? next[targetPositiveNodeId] : null) ?? clipNodes[0]?.[1];
  const negativeNode =
    (targetNegativeNodeId ? next[targetNegativeNodeId] : null) ?? clipNodes[1]?.[1];
  if (positiveNode?.inputs) positiveNode.inputs.text = args.positiveText;
  if (negativeNode?.inputs) negativeNode.inputs.text = args.negativeText;

  for (const [nodeId, node] of Object.entries(next)) {
    if (node.class_type === "EmptyLatentImage" && node.inputs && (!targetLatentNodeId || nodeId === targetLatentNodeId)) {
      node.inputs.width = args.width;
      node.inputs.height = args.height;
    }
    if (node.class_type === "KSampler" && node.inputs && (!targetSamplerNodeId || nodeId === targetSamplerNodeId)) {
      node.inputs.steps = args.steps;
      if (args.samplerName?.trim()) node.inputs.sampler_name = args.samplerName.trim();
      if (args.scheduler?.trim()) node.inputs.scheduler = args.scheduler.trim();
      if (typeof args.cfgValue === "number" && Number.isFinite(args.cfgValue)) node.inputs.cfg = args.cfgValue;
    }
    if (
      node.class_type === "CheckpointLoaderSimple" &&
      node.inputs &&
      (!targetCheckpointNodeId || nodeId === targetCheckpointNodeId) &&
      args.checkpointName?.trim()
    ) {
      node.inputs.ckpt_name = args.checkpointName.trim();
    }
  }

  return next;
}

function extractComfyCheckpointName(workflowText: string) {
  try {
    const workflow = JSON.parse(workflowText) as Record<string, ComfyWorkflowNode>;
    for (const node of Object.values(workflow)) {
      if (node.class_type !== "CheckpointLoaderSimple" || !node.inputs) continue;
      return typeof node.inputs.ckpt_name === "string" ? node.inputs.ckpt_name : "";
    }
  } catch {}
  return "";
}

function toInputString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return "";
}

function extractComfyQuickSettings(workflowText: string): ComfyQuickSettings {
  const out: ComfyQuickSettings = {
    samplerName: "",
    scheduler: "",
    cfgValue: "",
    steps: "",
    width: "",
    height: "",
  };
  try {
    const workflow = JSON.parse(workflowText) as Record<string, ComfyWorkflowNode>;
    for (const node of Object.values(workflow)) {
      if (node.class_type === "KSampler" && node.inputs) {
        out.samplerName = toInputString(node.inputs.sampler_name);
        out.scheduler = toInputString(node.inputs.scheduler);
        out.cfgValue = toInputString(node.inputs.cfg);
        out.steps = toInputString(node.inputs.steps);
      }
      if (node.class_type === "EmptyLatentImage" && node.inputs) {
        out.width = toInputString(node.inputs.width);
        out.height = toInputString(node.inputs.height);
      }
    }
  } catch {}
  return out;
}

function normalizeComfyQuickSettings(value: unknown, fallback: ComfyQuickSettings): ComfyQuickSettings {
  if (!value || typeof value !== "object") return fallback;
  return {
    samplerName:
      "samplerName" in value && typeof value.samplerName === "string" ? value.samplerName : fallback.samplerName,
    scheduler: "scheduler" in value && typeof value.scheduler === "string" ? value.scheduler : fallback.scheduler,
    cfgValue: "cfgValue" in value && typeof value.cfgValue === "string" ? value.cfgValue : fallback.cfgValue,
    steps: "steps" in value && typeof value.steps === "string" ? value.steps : fallback.steps,
    width: "width" in value && typeof value.width === "string" ? value.width : fallback.width,
    height: "height" in value && typeof value.height === "string" ? value.height : fallback.height,
  };
}

function extractComfyNodeTargets(workflowText: string): ComfyNodeTargets {
  const out: ComfyNodeTargets = {
    positivePromptNodeId: "",
    negativePromptNodeId: "",
    checkpointNodeId: "",
    samplerNodeId: "",
    latentNodeId: "",
    outputNodeId: "",
  };
  try {
    const workflow = JSON.parse(workflowText) as Record<string, ComfyWorkflowNode>;
    const clipNodeIds = Object.entries(workflow)
      .filter(([, node]) => node.class_type === "CLIPTextEncode")
      .map(([nodeId]) => nodeId);
    out.positivePromptNodeId = clipNodeIds[0] ?? "";
    out.negativePromptNodeId = clipNodeIds[1] ?? "";
    out.checkpointNodeId =
      Object.entries(workflow).find(([, node]) => node.class_type === "CheckpointLoaderSimple")?.[0] ?? "";
    out.samplerNodeId = Object.entries(workflow).find(([, node]) => node.class_type === "KSampler")?.[0] ?? "";
    out.latentNodeId =
      Object.entries(workflow).find(([, node]) => node.class_type === "EmptyLatentImage")?.[0] ?? "";
    out.outputNodeId =
      Object.entries(workflow).find(
        ([, node]) => node.class_type === "SaveImage" || node.class_type === "PreviewImage"
      )?.[0] ?? "";
  } catch {}
  return out;
}

function normalizeComfyNodeTargets(value: unknown, fallback: ComfyNodeTargets): ComfyNodeTargets {
  if (!value || typeof value !== "object") return fallback;
  return {
    positivePromptNodeId:
      "positivePromptNodeId" in value && typeof value.positivePromptNodeId === "string"
        ? value.positivePromptNodeId
        : fallback.positivePromptNodeId,
    negativePromptNodeId:
      "negativePromptNodeId" in value && typeof value.negativePromptNodeId === "string"
        ? value.negativePromptNodeId
        : fallback.negativePromptNodeId,
    checkpointNodeId:
      "checkpointNodeId" in value && typeof value.checkpointNodeId === "string"
        ? value.checkpointNodeId
        : fallback.checkpointNodeId,
    samplerNodeId:
      "samplerNodeId" in value && typeof value.samplerNodeId === "string"
        ? value.samplerNodeId
        : fallback.samplerNodeId,
    latentNodeId:
      "latentNodeId" in value && typeof value.latentNodeId === "string" ? value.latentNodeId : fallback.latentNodeId,
    outputNodeId:
      "outputNodeId" in value && typeof value.outputNodeId === "string" ? value.outputNodeId : fallback.outputNodeId,
  };
}

function extractComfyWorkflowNodeList(workflowText: string): ComfyWorkflowNodeListItem[] {
  try {
    const workflow = JSON.parse(workflowText) as Record<string, ComfyWorkflowNode>;
    return Object.entries(workflow)
      .map(([id, node]) => ({
        id,
        classType: typeof node.class_type === "string" ? node.class_type : "(class_type 없음)",
      }))
      .sort((a, b) => {
        const aNum = Number(a.id);
        const bNum = Number(b.id);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
        return a.id.localeCompare(b.id);
      });
  } catch {
    return [];
  }
}

function isSameComfyNodeTargets(a: ComfyNodeTargets, b: ComfyNodeTargets) {
  return (
    a.positivePromptNodeId === b.positivePromptNodeId &&
    a.negativePromptNodeId === b.negativePromptNodeId &&
    a.checkpointNodeId === b.checkpointNodeId &&
    a.samplerNodeId === b.samplerNodeId &&
    a.latentNodeId === b.latentNodeId &&
    a.outputNodeId === b.outputNodeId
  );
}

function analyzeComfyWorkflowWarnings(
  workflowText: string,
  nodeTargets: ComfyNodeTargets,
  checkpointName: string
) {
  const warnings: string[] = [];
  try {
    const workflow = JSON.parse(workflowText) as Record<string, ComfyWorkflowNode>;
    const nodes = Object.values(workflow);
    const clipCount = nodes.filter((node) => node.class_type === "CLIPTextEncode").length;
    const hasCheckpoint = nodes.some((node) => node.class_type === "CheckpointLoaderSimple");
    const hasSampler = nodes.some((node) => node.class_type === "KSampler");
    const hasLatent = nodes.some((node) => node.class_type === "EmptyLatentImage");
    const outputNodes = Object.entries(workflow).filter(
      ([, node]) => node.class_type === "SaveImage" || node.class_type === "PreviewImage"
    );
    const targetIssues = validateComfyNodeTargets(workflow, nodeTargets);

    if (clipCount < 2) {
      warnings.push("`CLIPTextEncode` 노드가 2개 미만입니다. 양수/음수 프롬프트를 분리하려면 보통 2개가 필요합니다.");
    }
    if (!hasCheckpoint) {
      warnings.push("`CheckpointLoaderSimple` 노드가 없습니다. 모델 로딩 노드가 없으면 기본 템플릿 기준 생성이 실패할 수 있습니다.");
    }
    if (!hasSampler) {
      warnings.push("`KSampler` 노드가 없습니다. 샘플링 단계가 없으면 빠른 설정과 기본 생성 흐름이 맞지 않을 수 있습니다.");
    }
    if (!hasLatent) {
      warnings.push("`EmptyLatentImage` 노드가 없습니다. 해상도 빠른 설정이 적용되지 않을 수 있습니다.");
    }
    if (outputNodes.length === 0) {
      warnings.push("`SaveImage` 또는 `PreviewImage` 노드가 없습니다. 결과 이미지를 가져오려면 최소 1개 이상 필요합니다.");
    }
    if (outputNodes.length > 1 && !nodeTargets.outputNodeId.trim()) {
      warnings.push("출력 노드가 여러 개입니다. 원하는 결과가 있다면 `결과 이미지 출력 노드 ID`를 지정해 주세요.");
    }
    if (targetIssues.length > 0) {
      warnings.push(`현재 대상 노드 설정을 다시 확인해 주세요: ${targetIssues.join(", ")}`);
    }

    const effectiveCheckpointName = checkpointName.trim() || extractComfyCheckpointName(workflowText).trim();
    if (!effectiveCheckpointName) {
      warnings.push("체크포인트 모델명이 비어 있습니다. 사용할 모델 파일명을 지정해 주세요.");
    } else if (/PUT_YOUR_MODEL\.safetensors/i.test(effectiveCheckpointName)) {
      warnings.push("체크포인트 모델명이 예시값(`PUT_YOUR_MODEL.safetensors`) 그대로입니다. 실제 모델 파일명으로 바꿔 주세요.");
    }
  } catch {
    return [];
  }
  return warnings;
}

function hasExampleComfyCheckpointName(checkpointName: string) {
  return /PUT_YOUR_MODEL\.safetensors/i.test(checkpointName.trim());
}

function validateComfyNodeTargets(
  workflow: Record<string, ComfyWorkflowNode>,
  nodeTargets: ComfyNodeTargets
) {
  const issues: string[] = [];
  const rules: Array<[string, string, string]> = [
    [nodeTargets.positivePromptNodeId.trim(), "CLIPTextEncode", "양수 프롬프트 노드"],
    [nodeTargets.negativePromptNodeId.trim(), "CLIPTextEncode", "음수 프롬프트 노드"],
    [nodeTargets.checkpointNodeId.trim(), "CheckpointLoaderSimple", "체크포인트 노드"],
    [nodeTargets.samplerNodeId.trim(), "KSampler", "샘플러 노드"],
    [nodeTargets.latentNodeId.trim(), "EmptyLatentImage", "해상도 노드"],
  ];
  for (const [nodeId, expectedClassType, label] of rules) {
    if (!nodeId) continue;
    const targetNode = workflow[nodeId];
    if (!targetNode) {
      issues.push(`${label} ID \`${nodeId}\``);
      continue;
    }
    if (targetNode.class_type !== expectedClassType) {
      issues.push(`${label} ID \`${nodeId}\` (${expectedClassType} 아님)`);
    }
  }
  const outputNodeId = nodeTargets.outputNodeId.trim();
  if (outputNodeId && !workflow[outputNodeId]) {
    issues.push(`출력 노드 ID \`${outputNodeId}\``);
  }
  return issues;
}

function parsePositiveIntInput(value: string, fallback: number) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveFloatInput(value: string) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractComfyOutputImage(historyJson: unknown, promptId: string, preferredOutputNodeId?: string) {
  const historyEntry =
    historyJson && typeof historyJson === "object" && promptId in (historyJson as Record<string, unknown>)
      ? (historyJson as Record<string, unknown>)[promptId]
      : historyJson;
  const outputs =
    historyEntry && typeof historyEntry === "object" && "outputs" in (historyEntry as Record<string, unknown>)
      ? ((historyEntry as Record<string, unknown>).outputs as Record<string, unknown>)
      : null;
  if (!outputs || typeof outputs !== "object") return null;

  const preferredNodeId = preferredOutputNodeId?.trim() ?? "";
  if (preferredNodeId) {
    const preferredOutputNode = outputs[preferredNodeId];
    if (preferredOutputNode && typeof preferredOutputNode === "object") {
      const images =
        "images" in (preferredOutputNode as Record<string, unknown>)
          ? (preferredOutputNode as Record<string, unknown>).images
          : null;
      if (Array.isArray(images) && images.length > 0) {
        const image = images[0];
        if (image && typeof image === "object") {
          return image as { filename?: string; subfolder?: string; type?: string };
        }
      }
      return null;
    }
  }

  for (const outputNode of Object.values(outputs)) {
    if (!outputNode || typeof outputNode !== "object") continue;
    const images =
      "images" in (outputNode as Record<string, unknown>) ? (outputNode as Record<string, unknown>).images : null;
    if (!Array.isArray(images) || images.length === 0) continue;
    const image = images[0];
    if (!image || typeof image !== "object") continue;
    return image as { filename?: string; subfolder?: string; type?: string };
  }
  return null;
}

function extractErrorMessage(error: unknown, engineName = "로컬 엔진") {
  if (error instanceof Error) {
    if (error.message === "REQUEST_TIMEOUT") {
      return `${engineName} 응답 시간이 초과되었습니다. 엔진이 바쁘거나 네트워크가 느릴 수 있습니다.`;
    }
    if (/Failed to fetch/i.test(error.message)) {
      return `${engineName}에 연결하지 못했습니다. 브라우저 권한, CORS, 엔진 실행 상태를 확인해 주세요.`;
    }
    return error.message;
  }
  return String(error);
}

function upsertRecentLocalEngineEntry(
  current: LocalEngineSavedEntry[],
  entry: LocalEngineSavedEntry
) {
  return normalizeRecentLocalEngineEntries([entry, ...current]);
}

async function splitToFourPanels(dataUrl: string) {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("이미지 로드 실패"));
  });
  const w = img.width;
  const h = img.height;
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  const panels: string[] = [];
  const positions = [
    [0, 0],
    [halfW, 0],
    [0, halfH],
    [halfW, halfH],
  ] as const;
  for (const [x, y] of positions) {
    const canvas = document.createElement("canvas");
    canvas.width = halfW;
    canvas.height = halfH;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(img, x, y, halfW, halfH, 0, 0, halfW, halfH);
    panels.push(canvas.toDataURL("image/png"));
  }
  return panels;
}

export default function ImageComicGeneratorModal({ open, onClose, nickname, authHash = "", baseText }: Props) {
  const [mode, setMode] = useState<Mode>("local");
  const [feature, setFeature] = useState<Feature>("image_cut");
  const [localEnginePreset, setLocalEnginePreset] = useState<LocalEnginePreset>("a1111");
  const [localEngineUrl, setLocalEngineUrl] = useState(DEFAULT_LOCAL_ENGINE_URL);
  const [localEngineLabel, setLocalEngineLabel] = useState("");
  const [comfyWorkflowText, setComfyWorkflowText] = useState(DEFAULT_COMFY_WORKFLOW);
  const [comfyCheckpointName, setComfyCheckpointName] = useState(() => extractComfyCheckpointName(DEFAULT_COMFY_WORKFLOW));
  const [comfySamplerName, setComfySamplerName] = useState(() => extractComfyQuickSettings(DEFAULT_COMFY_WORKFLOW).samplerName);
  const [comfyScheduler, setComfyScheduler] = useState(() => extractComfyQuickSettings(DEFAULT_COMFY_WORKFLOW).scheduler);
  const [comfyCfgValue, setComfyCfgValue] = useState(() => extractComfyQuickSettings(DEFAULT_COMFY_WORKFLOW).cfgValue);
  const [comfySteps, setComfySteps] = useState(() => extractComfyQuickSettings(DEFAULT_COMFY_WORKFLOW).steps);
  const [comfyWidth, setComfyWidth] = useState(() => extractComfyQuickSettings(DEFAULT_COMFY_WORKFLOW).width);
  const [comfyHeight, setComfyHeight] = useState(() => extractComfyQuickSettings(DEFAULT_COMFY_WORKFLOW).height);
  const [comfyNodeTargets, setComfyNodeTargets] = useState(() => extractComfyNodeTargets(DEFAULT_COMFY_WORKFLOW));
  const [autoSaveLocalEngines, setAutoSaveLocalEngines] = useState(true);
  const [localEngineTestBusy, setLocalEngineTestBusy] = useState(false);
  const [localEngineTestResult, setLocalEngineTestResult] = useState<LocalEngineTestResult | null>(null);
  const [recentLocalEngineEntries, setRecentLocalEngineEntries] = useState<LocalEngineSavedEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [panels, setPanels] = useState<string[] | null>(null);
  const [usage, setUsage] = useState<{
    usedToday: number;
    dailyLimit: number;
    usedMonth: number;
    monthlyLimit: number;
  } | null>(null);
  const [history, setHistory] = useState<
    { id: string; created_at: string; feature_key: Feature; url: string | null }[]
  >([]);
  const [cacheHit, setCacheHit] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  /** participant_keys 닉네임과 동일 대소문자 유지 (인증용) */
  const apiNickname = useMemo(() => (nickname ?? "").trim().slice(0, 20), [nickname]);
  const comfyWorkflowNodeList = useMemo(() => extractComfyWorkflowNodeList(comfyWorkflowText), [comfyWorkflowText]);
  const comfyRecommendedNodeTargets = useMemo(() => extractComfyNodeTargets(comfyWorkflowText), [comfyWorkflowText]);
  const comfyWorkflowJsonError = useMemo(() => {
    try {
      JSON.parse(comfyWorkflowText);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "JSON 파싱 실패";
    }
  }, [comfyWorkflowText]);
  const comfyClipNodeOptions = useMemo(
    () => comfyWorkflowNodeList.filter((node) => node.classType === "CLIPTextEncode"),
    [comfyWorkflowNodeList]
  );
  const comfyCheckpointNodeOptions = useMemo(
    () => comfyWorkflowNodeList.filter((node) => node.classType === "CheckpointLoaderSimple"),
    [comfyWorkflowNodeList]
  );
  const comfySamplerNodeOptions = useMemo(
    () => comfyWorkflowNodeList.filter((node) => node.classType === "KSampler"),
    [comfyWorkflowNodeList]
  );
  const comfyLatentNodeOptions = useMemo(
    () => comfyWorkflowNodeList.filter((node) => node.classType === "EmptyLatentImage"),
    [comfyWorkflowNodeList]
  );
  const comfyOutputNodeOptions = useMemo(
    () => comfyWorkflowNodeList.filter((node) => node.classType === "SaveImage" || node.classType === "PreviewImage"),
    [comfyWorkflowNodeList]
  );
  const comfyWorkflowWarnings = useMemo(
    () => analyzeComfyWorkflowWarnings(comfyWorkflowText, comfyNodeTargets, comfyCheckpointName),
    [comfyWorkflowText, comfyNodeTargets, comfyCheckpointName]
  );
  const comfyEffectiveCheckpointName = useMemo(
    () => comfyCheckpointName.trim() || extractComfyCheckpointName(comfyWorkflowText).trim(),
    [comfyCheckpointName, comfyWorkflowText]
  );
  const hasExampleCheckpointWarning = useMemo(
    () => hasExampleComfyCheckpointName(comfyEffectiveCheckpointName),
    [comfyEffectiveCheckpointName]
  );
  const isUsingRecommendedComfyNodeTargets = useMemo(
    () => isSameComfyNodeTargets(comfyNodeTargets, comfyRecommendedNodeTargets),
    [comfyNodeTargets, comfyRecommendedNodeTargets]
  );
  const comfyStatusBadge = useMemo(() => {
    if (mode !== "local" || localEnginePreset !== "comfyui") return null;
    if (comfyWorkflowJsonError) {
      return {
        label: "ComfyUI 설정 오류",
        detail: "JSON 확인 필요",
        className: "bg-red-500/15 text-red-300 border-red-500/30",
      };
    }
    if (comfyWorkflowWarnings.length > 0) {
      return {
        label: "ComfyUI 설정 주의",
        detail: `${comfyWorkflowWarnings.length}개 경고`,
        className: "bg-amber-500/15 text-amber-200 border-amber-500/30",
      };
    }
    return {
      label: "ComfyUI 설정 정상",
      detail: "생성 가능",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    };
  }, [mode, localEnginePreset, comfyWorkflowJsonError, comfyWorkflowWarnings]);

  useEffect(() => {
    if (!open) return;
    try {
      const savedMode = (localStorage.getItem("gen_mode") as Mode | null) ?? "local";
      const savedFeature = (localStorage.getItem("gen_feature") as Feature | null) ?? "image_cut";
      const savedLocalEnginePreset = localStorage.getItem(LOCAL_ENGINE_PRESET_KEY);
      const savedLocalEngineUrl = localStorage.getItem("local_image_engine_url") ?? "";
      const savedComfyWorkflowText = localStorage.getItem(LOCAL_ENGINE_COMFY_WORKFLOW_KEY) ?? "";
      const savedComfyQuickSettings = localStorage.getItem(LOCAL_ENGINE_COMFY_QUICK_SETTINGS_KEY);
      const savedComfyNodeTargets = localStorage.getItem(LOCAL_ENGINE_COMFY_NODE_TARGETS_KEY);
      const savedAutoSaveLocalEngines = localStorage.getItem(LOCAL_ENGINE_AUTO_SAVE_KEY);
      const savedRecentLocalEngineEntries = normalizeRecentLocalEngineEntries(
        JSON.parse(localStorage.getItem(LOCAL_ENGINE_RECENT_URLS_KEY) ?? "[]")
      );
      if (savedMode === "local" || savedMode === "server") setMode(savedMode);
      if (savedFeature === "image_cut" || savedFeature === "comic_4panel") setFeature(savedFeature);
      setLocalEnginePreset(savedLocalEnginePreset === "custom" ? "custom" : "a1111");
      if (savedLocalEnginePreset === "comfyui") setLocalEnginePreset("comfyui");
      const nextUrl = savedLocalEngineUrl.trim() || DEFAULT_LOCAL_ENGINE_URL;
      const nextWorkflow = savedComfyWorkflowText.trim() || DEFAULT_COMFY_WORKFLOW;
      const fallbackQuickSettings = extractComfyQuickSettings(nextWorkflow);
      const fallbackNodeTargets = extractComfyNodeTargets(nextWorkflow);
      const nextQuickSettings = normalizeComfyQuickSettings(
        savedComfyQuickSettings ? JSON.parse(savedComfyQuickSettings) : null,
        fallbackQuickSettings
      );
      const nextNodeTargets = normalizeComfyNodeTargets(
        savedComfyNodeTargets ? JSON.parse(savedComfyNodeTargets) : null,
        fallbackNodeTargets
      );
      setLocalEngineUrl(nextUrl);
      setComfyWorkflowText(nextWorkflow);
      setComfyCheckpointName(extractComfyCheckpointName(nextWorkflow));
      setComfySamplerName(nextQuickSettings.samplerName);
      setComfyScheduler(nextQuickSettings.scheduler);
      setComfyCfgValue(nextQuickSettings.cfgValue);
      setComfySteps(nextQuickSettings.steps);
      setComfyWidth(nextQuickSettings.width);
      setComfyHeight(nextQuickSettings.height);
      setComfyNodeTargets(nextNodeTargets);
      setAutoSaveLocalEngines(savedAutoSaveLocalEngines !== "false");
      setRecentLocalEngineEntries(savedRecentLocalEngineEntries);
      setLocalEngineLabel(
        savedRecentLocalEngineEntries.find((item) => item.url === nextUrl)?.label ?? buildLocalEngineDefaultLabel(nextUrl)
      );
    } catch {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPrompt(
      `다음 글을 바탕으로 이미지로 표현해줘. 개인 식별 정보는 넣지 말아줘.\n\n${(baseText ?? "").trim()}`
    );
    setNegativePrompt("text, watermark, logo, signature, phone number, email");
    setError(null);
    setImageUrl(null);
    setPanels(null);
    setUsage(null);
    setHistory([]);
    setCacheHit(false);
    setStorageWarning(null);
    setLocalEngineTestResult(null);
  }, [open, baseText]);

  const loadHistory = useCallback(async () => {
    if (!apiNickname || !authHash.trim()) return;
    const res = await fetch(
      `/api/ai/image/history?nickname=${encodeURIComponent(apiNickname)}&authHash=${encodeURIComponent(authHash.trim())}&limit=10`
    );
    const json = (await res.json().catch(() => ({}))) as {
      items?: { id: string; created_at: string; feature_key: Feature; url: string | null }[];
    };
    setHistory(Array.isArray(json.items) ? json.items : []);
  }, [apiNickname, authHash]);

  useEffect(() => {
    try {
      localStorage.setItem("gen_mode", mode);
      localStorage.setItem("gen_feature", feature);
      localStorage.setItem(LOCAL_ENGINE_PRESET_KEY, localEnginePreset);
      localStorage.setItem("local_image_engine_url", localEngineUrl.trim());
      localStorage.setItem(LOCAL_ENGINE_COMFY_WORKFLOW_KEY, comfyWorkflowText);
      localStorage.setItem(
        LOCAL_ENGINE_COMFY_QUICK_SETTINGS_KEY,
        JSON.stringify({ samplerName: comfySamplerName, scheduler: comfyScheduler, cfgValue: comfyCfgValue, steps: comfySteps, width: comfyWidth, height: comfyHeight })
      );
      localStorage.setItem(LOCAL_ENGINE_COMFY_NODE_TARGETS_KEY, JSON.stringify(comfyNodeTargets));
      localStorage.setItem(LOCAL_ENGINE_AUTO_SAVE_KEY, String(autoSaveLocalEngines));
      localStorage.setItem(LOCAL_ENGINE_RECENT_URLS_KEY, JSON.stringify(recentLocalEngineEntries));
    } catch {}
  }, [
    mode,
    feature,
    localEnginePreset,
    localEngineUrl,
    comfyWorkflowText,
    comfySamplerName,
    comfyScheduler,
    comfyCfgValue,
    comfySteps,
    comfyWidth,
    comfyHeight,
    comfyNodeTargets,
    autoSaveLocalEngines,
    recentLocalEngineEntries,
  ]);

  useEffect(() => {
    const nextCheckpointName = extractComfyCheckpointName(comfyWorkflowText);
    if (nextCheckpointName && nextCheckpointName !== comfyCheckpointName) {
      setComfyCheckpointName(nextCheckpointName);
    }
  }, [comfyWorkflowText, comfyCheckpointName]);

  useEffect(() => {
    if (open && mode === "server" && authHash.trim() && apiNickname) {
      void loadHistory();
    }
  }, [open, mode, authHash, apiNickname, loadHistory]);

  const generateLocal = async (): Promise<{ url: string; warn?: string }> => {
    const url = resolveLocalEngineUrl(localEngineUrl, localEnginePreset);
    const steps = 20;
    const width = feature === "comic_4panel" ? 1024 : 768;
    const height = feature === "comic_4panel" ? 1024 : 512;
    const { positiveText, negativeText } = buildPromptTexts(feature, prompt, negativePrompt);

    if (localEnginePreset === "comfyui") {
      try {
        const comfyStepsValue = parsePositiveIntInput(comfySteps, steps);
        const comfyWidthValue = parsePositiveIntInput(comfyWidth, width);
        const comfyHeightValue = parsePositiveIntInput(comfyHeight, height);
        const comfyCfgNumber = parsePositiveFloatInput(comfyCfgValue);
        const parsedWorkflow = JSON.parse(comfyWorkflowText) as Record<string, ComfyWorkflowNode>;
        const nodeTargetIssues = validateComfyNodeTargets(parsedWorkflow, comfyNodeTargets);
        if (nodeTargetIssues.length > 0) {
          throw new Error(
            `지정한 ComfyUI 노드 ID를 워크플로에서 찾지 못했거나 타입이 맞지 않습니다: ${nodeTargetIssues.join(", ")}`
          );
        }
        const workflow = applyComfyWorkflowOverrides(parsedWorkflow, {
          positiveText,
          negativeText,
          width: comfyWidthValue,
          height: comfyHeightValue,
          steps: comfyStepsValue,
          checkpointName: comfyCheckpointName,
          samplerName: comfySamplerName,
          scheduler: comfyScheduler,
          cfgValue: comfyCfgNumber,
          nodeTargets: comfyNodeTargets,
        });
        const clientId =
          typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `resonans-${Date.now()}`;
        const queueRes = await withTimeout(
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: workflow, client_id: clientId }),
          }),
          15000
        );
        const queueJson = (await queueRes.json().catch(() => ({}))) as {
          prompt_id?: string;
          node_errors?: Record<string, unknown>;
          error?: string;
        };
        if (!queueRes.ok) {
          throw new Error(queueJson.error ?? "ComfyUI 큐 등록에 실패했습니다.");
        }
        if (queueJson.node_errors && Object.keys(queueJson.node_errors).length > 0) {
          throw new Error("ComfyUI 워크플로 검증 오류가 있습니다. checkpoint, 노드 연결, 입력값을 확인해 주세요.");
        }
        if (!queueJson.prompt_id) {
          throw new Error("ComfyUI prompt_id를 받지 못했습니다.");
        }

        const historyUrl = new URL(`/history/${queueJson.prompt_id}`, url).toString();
        let outputImage: { filename?: string; subfolder?: string; type?: string } | null = null;
        for (let i = 0; i < COMFY_POLL_ATTEMPTS; i++) {
          await new Promise((resolve) => setTimeout(resolve, COMFY_POLL_INTERVAL_MS));
          const historyRes = await withTimeout(
            fetch(historyUrl, {
              method: "GET",
              headers: { Accept: "application/json" },
            }),
            15000
          );
          const historyJson = (await historyRes.json().catch(() => ({}))) as unknown;
          outputImage = extractComfyOutputImage(historyJson, queueJson.prompt_id, comfyNodeTargets.outputNodeId);
          if (outputImage?.filename) break;
        }

        if (!outputImage?.filename) {
          throw new Error(
            comfyNodeTargets.outputNodeId.trim()
              ? `ComfyUI 생성은 끝났지만 선택한 출력 노드(ID: ${comfyNodeTargets.outputNodeId.trim()})에서 결과 이미지를 찾지 못했습니다.`
              : "ComfyUI 생성이 끝났지만 결과 이미지를 찾지 못했습니다. SaveImage 노드가 있는지 확인해 주세요."
          );
        }

        const viewUrl = buildComfyViewUrl(url, outputImage);
        const imageRes = await withTimeout(fetch(viewUrl), 15000);
        if (!imageRes.ok) {
          throw new Error(`ComfyUI 결과 이미지 조회 실패 (HTTP ${imageRes.status})`);
        }
        const imageBlob = await imageRes.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("ComfyUI 이미지 읽기 실패"));
          };
          reader.onerror = () => reject(new Error("ComfyUI 이미지 읽기 실패"));
          reader.readAsDataURL(imageBlob);
        });
        return { url: dataUrl };
      } catch (error) {
        throw new Error(`ComfyUI 생성 실패: ${extractErrorMessage(error, "ComfyUI")}`);
      }
    }

    const payload = {
      prompt: positiveText,
      negative_prompt: negativeText || undefined,
      steps,
      width,
      height,
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { images?: string[] };
      if (!res.ok) throw new Error("로컬 엔진 호출 실패(웹UI 실행/설정/CORS를 확인하세요).");
      const b64 = Array.isArray(json.images) ? json.images[0] : null;
      if (!b64) throw new Error("로컬 엔진 결과가 없습니다.");
      return { url: dataUrlFromBase64(b64) };
    } catch (error) {
      throw new Error(formatLocalGenerationError(error, url, "로컬 엔진"));
    }
  };

  const testLocalEngineConnection = async () => {
    setLocalEngineTestBusy(true);
    setLocalEngineTestResult(null);
    try {
      const resolvedUrl = resolveLocalEngineUrl(localEngineUrl, localEnginePreset);
      const probeUrl = buildLocalEngineProbeUrl(localEngineUrl, localEnginePreset);
      const res = await fetch(probeUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        if (autoSaveLocalEngines) {
          setRecentLocalEngineEntries((prev) =>
            upsertRecentLocalEngineEntry(prev, {
              url: resolvedUrl,
              label: localEngineLabel.trim() || buildLocalEngineDefaultLabel(resolvedUrl),
              preset: localEnginePreset,
            })
          );
        }
        setLocalEngineTestResult({
          tone: "success",
          message: `연결 확인됨: ${resolvedUrl}`,
        });
        return;
      }

      if (res.status === 404 || res.status === 405) {
        setLocalEngineTestResult({
          tone: "warning",
          message: `엔진 서버 응답은 확인됐지만 상태 확인용 API(${probeUrl})는 지원하지 않았습니다. 생성 엔드포인트(${resolvedUrl})로는 동작할 수 있습니다.`,
        });
        return;
      }

      setLocalEngineTestResult({
        tone: "error",
        message: `엔진 응답 오류: HTTP ${res.status}. 주소 또는 엔진 설정을 확인해 주세요.`,
      });
    } catch (error) {
      const resolvedUrl = (() => {
        try {
          return resolveLocalEngineUrl(localEngineUrl, localEnginePreset);
        } catch {
          return localEngineUrl.trim() || DEFAULT_LOCAL_ENGINE_URL;
        }
      })();
      setLocalEngineTestResult({
        tone: "error",
        message: formatLocalGenerationError(
          error,
          resolvedUrl,
          localEnginePreset === "comfyui" ? "ComfyUI" : "로컬 엔진"
        ),
      });
    } finally {
      setLocalEngineTestBusy(false);
    }
  };

  const generateServer = async (): Promise<{ url: string; warn?: string }> => {
    if (!authHash.trim()) {
      throw new Error("먼저 「내 자각 실험 결과 보기」에서 닉네임·비밀번호로 조회해 주세요.");
    }
    const entRes = await fetch(
      `/api/entitlements?nickname=${encodeURIComponent(apiNickname)}&authHash=${encodeURIComponent(authHash.trim())}`
    );
    const entJson = (await entRes.json().catch(() => ({}))) as {
      features?: Record<string, boolean>;
      error?: string;
    };
    if (entRes.status === 401) {
      throw new Error(entJson.error ?? "먼저 「내 자각 실험 결과 보기」에서 조회해 주세요.");
    }
    if (!entJson.features?.[feature]) {
      throw new Error(
        "서버 생성은 관리자 승인 후 사용 가능합니다. 관리자 메뉴 > 기능 승인(유료) 토글에서 해당 기능을 승인한 뒤 다시 생성해 주세요."
      );
    }
    const res = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: apiNickname,
        authHash: authHash.trim(),
        featureKey: feature,
        prompt,
        negativePrompt,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      imageBase64?: string;
      error?: string;
      requiresAuth?: boolean;
      usage?: { usedToday: number; dailyLimit: number; usedMonth: number; monthlyLimit: number };
      cached?: boolean;
      url?: string | null;
      storage?: { bucket: string; path: string };
      storageWarning?: string;
      usedToday?: number;
      dailyLimit?: number;
      usedMonth?: number;
      monthlyLimit?: number;
    };
    if (res.status === 401) {
      throw new Error(
        json.requiresAuth
          ? "세션이 만료되었을 수 있습니다. 「내 자각 실험 결과 보기」에서 다시 조회해 주세요."
          : (json.error ?? "인증 실패")
      );
    }
    if (res.status === 402) {
      throw new Error(json.error ?? "관리자 승인 후 서버 생성을 사용할 수 있습니다.");
    }
    if (res.status === 429) {
      throw new Error(json.error ?? "서버 생성 한도에 도달했습니다.");
    }
    if (res.status === 409) {
      throw new Error(json.error ?? "이미 생성 중입니다. 잠시 후 다시 시도해 주세요.");
    }
    if (!res.ok) throw new Error(json.error ?? "서버 생성 실패");
    if (json.cached && (json.url || (json.storage?.bucket && json.storage?.path))) {
      setCacheHit(true);
      await loadHistory();
      if (json.url) return { url: json.url };
      throw new Error("동일 요청 캐시는 있으나 링크 생성에 실패했습니다. 아래 최근 생성에서 확인해 주세요.");
    }
    if (!json.imageBase64) throw new Error("서버 생성 결과가 없습니다.");
    setCacheHit(false);
    if (json.usage) setUsage(json.usage);
    else if (
      typeof json.usedToday === "number" &&
      typeof json.dailyLimit === "number" &&
      typeof json.usedMonth === "number" &&
      typeof json.monthlyLimit === "number"
    ) {
      setUsage({
        usedToday: json.usedToday,
        dailyLimit: json.dailyLimit,
        usedMonth: json.usedMonth,
        monthlyLimit: json.monthlyLimit,
      });
    }
    await loadHistory();
    return {
      url: dataUrlFromBase64(json.imageBase64),
      warn: json.storageWarning,
    };
  };

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    setImageUrl(null);
    setPanels(null);
    setStorageWarning(null);
    try {
      const out =
        mode === "local" ? await generateLocal() : await generateServer();
      if (mode === "local") {
        const resolvedUrl = resolveLocalEngineUrl(localEngineUrl, localEnginePreset);
        if (autoSaveLocalEngines) {
          setRecentLocalEngineEntries((prev) =>
            upsertRecentLocalEngineEntry(prev, {
              url: resolvedUrl,
              label: localEngineLabel.trim() || buildLocalEngineDefaultLabel(resolvedUrl),
              preset: localEnginePreset,
            })
          );
        }
        setLocalEngineTestResult({
          tone: "success",
          message: `생성 성공: ${resolvedUrl}`,
        });
      }
      setImageUrl(out.url);
      if ("warn" in out && out.warn) setStorageWarning(out.warn);
      if (feature === "comic_4panel") {
        const p = await splitToFourPanels(out.url);
        setPanels(p);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveLocalEngineAlias = () => {
    try {
      const resolvedUrl = resolveLocalEngineUrl(localEngineUrl, localEnginePreset);
      const label = localEngineLabel.trim() || buildLocalEngineDefaultLabel(resolvedUrl);
      setLocalEngineLabel(label);
      setRecentLocalEngineEntries((prev) =>
        upsertRecentLocalEngineEntry(prev, {
          url: resolvedUrl,
          label,
          preset: localEnginePreset,
        })
      );
      setLocalEngineTestResult({
        tone: "success",
        message: `별칭 저장됨: ${label} (${resolvedUrl})`,
      });
    } catch (error) {
      setLocalEngineTestResult({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const removeLocalEngineAlias = (url: string) => {
    setRecentLocalEngineEntries((prev) => prev.filter((item) => item.url !== url));
    if (localEngineUrl.trim() === url) {
      setLocalEngineLabel(buildLocalEngineDefaultLabel(url));
      setLocalEngineTestResult(null);
    }
  };

  const clearAllLocalEngineAliases = () => {
    setRecentLocalEngineEntries([]);
    setLocalEngineTestResult({
      tone: "success",
      message: "저장된 엔진 주소를 모두 비웠습니다.",
    });
  };

  const syncComfyQuickSettingsFromWorkflow = (workflowText: string, message?: string) => {
    const nextQuickSettings = extractComfyQuickSettings(workflowText);
    setComfyCheckpointName(extractComfyCheckpointName(workflowText));
    setComfySamplerName(nextQuickSettings.samplerName);
    setComfyScheduler(nextQuickSettings.scheduler);
    setComfyCfgValue(nextQuickSettings.cfgValue);
    setComfySteps(nextQuickSettings.steps);
    setComfyWidth(nextQuickSettings.width);
    setComfyHeight(nextQuickSettings.height);
    setComfyNodeTargets(extractComfyNodeTargets(workflowText));
    if (message) {
      setLocalEngineTestResult({
        tone: "success",
        message,
      });
    }
  };

  const applyComfyWorkflowTemplate = (template: ComfyWorkflowTemplate) => {
    setComfyWorkflowText(template.workflow);
    syncComfyQuickSettingsFromWorkflow(
      template.workflow,
      `${template.label}을 불러왔습니다. 모델명과 빠른 설정을 확인한 뒤 사용해 주세요.`
    );
  };

  const applyRecommendedComfyNodeTargets = () => {
    setComfyNodeTargets(comfyRecommendedNodeTargets);
    setLocalEngineTestResult({
      tone: "success",
      message: "현재 워크플로 기준 추천 노드 매핑을 적용했습니다.",
    });
  };

  const rereadComfyWorkflowSettings = () => {
    syncComfyQuickSettingsFromWorkflow(comfyWorkflowText, "현재 워크플로 JSON에서 노드 ID와 빠른 설정 값을 다시 읽었습니다.");
  };

  const clearExampleComfyCheckpointName = () => {
    try {
      const workflow = JSON.parse(comfyWorkflowText) as Record<string, ComfyWorkflowNode>;
      let changed = false;
      for (const node of Object.values(workflow)) {
        if (node.class_type !== "CheckpointLoaderSimple" || !node.inputs) continue;
        if (typeof node.inputs.ckpt_name === "string" && hasExampleComfyCheckpointName(node.inputs.ckpt_name)) {
          node.inputs.ckpt_name = "";
          changed = true;
        }
      }
      setComfyCheckpointName("");
      if (changed) {
        setComfyWorkflowText(JSON.stringify(workflow, null, 2));
      }
      setLocalEngineTestResult({
        tone: "success",
        message: "예시 체크포인트 모델명을 비웠습니다. 실제 모델 파일명을 입력해 주세요.",
      });
    } catch {
      setComfyCheckpointName("");
      setLocalEngineTestResult({
        tone: "success",
        message: "체크포인트 입력값을 비웠습니다. 실제 모델 파일명을 다시 지정해 주세요.",
      });
    }
  };

  const assignComfyNodeRole = (role: ComfyNodeRoleKey, nodeId: string) => {
    setComfyNodeTargets((prev) => ({ ...prev, [role]: nodeId }));
  };

  const getAssignableComfyNodeRoles = (classType: string): Array<{ key: ComfyNodeRoleKey; label: string }> => {
    if (classType === "CLIPTextEncode") {
      return [
        { key: "positivePromptNodeId", label: "양수 프롬프트" },
        { key: "negativePromptNodeId", label: "음수 프롬프트" },
      ];
    }
    if (classType === "CheckpointLoaderSimple") {
      return [{ key: "checkpointNodeId", label: "체크포인트" }];
    }
    if (classType === "KSampler") {
      return [{ key: "samplerNodeId", label: "샘플러" }];
    }
    if (classType === "EmptyLatentImage") {
      return [{ key: "latentNodeId", label: "해상도" }];
    }
    if (classType === "SaveImage" || classType === "PreviewImage") {
      return [{ key: "outputNodeId", label: "출력" }];
    }
    return [];
  };

  const getComfyNodeRoles = (nodeId: string) => {
    const roles: string[] = [];
    if (comfyNodeTargets.positivePromptNodeId.trim() === nodeId) roles.push("양수 프롬프트");
    if (comfyNodeTargets.negativePromptNodeId.trim() === nodeId) roles.push("음수 프롬프트");
    if (comfyNodeTargets.checkpointNodeId.trim() === nodeId) roles.push("체크포인트");
    if (comfyNodeTargets.samplerNodeId.trim() === nodeId) roles.push("샘플러");
    if (comfyNodeTargets.latentNodeId.trim() === nodeId) roles.push("해상도");
    if (comfyNodeTargets.outputNodeId.trim() === nodeId) roles.push("출력");
    return roles;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[min(96vw,46rem)] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-100">이미지/웹툰 생성</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500">생성 방식</span>
            <button
              type="button"
              onClick={() => setMode("local")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                mode === "local"
                  ? "bg-electric-blue/25 text-electric-blue border-electric-blue/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              로컬(무료)
            </button>
            <button
              type="button"
              onClick={() => setMode("server")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                mode === "server"
                  ? "bg-deep-violet/25 text-deep-violet border-deep-violet/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              서버(유료·승인)
            </button>
            <span className="text-[11px] text-slate-600">
              로컬은 현재 이 브라우저에서 접근 가능한 엔진 주소를 사용합니다. 같은 PC의 `127.0.0.1`뿐 아니라 별도 이미지 서버 IP도 입력할 수 있습니다.
            </span>
          </div>
          {mode === "local" && (
            <div className="space-y-2">
              <label className="block">
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>로컬/별도 엔진 주소</span>
                  {localEngineTestResult?.tone === "success" && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                      연결 확인됨
                    </span>
                  )}
                </span>
                <input
                  value={localEngineUrl}
                  onChange={(e) => {
                    setLocalEngineUrl(e.target.value);
                    setLocalEngineTestResult(null);
                  }}
                  placeholder="예: http://127.0.0.1:7860 또는 http://192.168.0.10:7860"
                  className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-slate-400">엔진 프리셋</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalEnginePreset("a1111");
                    setLocalEngineTestResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    localEnginePreset === "a1111"
                      ? "bg-electric-blue/25 text-electric-blue border-electric-blue/40"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  A1111 기본
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalEnginePreset("comfyui");
                    setLocalEngineTestResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    localEnginePreset === "comfyui"
                      ? "bg-electric-blue/25 text-electric-blue border-electric-blue/40"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  ComfyUI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalEnginePreset("custom");
                    setLocalEngineTestResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    localEnginePreset === "custom"
                      ? "bg-electric-blue/25 text-electric-blue border-electric-blue/40"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  직접 경로 입력
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                {localEnginePreset === "a1111"
                  ? "A1111 기본 프리셋은 주소만 입력해도 `/sdapi/v1/txt2img` 경로를 자동으로 붙입니다."
                  : localEnginePreset === "comfyui"
                    ? "ComfyUI 프리셋은 주소만 입력해도 `/prompt` 경로를 자동으로 붙입니다. 아래 워크플로 JSON에서 checkpoint 이름과 노드 구성을 맞춘 뒤 사용하세요."
                    : "직접 경로 입력은 전체 엔드포인트 경로까지 직접 입력합니다. A1111 호환 txt2img 응답(`images[]`)을 반환하는 주소여야 합니다."}
              </p>
              {localEnginePreset === "comfyui" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-slate-400">ComfyUI 템플릿</span>
                    {COMFY_WORKFLOW_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyComfyWorkflowTemplate(template)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                        title={template.description}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                  <label className="block">
                    <span className="text-xs text-slate-400">Checkpoint / 모델 파일명</span>
                    <input
                      value={comfyCheckpointName}
                      onChange={(e) => setComfyCheckpointName(e.target.value)}
                      placeholder="예: dreamshaper.safetensors"
                      className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      생성 시 `CheckpointLoaderSimple.ckpt_name` 값에 우선 적용됩니다. 비워두면 워크플로 JSON의 값을 그대로 사용합니다.
                    </span>
                  </label>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">ComfyUI 빠른 설정</span>
                      <button
                        type="button"
                        onClick={() =>
                          syncComfyQuickSettingsFromWorkflow(
                            comfyWorkflowText,
                            "현재 워크플로 JSON에서 빠른 설정 값을 다시 읽었습니다."
                          )
                        }
                        className="text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        JSON 값 다시 읽기
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-slate-400">Sampler</span>
                        <input
                          value={comfySamplerName}
                          onChange={(e) => setComfySamplerName(e.target.value)}
                          placeholder="예: euler, dpmpp_2m"
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">Scheduler</span>
                        <input
                          value={comfyScheduler}
                          onChange={(e) => setComfyScheduler(e.target.value)}
                          placeholder="예: normal, karras"
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">CFG</span>
                        <input
                          value={comfyCfgValue}
                          onChange={(e) => setComfyCfgValue(e.target.value)}
                          placeholder="예: 7"
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">Steps</span>
                        <input
                          value={comfySteps}
                          onChange={(e) => setComfySteps(e.target.value)}
                          placeholder="예: 20"
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">Width</span>
                        <input
                          value={comfyWidth}
                          onChange={(e) => setComfyWidth(e.target.value)}
                          placeholder="예: 768"
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">Height</span>
                        <input
                          value={comfyHeight}
                          onChange={(e) => setComfyHeight(e.target.value)}
                          placeholder="예: 512"
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      위 값들은 생성 시 `KSampler`와 `EmptyLatentImage` 노드에 우선 적용됩니다. 비워두거나 잘못 입력하면 워크플로 기본값 또는 화면 기본값을 사용합니다.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">대상 노드 ID</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={applyRecommendedComfyNodeTargets}
                          disabled={!!comfyWorkflowJsonError || isUsingRecommendedComfyNodeTargets}
                          className={`text-[11px] ${
                            comfyWorkflowJsonError || isUsingRecommendedComfyNodeTargets
                              ? "text-slate-600"
                              : "text-electric-blue hover:text-electric-blue/80"
                          }`}
                        >
                          추천 매핑 적용
                        </button>
                        <button
                          type="button"
                          onClick={rereadComfyWorkflowSettings}
                          className="text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          JSON 노드 다시 읽기
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          isUsingRecommendedComfyNodeTargets
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isUsingRecommendedComfyNodeTargets ? "추천 매핑 사용 중" : "수동 매핑 사용 중"}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
                        추천: P {comfyRecommendedNodeTargets.positivePromptNodeId || "-"} / N{" "}
                        {comfyRecommendedNodeTargets.negativePromptNodeId || "-"} / C{" "}
                        {comfyRecommendedNodeTargets.checkpointNodeId || "-"} / S{" "}
                        {comfyRecommendedNodeTargets.samplerNodeId || "-"} / L{" "}
                        {comfyRecommendedNodeTargets.latentNodeId || "-"} / O{" "}
                        {comfyRecommendedNodeTargets.outputNodeId || "-"}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-slate-400">양수 프롬프트 노드 ID</span>
                        <input
                          list="comfy-clip-node-options"
                          value={comfyNodeTargets.positivePromptNodeId}
                          onChange={(e) =>
                            setComfyNodeTargets((prev) => ({ ...prev, positivePromptNodeId: e.target.value }))
                          }
                          placeholder='예: 6'
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">음수 프롬프트 노드 ID</span>
                        <input
                          list="comfy-clip-node-options"
                          value={comfyNodeTargets.negativePromptNodeId}
                          onChange={(e) =>
                            setComfyNodeTargets((prev) => ({ ...prev, negativePromptNodeId: e.target.value }))
                          }
                          placeholder='예: 7'
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">Checkpoint 노드 ID</span>
                        <input
                          list="comfy-checkpoint-node-options"
                          value={comfyNodeTargets.checkpointNodeId}
                          onChange={(e) =>
                            setComfyNodeTargets((prev) => ({ ...prev, checkpointNodeId: e.target.value }))
                          }
                          placeholder='예: 4'
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-400">KSampler 노드 ID</span>
                        <input
                          list="comfy-sampler-node-options"
                          value={comfyNodeTargets.samplerNodeId}
                          onChange={(e) =>
                            setComfyNodeTargets((prev) => ({ ...prev, samplerNodeId: e.target.value }))
                          }
                          placeholder='예: 3'
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs text-slate-400">EmptyLatentImage 노드 ID</span>
                        <input
                          list="comfy-latent-node-options"
                          value={comfyNodeTargets.latentNodeId}
                          onChange={(e) =>
                            setComfyNodeTargets((prev) => ({ ...prev, latentNodeId: e.target.value }))
                          }
                          placeholder='예: 5'
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs text-slate-400">결과 이미지 출력 노드 ID</span>
                        <input
                          list="comfy-output-node-options"
                          value={comfyNodeTargets.outputNodeId}
                          onChange={(e) =>
                            setComfyNodeTargets((prev) => ({ ...prev, outputNodeId: e.target.value }))
                          }
                          placeholder='예: 9'
                          className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                        />
                      </label>
                    </div>
                    <datalist id="comfy-clip-node-options">
                      {comfyClipNodeOptions.map((node) => (
                        <option key={node.id} value={node.id} label={`${node.id} - ${node.classType}`} />
                      ))}
                    </datalist>
                    <datalist id="comfy-checkpoint-node-options">
                      {comfyCheckpointNodeOptions.map((node) => (
                        <option key={node.id} value={node.id} label={`${node.id} - ${node.classType}`} />
                      ))}
                    </datalist>
                    <datalist id="comfy-sampler-node-options">
                      {comfySamplerNodeOptions.map((node) => (
                        <option key={node.id} value={node.id} label={`${node.id} - ${node.classType}`} />
                      ))}
                    </datalist>
                    <datalist id="comfy-latent-node-options">
                      {comfyLatentNodeOptions.map((node) => (
                        <option key={node.id} value={node.id} label={`${node.id} - ${node.classType}`} />
                      ))}
                    </datalist>
                    <datalist id="comfy-output-node-options">
                      {comfyOutputNodeOptions.map((node) => (
                        <option key={node.id} value={node.id} label={`${node.id} - ${node.classType}`} />
                      ))}
                    </datalist>
                    <p className="text-[11px] text-slate-500">
                      커스텀 워크플로에서 같은 종류의 노드가 여러 개일 때 사용할 대상 노드를 직접 지정합니다. 결과 이미지 출력 노드를 지정하면 해당 노드의 출력만 우선 조회합니다. 잘못된 ID나 타입이 지정되면 생성 전에 바로 오류로 안내합니다.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">워크플로 노드 목록</span>
                      <span className="text-[11px] text-slate-500">
                        {comfyWorkflowNodeList.length > 0 ? `${comfyWorkflowNodeList.length}개 노드 감지` : "노드 미감지"}
                      </span>
                    </div>
                    {comfyWorkflowJsonError ? (
                      <p className="text-[11px] text-amber-300">
                        워크플로 JSON 파싱 오류: {comfyWorkflowJsonError}
                      </p>
                    ) : comfyWorkflowNodeList.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                        <div className="flex flex-wrap gap-2">
                          {comfyWorkflowNodeList.map((node) => {
                            const roles = getComfyNodeRoles(node.id);
                            const assignableRoles = getAssignableComfyNodeRoles(node.classType);
                            return (
                              <div
                                key={node.id}
                                className={`rounded-lg border px-2 py-1 text-[11px] ${
                                  roles.length > 0
                                    ? "border-electric-blue/40 bg-electric-blue/10 text-electric-blue"
                                    : "border-slate-700 bg-slate-900 text-slate-300"
                                }`}
                                title={`${node.id} - ${node.classType}`}
                              >
                                <div className="font-medium">
                                  {node.id} · {node.classType}
                                </div>
                                {roles.length > 0 && (
                                  <div className="mt-1 text-[10px] text-slate-300">
                                    {roles.join(", ")}
                                  </div>
                                )}
                                {assignableRoles.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {assignableRoles.map((role) => {
                                      const active = roles.includes(role.label);
                                      return (
                                        <button
                                          key={role.key}
                                          type="button"
                                          onClick={() => assignComfyNodeRole(role.key, node.id)}
                                          className={`rounded px-1.5 py-0.5 text-[10px] transition ${
                                            active
                                              ? "bg-electric-blue/25 text-electric-blue border border-electric-blue/40"
                                              : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                                          }`}
                                        >
                                          {role.label}로 사용
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        유효한 워크플로 JSON을 입력하면 여기에서 노드 ID와 타입을 바로 확인할 수 있습니다.
                      </p>
                    )}
                  </div>
                  {!comfyWorkflowJsonError && comfyWorkflowWarnings.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-amber-200">사전 점검 경고</span>
                        <span className="text-[11px] text-amber-300/80">{comfyWorkflowWarnings.length}개 확인 필요</span>
                      </div>
                      <div className="space-y-1">
                        {comfyWorkflowWarnings.map((warning, index) => (
                          <p key={`${warning}-${index}`} className="text-[11px] text-amber-100">
                            - {warning}
                          </p>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isUsingRecommendedComfyNodeTargets && (
                          <button
                            type="button"
                            onClick={applyRecommendedComfyNodeTargets}
                            className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-400/15"
                          >
                            추천 매핑 적용
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={rereadComfyWorkflowSettings}
                          className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-400/15"
                        >
                          노드/빠른설정 다시 읽기
                        </button>
                        {hasExampleCheckpointWarning && (
                          <button
                            type="button"
                            onClick={clearExampleComfyCheckpointName}
                            className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-400/15"
                          >
                            예시 모델명 지우기
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <label className="block">
                    <span className="text-xs text-slate-400">ComfyUI 워크플로 JSON</span>
                    <textarea
                      value={comfyWorkflowText}
                      onChange={(e) => setComfyWorkflowText(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-xs min-h-[16rem] resize-y font-mono"
                    />
                  </label>
                </div>
              )}
              <label className="block">
                <span className="text-xs text-slate-400">주소 별칭(선택)</span>
                <input
                  value={localEngineLabel}
                  onChange={(e) => setLocalEngineLabel(e.target.value)}
                  placeholder="예: 내 PC, 작업실 서버, 테스트 서버"
                  className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                <input
                  type="checkbox"
                  checked={autoSaveLocalEngines}
                  onChange={(e) => setAutoSaveLocalEngines(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-electric-blue"
                />
                <span className="text-[11px] text-slate-300">연결 테스트/생성 성공 시 주소 자동 저장</span>
              </label>
              {recentLocalEngineEntries.length > 0 && (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">저장된 엔진 주소</p>
                    <button
                      type="button"
                      onClick={clearAllLocalEngineAliases}
                      className="text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      전체 비우기
                    </button>
                  </div>
                  <div className="space-y-2">
                    {recentLocalEngineEntries.map((entry) => (
                      <div
                        key={entry.url}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setLocalEngineUrl(entry.url);
                            setLocalEngineLabel(entry.label);
                            setLocalEnginePreset(entry.preset);
                            setLocalEngineTestResult({
                              tone: "success",
                              message: `저장된 엔진 선택됨: ${entry.label} (${entry.url})`,
                            });
                          }}
                          className="min-w-0 flex-1 text-left"
                          title={entry.url}
                        >
                          <div className="truncate text-[11px] font-medium text-slate-200">{entry.label}</div>
                          <div className="truncate text-[11px] text-slate-500">
                            {entry.preset === "a1111" ? "A1111" : entry.preset === "comfyui" ? "ComfyUI" : "직접"} · {entry.url}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLocalEngineAlias(entry.url)}
                          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveLocalEngineAlias}
                  disabled={busy || localEngineTestBusy}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  별칭 저장
                </button>
                <button
                  type="button"
                  onClick={testLocalEngineConnection}
                  disabled={busy || localEngineTestBusy}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {localEngineTestBusy ? "연결 확인 중..." : "연결 테스트"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalEnginePreset("a1111");
                    setLocalEngineUrl(DEFAULT_LOCAL_ENGINE_URL);
                    setLocalEngineLabel(buildLocalEngineDefaultLabel(DEFAULT_LOCAL_ENGINE_URL));
                    setComfyWorkflowText(DEFAULT_COMFY_WORKFLOW);
                    setLocalEngineTestResult(null);
                  }}
                  disabled={busy || localEngineTestBusy}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  기본값 복원
                </button>
              </div>
              {localEngineTestResult && (
                <p
                  className={`text-[11px] break-words ${
                    localEngineTestResult.tone === "success"
                      ? "text-emerald-300"
                      : localEngineTestResult.tone === "warning"
                        ? "text-amber-300"
                        : "text-red-400"
                  }`}
                >
                  {localEngineTestResult.message}
                </p>
              )}
              <p className="text-[11px] text-amber-300">
                브라우저가 로컬/사설 네트워크 엔진 접속 권한을 물으면 허용이 필요합니다. 또한 입력한 주소에서 CORS 허용과
                {localEnginePreset === "comfyui"
                  ? " ComfyUI는 `/prompt`, `/history/{prompt_id}`, `/view` API와 SaveImage 노드가 필요합니다."
                  : " `/sdapi/v1/txt2img` 엔드포인트가 열려 있어야 합니다."}
              </p>
            </div>
          )}
          {mode === "server" && !authHash.trim() && (
            <p className="text-[11px] text-amber-300">
              서버 생성·히스토리는 보안을 위해 「내 자각 실험 결과 보기」에서 닉네임·비밀번호 조회에 성공한 뒤에만 사용할 수 있습니다.
            </p>
          )}
          {mode === "server" && authHash.trim() && (
            <p className="text-[11px] text-slate-500">
              서버 생성 승인 여부는 관리자 메뉴의 `기능 승인(유료) 토글`에서 관리됩니다. 관리자 승인 후에는 이 창에서 다시 생성하면 바로 반영됩니다.
            </p>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500">형태</span>
            <button
              type="button"
              onClick={() => setFeature("image_cut")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                feature === "image_cut"
                  ? "bg-slate-700/70 text-slate-200 border-slate-600"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              한 장 이미지 컷
            </button>
            <button
              type="button"
              onClick={() => setFeature("comic_4panel")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                feature === "comic_4panel"
                  ? "bg-slate-700/70 text-slate-200 border-slate-600"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              4면 분할 웹툰(한 장 그리드)
            </button>
          </div>

          <label className="block">
            <span className="text-xs text-slate-400">프롬프트</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm min-h-[120px] resize-y"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">네거티브(선택)</span>
            <input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-gradient-resonans text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "생성 중..." : "생성하기"}
            </button>
            {comfyStatusBadge && (
              <span className={`rounded-full border px-2.5 py-1 text-[11px] ${comfyStatusBadge.className}`}>
                {comfyStatusBadge.label} · {comfyStatusBadge.detail}
              </span>
            )}
            {error && <span className="text-xs text-red-400 break-words">{error}</span>}
          </div>
          {cacheHit && mode === "server" && (
            <p className="text-[11px] text-emerald-300">
              캐시 재사용됨: 동일 요청은 비용/엔진 호출 없이 즉시 표시됩니다.
            </p>
          )}
          {usage && mode === "server" && (
            <p className="text-[11px] text-slate-500">
              서버 사용량: 오늘 {usage.usedToday}/{usage.dailyLimit}, 이번 달 {usage.usedMonth}/{usage.monthlyLimit}
            </p>
          )}
          {storageWarning && mode === "server" && (
            <p className="text-[11px] text-amber-300 break-words">{storageWarning}</p>
          )}

          {imageUrl && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">결과</p>
              <img src={imageUrl} alt="generated" className="w-full rounded-lg border border-slate-700" />
              <div className="flex flex-wrap gap-2">
                <a
                  href={imageUrl}
                  download={feature === "comic_4panel" ? "comic-grid.png" : "image.png"}
                  className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  다운로드
                </a>
              </div>
            </div>
          )}

          {panels && panels.length === 4 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">4면 분할(자동 분할)</p>
              <div className="grid grid-cols-2 gap-2">
                {panels.map((p, i) => (
                  <a key={i} href={p} download={`panel-${i + 1}.png`} className="block">
                    <img src={p} alt={`panel-${i + 1}`} className="w-full rounded border border-slate-700" />
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-slate-600">각 패널 클릭하면 개별 다운로드됩니다.</p>
            </div>
          )}

          {mode === "server" && (
            <div className="pt-3 border-t border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">최근 생성(서버)</p>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="text-[11px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  새로고침
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-[11px] text-slate-600">최근 생성 내역이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {history.map((h) => (
                    <a
                      key={h.id}
                      href={h.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded border border-slate-700 bg-slate-900/50 overflow-hidden hover:border-slate-500"
                      title={`${new Date(h.created_at).toLocaleString("ko-KR")} · ${h.feature_key}`}
                    >
                      {h.url ? (
                        <img src={h.url} alt="history" className="w-full h-24 object-cover" />
                      ) : (
                        <div className="h-24 flex items-center justify-center text-[11px] text-slate-600">
                          링크 준비중
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

