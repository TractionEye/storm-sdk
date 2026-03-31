export function logMethodCall(method: string, args?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const argsStr = args ? ` ${JSON.stringify(args)}` : '';
  console.log(`[storm-sdk ${ts}] ${method}${argsStr}`);
}
