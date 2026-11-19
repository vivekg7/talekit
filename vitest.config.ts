import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Worktrees under .claude/ hold copies of the suite.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Tests pass a fake hearer where they need one, so no whisper model is required.
    env: { TALEKIT_HEAR: 'off' },
  },
});
