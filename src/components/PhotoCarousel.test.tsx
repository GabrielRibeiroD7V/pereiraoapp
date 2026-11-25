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
it('permite teclado e indicadores e não mostra controles falsos para uma única foto',()=>{
 const items=[{id:'a',content:<img src="data:," alt="A"/>},{id:'b',content:<img src="data:," alt="B"/>},{id:'c',content:<img src="data:," alt="C"/>}];
 const view=render(<PhotoCarousel items={items}/>);
 fireEvent.keyDown(screen.getByLabelText('Fotos; deslize para os lados ou use as setas do teclado'),{key:'ArrowRight'});
 expect(screen.getByRole('button',{name:'Ir para foto 2 de 3'})).toHaveAttribute('aria-current','true');
 fireEvent.click(screen.getByRole('button',{name:'Ir para foto 3 de 3'}));expect(screen.getByRole('button',{name:'Próxima foto'})).toBeDisabled();
 view.rerender(<PhotoCarousel items={[items[0]!]}/>);expect(screen.queryByRole('button',{name:'Próxima foto'})).not.toBeInTheDocument();
});
it('deslizar o carrossel não aciona o link da capa',()=>{
 const original=window.PointerEvent;window.PointerEvent=MouseEvent as typeof PointerEvent;
 try{let clicked=false;render(<PhotoCarousel items={[{id:'a',content:<a href="/post" onClick={e=>{e.preventDefault();clicked=true;}}>Capa</a>},{id:'b',content:'B'}]}/>);
 const track=screen.getByLabelText('Fotos; deslize para os lados ou use as setas do teclado');
 fireEvent.pointerDown(track,{clientX:250,clientY:100});fireEvent.pointerMove(track,{clientX:80,clientY:105});fireEvent.click(screen.getByText('Capa'));expect(clicked).toBe(false);
 }finally{window.PointerEvent=original;}
});
