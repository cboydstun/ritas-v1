export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTelemetry } = await import('./lib/telemetry');
    if (process.env.NODE_ENV === 'production') {
      await initTelemetry();
    }
  }
}
