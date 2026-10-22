import { expect, type Locator } from "@playwright/test";

/** Check the rendered cascade, including screen CSS that can override valid tokens. */
export async function expectControlColors(control: Locator, foregroundToken: string) {
  const colors = await control.evaluate((element, token) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    element.append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(element);
    return { foreground: style.color, background: style.backgroundColor, expected };
  }, foregroundToken);
  expect(colors.foreground).toBe(colors.expected);
  const luminance = (color: string) => {
    const values = color.match(/[\d.]+/g)!.map(Number);
    expect(values.length === 3 || values[3] === 1, `Opaque control color: ${color}`).toBe(true);
    const linear = values.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  const a = luminance(colors.foreground),
    b = luminance(colors.background);
  expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), JSON.stringify(colors)).toBeGreaterThanOrEqual(
    4.5,
  );
}
