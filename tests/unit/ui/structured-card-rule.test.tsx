// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { definition } from "../../../src/game/content";
import { cardText, enemyCard } from "../../../src/game/card-rules";
import { CardRules } from "../../../src/ui/shared/combat/combat-values";
import { RuleCatalogProvider } from "../../../src/ui/shared/localization/rule-catalog";
import { structuredCardRule } from "../../../src/ui/shared/localization/structured-card-rule";
import { ActionCard } from "../../../src/ui/shared/cards/cards";
import { TooltipProvider } from "../../../src/components/ui/tooltip";
import { MessageProvider } from "../../../src/ui/shared/localization/message-context";
import type { MessageCatalog } from "../../../src/ui/shared/localization/messages";
import { cardRuleVariantId } from "../../../src/ui/shared/localization/rule-key.mjs";
import { run } from "../../support/game";
import { ruleMessage, renderRuleMessage } from "../../../src/ui/shared/localization/rule-message";

it("uses the structured guard rule for scaled player and enemy text, with safe translation fallback", () => {
  const card = definition("ravelland-rainward")!;
  const text = cardText(card, 1, undefined, 1.5);
  const result = structuredCardRule(card, 1, undefined, 1.5, text)!;
  expect(text).toBe("Gain 12 Block");
  expect(
    renderRuleMessage(result.message)
      .map((part) => part.text)
      .join(""),
  ).toBe(text);
  expect(structuredCardRule(enemyCard(card), 1, undefined, 1.5, text)).toEqual(result);
  expect(structuredCardRule(card, 1, undefined, 1.5, `${text}; Consume`)).toBeUndefined();
  const singular = cardText(card, 0, 1);
  expect(structuredCardRule(card, 0, 1, 1, singular)?.message.values).toEqual({ value0: "1" });
  const extracted = JSON.parse(readFileSync("src/ui/shared/localization/content.en.json", "utf8"));
  expect(extracted[result.id].text).toBe(result.message.template);

  const view = render(
    <RuleCatalogProvider
      catalog={{
        [result.id]: { source: result.message.template, text: "<keyword0>Blocage</keyword0> : {{value0}}" },
      }}
    >
      <CardRules card={card} level={1} power={1.5} />
    </RuleCatalogProvider>,
  );
  expect(screen.getByText("Blocage").getAttribute("data-keyword")).toBe("block");
  expect(view.container.textContent).toBe("Blocage : 12");
  view.rerender(
    <RuleCatalogProvider catalog={{ [result.id]: { source: "stale", text: "wrong" } }}>
      <CardRules card={card} level={1} power={1.5} />
    </RuleCatalogProvider>,
  );
  expect(view.container.textContent).toBe(text);
  view.unmount();
});

it("uses the same structured translation in the action card's accessible name", () => {
  const existing = run().cards.find((card) => card.definitionId === "mossguard-guard")!;
  const card = { ...existing, definitionId: "ravelland-rainward" };
  const message = structuredCardRule(
    definition(card.definitionId)!,
    card.level,
    undefined,
    1,
    "Gain 6 Block",
  )!;
  const view = render(
    <RuleCatalogProvider
      catalog={{
        [message.id]: { source: message.message.template, text: "<keyword0>Blocage</keyword0> : {{value0}}" },
      }}
    >
      <TooltipProvider>
        <ActionCard card={card} ownerName="Ravelland" onClick={() => {}} />
      </TooltipProvider>
    </RuleCatalogProvider>,
  );
  expect(screen.getByRole("button", { name: /Blocage : 6/ })).toBeTruthy();
  view.unmount();
});

it("localizes action-card announcements with the same translated rule used for presentation", () => {
  const game = run();
  const card = game.cards.find((item) => item.definitionId === "mossguard-guard")!;
  const rule = ruleMessage("Gain 6 Block");
  const catalog: MessageCatalog = {
    "content.card.mossguard-guard.name": { source: "Boulder Brace", text: "Garde de pierre" },
    "card.actionLabel": {
      source: "{{name}}, {{owner}}, {{mana}} mana, {{effect}}",
      text: "{{effect}} · {{name}} · {{owner}} · {{mana}} Mana",
    },
  };
  const view = render(
    <MessageProvider locale="fr" catalog={catalog}>
      <RuleCatalogProvider
        catalog={{
          [cardRuleVariantId(card.definitionId, rule.template)]: {
            source: rule.template,
            text: "Gagnez {{value0}} <keyword0>Blocage</keyword0>",
          },
        }}
      >
        <TooltipProvider>
          <ActionCard card={card} ownerName="Gardemousse" onClick={() => {}} />
        </TooltipProvider>
      </RuleCatalogProvider>
    </MessageProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Gagnez 6 Blocage · Garde de pierre · Gardemousse · 1 Mana" }),
  ).toBeTruthy();
  expect(card.definitionId).toBe("mossguard-guard");
  view.unmount();
});
