export function logMethodCall(method, args) {
    const ts = new Date().toISOString();
    const argsStr = args ? ` ${JSON.stringify(args)}` : '';
    console.log(`[storm-sdk ${ts}] ${method}${argsStr}`);
}
