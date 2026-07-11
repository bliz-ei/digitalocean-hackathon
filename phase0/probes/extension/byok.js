const providers = Object.freeze({
  digitalocean: {
    name: "DigitalOcean Serverless Inference",
    baseUrl: "https://inference.do-ai.run",
    storageKey: "phase0KeyDigitalOcean",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    storageKey: "phase0KeyOpenAI",
  },
});

const classificationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "exact_claim", "queries"],
  properties: {
    classification: { type: "string", enum: ["opinion", "factual_claim", "unverifiable"] },
    exact_claim: { type: "string" },
    queries: {
      type: "object",
      additionalProperties: false,
      required: ["neutral", "support", "counter"],
      properties: {
        neutral: { type: "string" },
        support: { type: "string" },
        counter: { type: "string" },
      },
    },
  },
};

const verdictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "confidence", "explanation", "uncertainty", "counterevidence_summary", "common_ground", "citation_ids"],
  properties: {
    label: { type: "string", enum: ["Supported", "Misleading", "Disputed", "Unsupported", "Insufficient evidence"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    explanation: { type: "string" },
    uncertainty: { type: "string" },
    counterevidence_summary: { type: "string" },
    common_ground: { type: "string" },
    citation_ids: { type: "array", minItems: 2, maxItems: 3, items: { type: "string", enum: ["E1", "E2"] } },
  },
};

const elements = Object.fromEntries(["provider", "model", "mode", "timeout", "key", "message", "record"].map((id) => [id, document.querySelector(`#${id}`)]));
let compatibilityRecord = null;

function setMessage(value) { elements.message.textContent = value; }
function selectedProvider() { return providers[elements.provider.value]; }

function validateObject(value, schema, path = "$") {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in schema.properties)) throw new Error(`${path}.${key} is not allowed`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value) validateObject(value[key], child, `${path}.${key}`);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    if (value.length < (schema.minItems || 0) || value.length > (schema.maxItems || Infinity)) throw new Error(`${path} has invalid length`);
    value.forEach((item, index) => validateObject(item, schema.items, `${path}[${index}]`));
  } else if (typeof value !== schema.type) {
    throw new Error(`${path} must be ${schema.type}`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} is outside the allowed enum`);
  if (typeof value === "number" && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) throw new Error(`${path} is outside range`);
}

function responseFormat(mode, name, schema) {
  if (mode === "json_schema") return { type: "json_schema", json_schema: { name, strict: true, schema } };
  if (mode === "json_object") return { type: "json_object" };
  return undefined;
}

function safeError(status, kind) {
  if (kind === "timeout") return "timeout";
  if (kind === "network") return "network_or_cors";
  if ([401, 403].includes(status)) return "authentication_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  if (status >= 400) return "request_incompatible";
  return "invalid_structured_response";
}

async function fetchWithTimeout(url, options, timeoutMs, allowRetry = true) {
  for (let attempt = 0; attempt < (allowRetry ? 2 : 1); attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 200)));
        continue;
      }
      return { response, attempts: attempt + 1 };
    } catch (error) {
      clearTimeout(timer);
      if (attempt === 0 && error.name !== "AbortError") {
        await new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 200)));
        continue;
      }
      const kind = error.name === "AbortError" ? "timeout" : "network";
      throw Object.assign(new Error(safeError(0, kind)), { safeCode: safeError(0, kind), attempts: attempt + 1 });
    }
  }
  throw new Error("request_failed");
}

async function getStoredKey(provider) {
  return (await chrome.storage.local.get(provider.storageKey))[provider.storageKey];
}

function resultBase(type, repetition) {
  return {
    type,
    repetition,
    started_at: new Date().toISOString(),
    latency_ms: null,
    http_status: null,
    attempts: 0,
    structured_valid: null,
    usage: null,
    safe_error: null,
  };
}

async function connectionProbe(provider, key, timeoutMs, invalidKey = false) {
  const result = resultBase(invalidKey ? "failure" : "connection", 1);
  const start = performance.now();
  try {
    const { response, attempts } = await fetchWithTimeout(`${provider.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
    }, timeoutMs, !invalidKey);
    result.attempts = attempts;
    result.http_status = response.status;
    result.structured_valid = invalidKey ? [401, 403].includes(response.status) : response.ok;
    if (!response.ok && !invalidKey) result.safe_error = safeError(response.status);
    await response.body?.cancel();
  } catch (error) {
    result.attempts = error.attempts || 1;
    result.safe_error = error.safeCode || "connection_failed";
    result.structured_valid = false;
  }
  result.latency_ms = Math.round((performance.now() - start) * 10) / 10;
  result.completed_at = new Date().toISOString();
  return result;
}

const prompts = {
  classification: "Classify this sentence: Electric vehicles produce no carbon emissions. Return only JSON matching the supplied schema. Preserve the exact sentence and provide neutral, support, and counter search queries.",
  synthesis: "Using only E1 and E2, return a cautious verdict as JSON. E1 says electric vehicles have no tailpipe emissions. E2 says manufacturing and electricity generation can cause lifecycle emissions. Cite both IDs and do not invent evidence.",
};

async function structuredProbe(provider, key, config, type, repetition) {
  const schema = type === "classification" ? classificationSchema : verdictSchema;
  const result = resultBase(type, repetition);
  const start = performance.now();
  const format = responseFormat(config.mode, `verity_${type}`, schema);
  const body = {
    model: config.model,
    messages: [
      { role: "system", content: "You are a schema-bound compatibility probe. Return JSON only." },
      { role: "user", content: prompts[type] },
    ],
    temperature: 0,
    stream: false,
    ...(format ? { response_format: format } : {}),
  };
  try {
    const { response, attempts } = await fetchWithTimeout(`${provider.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, config.timeoutMs);
    result.attempts = attempts;
    result.http_status = response.status;
    if (!response.ok) {
      result.structured_valid = false;
      result.safe_error = safeError(response.status);
      await response.body?.cancel();
    } else {
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("missing_message_content");
      const parsed = JSON.parse(content);
      validateObject(parsed, schema);
      if (type === "classification" && parsed.classification !== "factual_claim") throw new Error("unexpected_classification");
      if (type === "synthesis" && new Set(parsed.citation_ids).size !== parsed.citation_ids.length) throw new Error("duplicate_citation_ids");
      result.structured_valid = true;
      result.usage = payload.usage ? {
        prompt_tokens: payload.usage.prompt_tokens ?? null,
        completion_tokens: payload.usage.completion_tokens ?? null,
        total_tokens: payload.usage.total_tokens ?? null,
      } : null;
    }
  } catch (error) {
    result.attempts = error.attempts || result.attempts || 1;
    result.structured_valid = false;
    result.safe_error = error.safeCode || "invalid_structured_response";
  }
  result.latency_ms = Math.round((performance.now() - start) * 10) / 10;
  result.completed_at = new Date().toISOString();
  return result;
}

function renderRecord() {
  elements.record.textContent = compatibilityRecord ? JSON.stringify(compatibilityRecord, null, 2) : "Not run.";
}

elements.provider.addEventListener("change", async () => {
  const saved = await chrome.storage.local.get("phase0ByokConfig");
  const config = saved.phase0ByokConfig?.[elements.provider.value];
  elements.model.value = config?.model || "";
  elements.mode.value = config?.mode || "json_schema";
  elements.timeout.value = config?.timeoutMs || 10000;
  setMessage("");
});

document.querySelector("#save").addEventListener("click", async () => {
  const provider = selectedProvider();
  const key = elements.key.value.trim();
  const model = elements.model.value.trim();
  const timeoutMs = Number(elements.timeout.value);
  if (!key || !model || !Number.isFinite(timeoutMs)) {
    setMessage("Key, exact model ID, and timeout are required.");
    return;
  }
  const current = (await chrome.storage.local.get("phase0ByokConfig")).phase0ByokConfig || {};
  await chrome.storage.local.set({
    [provider.storageKey]: key,
    phase0ByokConfig: {
      ...current,
      [elements.provider.value]: { model, mode: elements.mode.value, timeoutMs },
    },
  });
  elements.key.value = "";
  setMessage(`Key saved locally for ${provider.name}; the input has been cleared.`);
});

document.querySelector("#delete").addEventListener("click", async () => {
  const provider = selectedProvider();
  const current = (await chrome.storage.local.get("phase0ByokConfig")).phase0ByokConfig || {};
  delete current[elements.provider.value];
  await chrome.storage.local.remove(provider.storageKey);
  await chrome.storage.local.set({ phase0ByokConfig: current });
  elements.model.value = "";
  const absent = !(await getStoredKey(provider));
  compatibilityRecord = {
    ...(compatibilityRecord || {}),
    key_lifecycle: { deleted_at: new Date().toISOString(), absent_after_delete: absent },
  };
  renderRecord();
  setMessage(absent ? "Key deleted and absence verified." : "Delete verification failed.");
});

document.querySelector("#suite").addEventListener("click", async () => {
  const provider = selectedProvider();
  const key = await getStoredKey(provider);
  const model = elements.model.value.trim();
  const timeoutMs = Number(elements.timeout.value);
  if (!key || !model) {
    setMessage("Save a key and exact model ID first.");
    return;
  }
  document.querySelector("#suite").disabled = true;
  setMessage("Running eight direct-origin requests…");
  const results = [];
  results.push(await connectionProbe(provider, key, timeoutMs));
  for (let repetition = 1; repetition <= 3; repetition += 1) {
    results.push(await structuredProbe(provider, key, { model, mode: elements.mode.value, timeoutMs }, "classification", repetition));
  }
  for (let repetition = 1; repetition <= 3; repetition += 1) {
    results.push(await structuredProbe(provider, key, { model, mode: elements.mode.value, timeoutMs }, "synthesis", repetition));
  }
  results.push(await connectionProbe(provider, "phase0-intentionally-invalid-key", timeoutMs, true));
  let invalidJsonDetected = false;
  try { JSON.parse("{invalid-json"); }
  catch { invalidJsonDetected = true; }
  results.push({
    type: "invalid_json_detection",
    repetition: 1,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    latency_ms: 0,
    http_status: null,
    attempts: 0,
    structured_valid: invalidJsonDetected,
    usage: null,
    safe_error: invalidJsonDetected ? null : "invalid_json_not_detected",
  });
  const passed = results.every((result) => result.structured_valid === true);
  compatibilityRecord = {
    schema_version: 1,
    boundary: "direct_extension_byok",
    provider: provider.name,
    base_url: provider.baseUrl,
    model,
    request_mode: "chat_completions",
    structured_output_mode: elements.mode.value,
    timeout_ms: timeoutMs,
    retry_policy: "one retry with jitter for network, 429, and 5xx",
    run_started_at: results[0].started_at,
    run_completed_at: new Date().toISOString(),
    status: passed ? "probe_passed_pending_repeat_and_delete" : "probe_failed",
    results,
    key_lifecycle: { stored_in: "chrome.storage.local", deleted_at: null, absent_after_delete: null },
    contains_key: false,
    contains_headers: false,
    contains_response_body: false,
  };
  renderRecord();
  setMessage(passed ? "Suite passed once. Export, delete the key, and repeat as the runbook requires." : "Suite found a compatibility failure; inspect only the safe error codes.");
  document.querySelector("#suite").disabled = false;
});

document.querySelector("#export").addEventListener("click", () => {
  if (!compatibilityRecord) { setMessage("Run the suite or delete-key check first."); return; }
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(compatibilityRecord, null, 2)}\n`], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `verity-byok-${elements.provider.value}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

const saved = await chrome.storage.local.get("phase0ByokConfig");
const initial = saved.phase0ByokConfig?.[elements.provider.value];
if (initial) {
  elements.model.value = initial.model || "";
  elements.mode.value = initial.mode || "json_schema";
  elements.timeout.value = initial.timeoutMs || 10000;
}
renderRecord();
