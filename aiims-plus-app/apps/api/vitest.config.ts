import { defineConfig } from "vitest/config";

/**
 * esbuild cannot resolve the tsconfig `extends` package specifier, so the
 * legacy-decorator options NestJS needs are stated explicitly for tests.
 */
export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: false,
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
