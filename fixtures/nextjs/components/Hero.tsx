/**
 * The home page's hero: the harbour's picture, imported as Next.js imports images, with its caption.
 *
 * @module
 */
import Image from "next/image";
import type { ReactNode } from "react";

import styles from "./Hero.module.css";
import harbour from "./harbour.png";

/** The hero's props. */
export type HeroProps = {
  /** The caption over the picture. */
  readonly caption?: string;
};

/**
 * The hero.
 *
 * @param props - its caption.
 */
export const Hero = ({ caption = "High tide at 06:40" }: HeroProps): ReactNode => (
  <figure className={styles.hero}>
    <Image
      src={harbour}
      alt="The harbour at dawn"
      placeholder="blur"
      sizes="(max-width: 768px) 100vw, 640px"
      priority
    />
    <figcaption className={styles.caption}>{caption}</figcaption>
  </figure>
);
