/**
 * What a first screen does not show: a component that loads the first time it is drawn.
 *
 * @remarks
 * `React.lazy` is not used: once its Suspense boundary has shown a fallback, React holds the content back for 300 ms
 * so a page does not flash, which would put that delay on every first visit to a page or a tab. Here the content
 * replaces its fallback the moment its code arrives, and a component already loaded draws at once.
 *
 * @module
 */
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

/**
 * A component that takes the props of the one it loads.
 *
 * @param load - imports the component's module and gives the component.
 * @param fallbackOf - what is drawn while it loads, from its props; nothing by default.
 */
export const deferred = <TProps extends object>(
  load: () => Promise<ComponentType<TProps>>,
  fallbackOf: (props: TProps) => ReactNode = (): ReactNode => null
): ComponentType<TProps> => {
  let known: { readonly component: ComponentType<TProps> } | undefined;
  return (props: TProps): ReactNode => {
    const [loaded, setLoaded] = useState(known);
    useEffect(() => {
      if (loaded !== undefined) return;
      void load().then((component) => {
        known = { component };
        setLoaded(known);
      });
    }, [loaded]);
    if (loaded === undefined) return fallbackOf(props);
    const Component = loaded.component;
    return <Component {...props} />;
  };
};
