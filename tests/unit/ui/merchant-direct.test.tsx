// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { createSession } from "../../../src/application/session";
import { findBoon } from "../../../src/game/content";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { createBrowserPlatform } from "../../../src/platform/browser";
import { App } from "../../../src/ui/App";
import { accept, merchantDestination } from "../../support/game";
import { screenTestEnvironment } from "../../support/ui";

screenTestEnvironment({ visible: true });

it("buys and leaves immediately while retaining a nonblocking receipt and saved outcome", async () => {
  const destination = merchantDestination();
  const initial = accept(destination, { type: "enterSupport", visit: destination.support!.id });
  if (initial.phase !== "support") throw new Error("Expected a Merchant visit");
  const offer = initial.support.stock.find((entry) => entry.price <= initial.currency)!;
  const boon = findBoon(offer.boon)!;
  localStorage.setItem("fauna.save.v1", encodeSave(initial));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: `Buy ${boon.name} for ${offer.price} Gold` }));
    await waitFor(() => expect(session.store.getState().game.phase).toBe("teamSelection"));
    const next = session.store.getState().game;
    expect(next.currency).toBe(initial.currency - offer.price);
    expect(next.boons.filter((id) => id === boon.id)).toHaveLength(1);
    expect(next.revision).toBe(initial.revision + 2);
    expect(next.support).toBeNull();
    expect(screen.queryByRole("heading", { name: "Boon received" })).toBeNull();
    expect(document.querySelector(".merchant-purchase-feedback")?.textContent).toContain(boon.name);
    expect(document.querySelector(".merchant-purchase-feedback")?.textContent).toContain(
      `${offer.price} Gold`,
    );
    expect(screen.getByRole("button", { name: "Combat" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Combat" }));
    await session.flush();
    expect(decodeSave(localStorage.getItem("fauna.save.v1")!)).toEqual(next);
  } finally {
    cleanup();
    await session.dispose();
  }
});

it("resumes an already committed purchase without buying again", async () => {
  const destination = merchantDestination();
  const shopping = accept(destination, { type: "enterSupport", visit: destination.support!.id });
  if (shopping.phase !== "support") throw new Error("Expected a Merchant visit");
  const offer = shopping.support.stock.find((entry) => entry.price <= shopping.currency)!;
  const purchased = accept(shopping, { type: "buyBoon", visit: shopping.support.id, slot: offer.slot });
  localStorage.setItem("fauna.save.v1", encodeSave(purchased));
  const session = createSession(createBrowserPlatform(localStorage), 7);
  await session.load();
  render(<App session={session} />);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(session.store.getState().game.phase).toBe("teamSelection"));
    const next = session.store.getState().game;
    expect(next.currency).toBe(purchased.currency);
    expect(next.boons).toEqual(purchased.boons);
    expect(next.revision).toBe(purchased.revision + 1);
    await session.flush();
    expect(decodeSave(localStorage.getItem("fauna.save.v1")!)).toEqual(next);
  } finally {
    cleanup();
    await session.dispose();
  }
});
