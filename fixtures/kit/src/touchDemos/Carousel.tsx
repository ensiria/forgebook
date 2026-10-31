/**
 * A carousel of photos that snaps from one to the next: a finger swipes it (the browser's own scrolling, snapped), a
 * mouse uses its arrows, which show only where there is a hover; the dots follow the photo in view.
 *
 * @module
 */
import "./touchDemos.scss";

import { type ReactNode, useRef, useState } from "react";

/** The carousel's slides: invented places, each a colour. */
const SLIDES: readonly { readonly title: string; readonly hue: number }[] = [
  { title: "Dolomites at dawn", hue: 18 },
  { title: "Lagoon in the fog", hue: 200 },
  { title: "Vineyards in October", hue: 40 },
  { title: "Harbour at night", hue: 230 },
  { title: "Olive grove", hue: 100 }
];

/** The carousel's props. */
export type CarouselProps = {
  /** The carousel's name, for screen readers. */
  readonly label: string;
};

/**
 * A swiped carousel.
 *
 * @param props - the carousel's props.
 */
export const Carousel = ({ label }: CarouselProps): ReactNode => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const go = (index: number): void => {
    const track = trackRef.current;
    if (track === null) return;
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };
  return (
    <section className="touch-demo carousel" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={trackRef}
        className="carousel__track"
        onScroll={(event): void =>
          setCurrent(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))
        }
      >
        {SLIDES.map((slide, index) => (
          <figure
            key={slide.title}
            className="carousel__slide"
            aria-label={`${index + 1} of ${SLIDES.length}`}
            style={{
              background: `linear-gradient(135deg, hsl(${slide.hue} 70% 55%), hsl(${slide.hue + 40} 60% 35%))`
            }}
          >
            <figcaption>{slide.title}</figcaption>
          </figure>
        ))}
      </div>
      <button
        type="button"
        className="carousel__arrow carousel__arrow--previous"
        aria-label="Previous photo"
        disabled={current === 0}
        onClick={(): void => go(current - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="carousel__arrow carousel__arrow--next"
        aria-label="Next photo"
        disabled={current === SLIDES.length - 1}
        onClick={(): void => go(current + 1)}
      >
        ›
      </button>
      <div className="carousel__dots" aria-hidden="true">
        {SLIDES.map((slide, index) => (
          <span key={slide.title} data-current={index === current ? "" : undefined} />
        ))}
      </div>
    </section>
  );
};
