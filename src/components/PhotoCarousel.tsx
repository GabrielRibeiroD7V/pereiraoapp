import { useRef, useState } from "react";
import type { ReactNode } from "react";
export function PhotoCarousel({
  items,
  label = "Fotografias da publicação",
}: {
  items: { id: string; content: ReactNode }[];
  label?: string;
}) {
  const track = useRef<HTMLDivElement>(null),
    [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, items.length - 1));
  function move(next: number) {
    setActive(next);
    track.current?.scrollTo?.({
      left: next * track.current.clientWidth,
      behavior: "smooth",
    });
  }
  if (!items.length) return <p>Esta publicação ainda não tem fotos.</p>;
  return (
    <section
      className="photo-carousel"
      aria-label={label}
      aria-roledescription="carrossel"
    >
      <div
        className="photo-carousel__track"
        ref={track}
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.clientWidth)
            setActive(
              Math.min(
                items.length - 1,
                Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
              ),
            );
        }}
      >
        {items.map((item, i) => (
          <figure
            className="photo-carousel__slide"
            key={item.id}
            aria-label={`Foto ${i + 1} de ${items.length}`}
          >
            {item.content}
            <figcaption>
              Foto {i + 1} de {items.length}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="photo-carousel__controls">
        <button
          type="button"
          aria-label="Foto anterior"
          disabled={index === 0}
          onClick={() => move(index - 1)}
        >
          ←
        </button>
        <span aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          aria-label="Próxima foto"
          disabled={index === items.length - 1}
          onClick={() => move(index + 1)}
        >
          →
        </button>
      </div>
    </section>
  );
}
