// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PagedItems } from "../../../src/ui/shared/navigation/pagination";
import { Button } from "../../../src/components/ui/button";
import { ArtCard } from "../../../src/ui/shared/cards/art-card";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reaches every creature after resizing and retains the first visible creature without taking outside focus", async () => {
  let width = 640;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const height = Element.prototype.matches.call(this, ".screen-stage")
      ? 720
      : Element.prototype.matches.call(this, "main")
        ? 400
        : 180;
    return { width: Element.prototype.matches.call(this, "button") ? 200 : width, height } as DOMRect;
  });
  render(
    <div className="screen-stage">
      <main>
        <PagedItems
          items={["Mossguard", "Emberback", "Prismram", "Pollenmoth", "Extra creature"]}
          pageSize={1}
          adaptive={{ columns: 5, rows: 1 }}
          className="gallery"
          label="Creatures"
        >
          {(name) => <Button key={name}>{name}</Button>}
        </PagedItems>
        <Button>Open menu</Button>
      </main>
    </div>,
  );
  expect(document.querySelectorAll(".gallery button")).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByRole("button", { name: "Pollenmoth" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
  width = 210;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(document.querySelectorAll(".gallery button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Pollenmoth" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" }));
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByRole("button", { name: "Extra creature" })).toBeTruthy();
  width = 1200;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(document.querySelectorAll(".gallery button")).toHaveLength(5);
  expect(screen.queryByRole("navigation")).toBeNull();
});

it("fits talent rows to height left after surrounding controls and responds to text growth", () => {
  let cellHeight = 120;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const count = document.querySelectorAll(".gallery > button").length;
    const height = Element.prototype.matches.call(this, ".screen-stage")
      ? 720
      : Element.prototype.matches.call(this, "main")
        ? 250 + count * cellHeight
        : Element.prototype.matches.call(this, ".gallery")
          ? count * cellHeight
          : cellHeight;
    return { width: 600, height } as DOMRect;
  });
  render(
    <div className="screen-stage">
      <main>
        <PagedItems
          items={[1, 2, 3]}
          pageSize={1}
          adaptive={{ columns: 1, rows: 3 }}
          className="gallery"
          label="Talent rows"
        >
          {(row) => <Button key={row}>Row {row}</Button>}
        </PagedItems>
      </main>
    </div>,
  );
  expect(document.querySelectorAll(".gallery > button")).toHaveLength(3);
  cellHeight = 240;
  act(() => window.dispatchEvent(new Event("resize")));
  expect(document.querySelectorAll(".gallery > button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
});

it("derives artwork identity from displayed effects and aliases, with a neutral fallback", () => {
  const view = render(
    <ArtCard aspect="action" artwork="/test.svg" aria-label="Ice" effectText="Make the enemy Frozen." />,
  );
  expect(screen.getByRole("button", { name: "Ice" }).getAttribute("data-art-keyword")).toBe("freeze");
  view.rerender(
    <ArtCard
      aspect="action"
      artwork="/test.svg"
      aria-label="Ice"
      effectText="Gain Block, then restore Health."
    />,
  );
  expect(screen.getByRole("button", { name: "Ice" }).getAttribute("data-art-keyword")).toBe("block");
  view.rerender(<ArtCard aspect="action" artwork="/test.svg" aria-label="Ice" effectText="Draw one card." />);
  expect(screen.getByRole("button", { name: "Ice" }).hasAttribute("data-art-keyword")).toBe(false);
  expect(screen.getByRole("button", { name: "Ice" }).hasAttribute("data-effect-art")).toBe(true);
});

it("does not oscillate when the next talent row has longer rules than the first", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const cells = [...document.querySelectorAll(".gallery > button")];
    const gridHeight = cells.reduce((height, cell) => height + (cell.textContent === "Short" ? 120 : 280), 0);
    const height = Element.prototype.matches.call(this, ".screen-stage")
      ? 720
      : Element.prototype.matches.call(this, "main")
        ? 250 + gridHeight
        : Element.prototype.matches.call(this, ".gallery")
          ? gridHeight
          : this.textContent === "Short"
            ? 120
            : 280;
    return { width: 600, height } as DOMRect;
  });
  render(
    <div className="screen-stage">
      <main>
        <PagedItems
          items={["Short", "Long", "Longest"]}
          pageSize={1}
          adaptive={{ columns: 1, rows: 3 }}
          className="gallery"
          label="Talent rows"
        >
          {(name) => <Button key={name}>{name}</Button>}
        </PagedItems>
      </main>
    </div>,
  );
  expect(document.querySelectorAll(".gallery > button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Short" })).toBeTruthy();
});
