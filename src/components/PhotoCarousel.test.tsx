import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PhotoCarousel } from "./PhotoCarousel";
it("apresenta todas as fotos ordenadas, posições reais e setas acessíveis", () => {
  render(
    <PhotoCarousel
      items={[
        { id: "a", content: <img src="data:," alt="Primeira" /> },
        { id: "b", content: <img src="data:," alt="Segunda" /> },
      ]}
    />,
  );
  const carousel = screen.getByRole("region", {
    name: "Fotografias da publicação",
  });
  expect(
    within(carousel)
      .getAllByRole("img")
      .map((i) => i.getAttribute("alt")),
  ).toEqual(["Primeira", "Segunda"]);
  expect(screen.getByRole("button", { name: "Foto anterior" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Próxima foto" }));
  expect(carousel).toHaveTextContent("2 / 2");
  expect(screen.getByRole("button", { name: "Próxima foto" })).toBeDisabled();
});
