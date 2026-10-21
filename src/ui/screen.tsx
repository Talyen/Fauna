import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from "react";
import { ArrowLeft, Menu, Layers } from "lucide-react";
import { Button } from "../components/ui/button";

export const HeaderNavigation = createContext<{ back: () => void; openMenu: () => void; deck?: () => void }>({
  back: () => {},
  openMenu: () => {},
});

export function ScreenHeading({
  children,
  back,
  openMenu,
  id,
}: {
  children: ReactNode;
  back?: () => void;
  openMenu?: () => void;
  id?: string;
}) {
  const navigation = useContext(HeaderNavigation);
  return (
    <div className="screen-heading">
      <div className="screen-heading-actions">
        <Button
          variant="ghost"
          size="icon"
          className="compact-icon-control"
          aria-label="Back"
          onClick={back ?? navigation.back}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        {navigation.deck ? (
          <Button
            variant="ghost"
            size="icon"
            className="compact-icon-control"
            aria-label="Deck"
            onClick={navigation.deck}
          >
            <Layers aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <h1 id={id}>{children}</h1>
      <Button
        variant="ghost"
        size="icon"
        className="compact-icon-control"
        aria-label="Open menu"
        onClick={openMenu ?? navigation.openMenu}
      >
        <Menu aria-hidden="true" />
      </Button>
    </div>
  );
}

/** The stage owns available space; the main owns the bounded content composition. */
export function Screen(props: ComponentPropsWithRef<"main">) {
  return (
    <div className="screen-stage">
      <main {...props} />
    </div>
  );
}
