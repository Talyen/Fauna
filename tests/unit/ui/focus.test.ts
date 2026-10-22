// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { moveFocus } from "../../../src/ui/shared/input";
import { returnFocus } from "../../../src/ui/shared/focus";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it("returns to the visible screen when an opener and retained hand are unavailable", () => {
  document.body.innerHTML =
    '<div hidden inert><div class="hand"><button class="action-card">Old card</button></div></div><main><button>Current choice</button></main>';
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  returnFocus(null);
  expect(document.activeElement?.textContent).toBe("Current choice");
});
it("navigation ignores inert controls even when their geometry is still present", () => {
  document.body.innerHTML =
    "<div inert><button>Inactive</button></div><main><button>Current choice</button></main>";
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  moveFocus("down");
  expect(document.activeElement?.textContent).toBe("Current choice");
});
it("navigation stays in the top modal and leaves native Tab order intact", () => {
  document.body.innerHTML =
    '<main><button>Background</button></main><div role="dialog" data-state="open"><button>Parent</button></div><div role="dialog" data-state="open"><button>Child</button></div>';
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  moveFocus("down");
  expect(document.activeElement?.textContent).toBe("Child");
  expect(document.querySelector("[tabindex]")).toBeNull();
});

it("ignores outgoing modal controls while their exit pixels are retained", () => {
  document.body.innerHTML =
    '<main><button>Current choice</button></main><div role="dialog" data-state="closed"><button>Outgoing action</button></div>';
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  (document.querySelector('[data-state="closed"] button') as HTMLElement).focus();
  moveFocus("down");
  expect(document.activeElement?.textContent).toBe("Current choice");
});
