// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageControls, PagedItems } from "../../../src/ui/shared/navigation/pagination";
import { Button } from "../../../src/components/ui/button";

afterEach(cleanup);
const entries = ["Mossguard", "Emberback", "Prismram", "Pollenmoth", "Extra creature"];
function Gallery({ size = 2, items = entries }: { size?: number; items?: string[] }) {
  return (
    <PagedItems items={items} pageSize={size} className="gallery" label="Creature pages">
      {(name) => <Button key={name}>{name}</Button>}
    </PagedItems>
  );
}
it("reaches every item, preserves order, and keeps focus on an enabled page control", async () => {
  render(<Gallery />);
  const user = userEvent.setup();
  expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
  const seen: string[] = [];
  for (let page = 0; page < 3; page++) {
    seen.push(...Array.from(document.querySelectorAll(".gallery button"), (el) => el.textContent!));
    if (page < 2) await user.click(screen.getByRole("button", { name: "Next page" }));
  }
  expect(seen).toEqual(entries);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Previous page" }));
  expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Previous page" }));
  expect(screen.getByRole("button", { name: "Prismram" })).toBeTruthy();
});
it("preserves the current item on resize, clamps shortened lists and restores removed focus", async () => {
  const view = render(<Gallery />);
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  screen.getByRole("button", { name: "Pollenmoth" }).focus();
  view.rerender(<Gallery size={1} />);
  expect(screen.getByRole("button", { name: "Prismram" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Prismram" }));
  view.rerender(<Gallery size={1} items={["Mossguard"]} />);
  expect(screen.getByRole("button", { name: "Mossguard" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mossguard" }));
  expect(screen.queryByRole("navigation")).toBeNull();
  view.rerender(<Gallery items={[]} />);
  expect(screen.queryByRole("button")).toBeNull();
});

it("does not reclaim focus after the player leaves content that later disappears on resize", async () => {
  const view = render(
    <>
      <Gallery />
      <Button>Open menu</Button>
    </>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Emberback" }));
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  view.rerender(
    <>
      <Gallery size={1} />
      <Button>Open menu</Button>
    </>,
  );
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" }));
});

it("does not reclaim focus when a previously used page control becomes disabled after resize", async () => {
  const view = render(
    <>
      <Gallery size={1} />
      <Button>Open menu</Button>
    </>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  view.rerender(
    <>
      <Gallery size={3} />
      <Button>Open menu</Button>
    </>,
  );
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" }));
});

it("supports count-free pagination with accessible controls and boundary focus", async () => {
  const change = vi.fn();
  const view = render(<PageControls page={0} pages={2} change={change} showCount={false} />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("navigation").textContent).toBe("");
  const next = screen.getByRole("button", { name: "Next page" });
  await userEvent.click(next);
  expect(change).toHaveBeenCalledWith(1);
  view.rerender(<PageControls page={1} pages={2} change={change} showCount={false} />);
  expect((next as HTMLButtonElement).disabled).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Previous page" }));
});
