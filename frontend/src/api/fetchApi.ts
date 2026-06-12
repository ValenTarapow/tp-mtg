const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 60000;

export async function fetchApi(url: string, options?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  console.error('fetchApi failed:', lastError);
  throw new Error(
    'No se pudo conectar con el servidor. Render puede estar despertando — esperá 30 segundos y probá de nuevo.',
  );
}
