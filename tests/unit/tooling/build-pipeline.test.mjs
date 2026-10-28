import { afterEach, expect, it, vi } from "vitest";
import babel from "@rolldown/plugin-babel";
import config from "../../../vite.config.ts";

afterEach(() => vi.unstubAllEnvs());

async function compilerPlugin() {
  const resolved = config({ command: "build", mode: "production" });
  const plugins = (await Promise.all(resolved.plugins)).flat();
  return plugins.find((plugin) => plugin.name === "@rolldown/plugin-babel");
}

it("filters plain helpers while still compiling components and TypeScript hooks", async () => {
  vi.stubEnv("FAUNA_REACT_COMPILER", "1");
  const plugin = await compilerPlugin();
  plugin.configResolved({ command: "build" });
  const environment = { name: "client", config: { consumer: "client" } };
  expect(plugin.applyToEnvironment(environment)).toBe(true);
  const baseline = await babel({ plugins: ["babel-plugin-react-compiler"] });
  baseline.configResolved({ command: "build" });
  baseline.applyToEnvironment(environment);
  const matches = (code) => plugin.transform.filter.code.some((pattern) => pattern.test(code));
  expect(matches("export function sum(a, b) { return a + b; }")).toBe(false);
  for (const [file, code] of [
    ["example.tsx", "export function Example({ value }) { return <span>{value}</span>; }"],
    [
      "use-example.ts",
      "import { useState } from 'react'; export function useExample(initial: number) { const [value] = useState(initial); return { value }; }",
    ],
  ]) {
    expect(matches(code)).toBe(true);
    const result = await plugin.transform.handler.call(
      {
        environment,
        error: (error) => {
          throw new Error(error.message);
        },
      },
      code,
      `/fixture/${file}`,
    );
    expect(result.code).toContain("react/compiler-runtime");
    const previous = await baseline.transform.handler.call({ environment }, code, `/fixture/${file}`);
    expect(result.code).toBe(previous.code);
  }
});

it("retains the uncompiled performance comparison build", async () => {
  vi.stubEnv("FAUNA_REACT_COMPILER", "0");
  expect(await compilerPlugin()).toBeUndefined();
});
