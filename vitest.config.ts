import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Voiced takes are not heard by speech recognition in tests (a fake hearer is passed
    // where the speech check itself is tested), so the suite needs no model or whisper-cli.
    env: { TALEKIT_HEAR: 'off' },
  },
});
