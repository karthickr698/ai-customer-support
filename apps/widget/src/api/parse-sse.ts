export type SseFrame = {
  readonly event: string;
  readonly data: string;
};

export function parseSseChunk(buffer: string): { readonly frames: SseFrame[]; readonly rest: string } {
  const frames: SseFrame[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const part of parts) {
    const frame = parseFrame(part);
    if (frame) {
      frames.push(frame);
    }
  }

  return { frames, rest };
}

function parseFrame(block: string): SseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.length === 0 || line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join('\n') };
}
