import { motionValue } from "./motion-values";
import { Component, createRef, type ReactNode } from "react";
import { visualClone } from "./visual-clone";
type Props = { token: string; battle?: boolean; children: ReactNode };
/** Outgoing pixels have no React effects or input ownership. New screens activate immediately. */
export class SurfaceTransition extends Component<Props> {
  private root = createRef<HTMLDivElement>();
  private animations: Animation[] = [];
  private outgoing: HTMLElement | null = null;
  private reduced?: MediaQueryList;
  private finish = () => {
    this.animations.forEach((a) => a.cancel());
    this.animations = [];
    this.outgoing?.remove();
    this.outgoing = null;
  };
  private motionChange = () => {
    if (this.reduced?.matches) this.finish();
  };
  componentDidMount() {
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reduced?.addEventListener?.("change", this.motionChange);
    window.addEventListener("pointerdown", this.finish, true);
    window.addEventListener("keydown", this.finish, true);
  }
  getSnapshotBeforeUpdate(previous: Props) {
    const source = this.root.current?.firstElementChild as HTMLElement | null;
    if (previous.token === this.props.token || this.reduced?.matches || !source?.animate) return null;
    const clone = visualClone(source),
      rect = source.getBoundingClientRect();
    Object.assign(clone.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      zIndex: "30",
    });
    return clone;
  }
  componentDidUpdate(_: Props, __: unknown, snapshot: HTMLElement | null) {
    if (!snapshot) return;
    this.finish();
    this.outgoing = snapshot;
    document.body.append(snapshot);
    const duration = motionValue(this.props.battle ? "--motion-battle" : "--motion-fast");
    const incoming = this.root.current?.firstElementChild as HTMLElement;
    const exit = snapshot.animate([{ opacity: 1 }, { opacity: 0 }], { duration });
    const enter = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration });
    this.animations = [exit, enter];
    exit.onfinish = () => {
      if (this.outgoing === snapshot) this.finish();
    };
  }
  componentWillUnmount() {
    this.finish();
    this.reduced?.removeEventListener?.("change", this.motionChange);
    window.removeEventListener("pointerdown", this.finish, true);
    window.removeEventListener("keydown", this.finish, true);
  }
  render() {
    return (
      <div className="surface-transition" ref={this.root}>
        {this.props.children}
      </div>
    );
  }
}
