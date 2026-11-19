export type JsonRequestBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" | "invalid_content_length" };

/**
 * Lit un corps JSON avec une limite stricte appliquée pendant le streaming.
 * Le Content-Length n'est qu'un contrôle anticipé : la limite réelle est
 * toujours vérifiée sur les octets effectivement reçus.
 */
export async function readJsonRequestBody(
  request: Request,
  maxBytes: number,
): Promise<JsonRequestBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    // Content-Length doit être un entier décimal sûr. Une valeur mal formée
    // ne doit jamais être traitée comme une absence d'en-tête.
    if (!/^\d+$/.test(declaredLength)) {
      return { ok: false, reason: "invalid_content_length" };
    }
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength)) {
      return { ok: false, reason: "invalid_content_length" };
    }
    if (parsedLength > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  if (!request.body) return { ok: false, reason: "invalid_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_json" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
