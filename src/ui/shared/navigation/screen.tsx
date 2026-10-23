import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from "react";
import { ArrowLeft, Menu, Layers } from "lucide-react";
import { Button } from "../../../components/ui/button";
export const HeaderNavigation = createContext<{ back: () => void; openMenu: () => void; deck?: () => void }>({
  back: () => {},
  openMenu: () => {},
});

export function ScreenHeading({
  children,
  back,
  openMenu,
  id,
  trailing,
}: {
  children: ReactNode;
  back?: (() => void) | false;
  openMenu?: () => void;
  id?: string;
  trailing?: ReactNode;
}) {
  const navigation = useContext(HeaderNavigation);
  return (
    <div className="screen-heading">
      <div className="screen-heading-actions">
        {back !== false ? (
          <Button
            variant="ghost"
            size="icon"
            className="compact-icon-control"
            aria-label="Back"
            onClick={back ?? navigation.back}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        ) : null}
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
      <div className="screen-heading-actions screen-heading-trailing">
        {trailing}
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
