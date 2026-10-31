// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleCatalogProvider } from "../../../src/ui/shared/localization/rule-catalog";
import { KeywordText } from "../../../src/ui/shared/keyword-text";
import { renderRuleMessage, ruleMessage } from "../../../src/ui/shared/localization/rule-message";

describe("localizable rule messages", () => {
  it("preserves values and keyword identities when a translation reorders the complete message", () => {
    const message = ruleMessage("Deal 12 Burn damage; gain 3 Block");
    expect(message.template).toBe(
      "Deal {{value0}} <keyword0>Burn</keyword0> damage; gain {{value1}} <keyword1>Block</keyword1>",
    );
    const translated = renderRuleMessage(
      message,
      "<keyword1>Blocage</keyword1> {{value1}}; <keyword0>Brûlure</keyword0> {{value0}}",
    );
    expect(translated.map((part) => part.text).join("")).toBe("Blocage 3; Brûlure 12");
    expect(translated.filter((part) => part.keyword).map((part) => part.keyword)).toEqual(["block", "burn"]);
  });

  it("falls back to the complete original when a translation drops or duplicates a value or keyword", () => {
    const message = ruleMessage("Restore 7 Health; gain 2 Block");
    for (const invalid of [
      "<keyword0>Health</keyword0> {{value0}}",
      "{{value0}} {{value0}} {{value1}} <keyword0>Health</keyword0> <keyword1>Block</keyword1>",
      "{{value0}} {{value1}} <keyword0>Health</keyword0> <keyword9>Block</keyword9>",
      "{{value0}} {{value1}} <keyword0>{{value0}}</keyword0> <keyword1>Block</keyword1>",
    ]) {
      const result = renderRuleMessage(message, invalid);
      expect(result.map((part) => part.text).join("")).toBe("Restore 7 Health; gain 2 Block");
      expect(result.filter((part) => part.keyword).map((part) => part.keyword)).toEqual(["health", "block"]);
    }
  });

  it("renders placeholder values literally even when they contain template syntax", () => {
    const message = {
      source: "Original",
      template: "Value: {{value0}}",
      values: { value0: "<tag> {{value1}}" },
      keywords: {},
    };
    expect(renderRuleMessage(message, "Translated: {{value0}}")).toEqual([
      { text: "Translated: <tag> {{value1}}" },
    ]);
  });
});

it("updates rendered rules when the catalog changes, retaining accessible text and keyword identity", () => {
  const source = "Deal 12 Burn damage; gain 3 Block";
  const template = ruleMessage(source).template;
  const first = renderToStaticMarkup(
    <RuleCatalogProvider
      catalog={{
        [template]: "<keyword1>Blocage</keyword1> {{value1}}; <keyword0>Brûlure</keyword0> {{value0}}",
      }}
    >
      <KeywordText text={source} />
    </RuleCatalogProvider>,
  );
  expect(first).toContain('data-keyword="block"');
  expect(first).toContain('data-keyword="burn"');
  expect(first.replace(/<[^>]+>/g, "")).toBe("Blocage 3; Brûlure 12");
  const fallback = renderToStaticMarkup(<KeywordText text={source} />);
  expect(fallback.replace(/<[^>]+>/g, "")).toBe(source);
});

it("updates the same rendered component when its catalog changes", () => {
  const source = "Deal 12 Burn damage";
  const template = ruleMessage(source).template;
  const translated = { [template]: "<keyword0>Brûlure</keyword0> {{value0}}" };
  const view = render(
    <RuleCatalogProvider catalog={{}}>
      <KeywordText text={source} />
    </RuleCatalogProvider>,
  );
  expect(view.container.textContent).toBe(source);
  view.rerender(
    <RuleCatalogProvider catalog={translated}>
      <KeywordText text={source} />
    </RuleCatalogProvider>,
  );
  expect(view.container.textContent).toBe("Brûlure 12");
  expect(view.container.querySelector('[data-keyword="burn"]')?.textContent).toBe("Brûlure");
  view.unmount();
});

it("keeps literal markup safe and preserves the original English", () => {
  const source = "<script>Fire</script> and 3 Burn";
  const html = renderToStaticMarkup(<KeywordText text={source} />);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(
    renderRuleMessage(ruleMessage(source))
      .map((part) => part.text)
      .join(""),
  ).toBe(source);
});
