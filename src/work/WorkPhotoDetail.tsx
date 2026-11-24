import type { ReactNode } from "react";
import { Modal } from "../components/Modal";
export function WorkPhotoDetail({
  image,
  caption,
  service,
  serviceAssociated = false,
  onClose,
  onEdit,
}: {
  image: ReactNode;
  caption: string | null;
  service?: string | null;
  serviceAssociated?: boolean;
  onClose: () => void;
  onEdit?: () => void;
}) {
  return (
    <Modal title="Foto de trabalho" onClose={onClose}>
      <div className="work-photo-detail">
        {image}
        <p className="content-kind">Foto de trabalho · Portfólio</p>
        <h3>Legenda</h3>
        <p className="post-full-description">
          {caption?.trim() ? caption : "Esta foto não tem legenda."}
        </p>
        <h3>Serviço associado</h3>
        <p>
          {service ??
            (serviceAssociated
              ? "Serviço não disponível nesta visualização."
              : "Nenhum serviço associado.")}
        </p>
        {onEdit && (
          <button
            type="button"
            className="button button--secondary"
            onClick={onEdit}
          >
            Editar legenda e serviço
          </button>
        )}
      </div>
    </Modal>
  );
}
