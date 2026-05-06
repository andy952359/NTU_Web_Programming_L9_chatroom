function encodeChannelPart(id: string): string {
  const bytes = new TextEncoder().encode(id);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function channelName(a: string, b: string): string {
  return `chat-${[a, b].sort().map(encodeChannelPart).join('-')}`;
}

export function legacyChannelName(a: string, b: string): string {
  return `chat-${[a, b].sort().join('-')}`;
}
