import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Image, PencilLine, Plus, Trash2 } from 'lucide-react';
import type { PortfolioRow } from '../lib/database.types';
import { Modal } from '../components/Modal';
import { WorkFrame } from '../work/WorkFrame';
import { useBusinessWork } from '../work/useBusinessWork';
import { PhotoEditor } from '../work/PhotoEditor';
import { PortfolioPhoto } from '../work/PortfolioPhoto';
import { ManagedBusinessAvatar } from '../work/ManagedBusinessAvatar';
import { workError } from '../work/validation';
export function PortfolioPage() {
  const state = useBusinessWork();
  const [editor, setEditor] = useState<PortfolioRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PortfolioRow | null>(null);
  const [enlarged, setEnlarged] = useState<{ url: string; caption: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const ready = state.data?.photos.filter((photo) => photo.media_state === 'ready') ?? [];
  async function run(operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try { await operation(); setDeleting(null); } catch (cause) { setError(workError(cause)); } finally { state.refresh(); busy.current = false; setPending(false); }
  }
  function move(id: string, direction: number) {
    const ids = ready.map((item) => item.id), index = ids.indexOf(id), target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void run(() => state.repository!.reorderPhotos(state.businessId, ids));
  }
  return <WorkFrame title="Fotos e trabalhos" state={state}>{state.data && state.repository && <>
    <section className="work-profile-photo"><ManagedBusinessAvatar path={state.data.business.avatar_path} /><div><h2>Foto principal do perfil</h2><p>Escolha uma das fotografias abaixo. Ela aparece ao lado do seu nome na busca e no perfil.</p>{state.data.business.avatar_path && <button className="text-link" type="button" disabled={pending} onClick={() => void run(() => state.repository!.setProfilePhoto(state.businessId, null))}>Remover foto principal</button>}</div></section>
    <div className="work-toolbar"><p>Fotografias dos seus trabalhos</p><button className="button button--primary" disabled={pending || state.loading} onClick={() => setEditor('new')}><Plus size={17} aria-hidden="true" />Adicionar fotografia</button></div>
    {error && !deleting && <div role="alert" className="form-error"><p>{error}</p><button type="button" className="text-link" onClick={() => { setError(null); state.refresh(); }}>Atualizar lista</button></div>}
    {state.data.photos.length === 0 ? <div className="work-empty"><Image size={28} aria-hidden="true" /><h2>Mostre o que você faz</h2><p>Envie fotografias de trabalhos realizados pelo seu negócio. Elas seguem a visibilidade do seu perfil.</p></div> : <ul className="portfolio-grid">{state.data.photos.map((photo) => <li key={photo.id}>
      {photo.media_state === 'ready' ? <PortfolioPhoto item={photo} repository={state.repository!} onOpen={(url) => setEnlarged({ url, caption: photo.caption || 'Fotografia do trabalho' })} /> : <div className="portfolio-pending"><Image size={26} aria-hidden="true" /><strong>{photo.media_state === 'pending' ? 'Envio pendente' : 'Exclusão pendente'}</strong><p>{photo.media_state === 'pending' ? 'Retome o envio ou remova esta fotografia.' : 'Tente concluir a exclusão. A fotografia não está disponível publicamente.'}</p></div>}
      <div className="portfolio-copy"><p>{photo.caption || 'Sem legenda'}</p>{photo.service_id && <span>{state.data!.services.find((service) => service.id === photo.service_id)?.name || 'Serviço indisponível'}</span>}</div>
      <div className="portfolio-actions">{photo.media_state !== 'deleting' && <button className="icon-button" aria-label={photo.media_state === 'pending' ? 'Retomar envio' : `Editar fotografia ${photo.caption || ''}`} disabled={pending || state.loading} onClick={() => setEditor(photo)}><PencilLine size={17} /></button>}
        {photo.media_state === 'ready' && <button className="button button--secondary work-set-avatar" type="button" disabled={pending || state.loading || state.data!.business.avatar_path === photo.storage_path} onClick={() => void run(() => state.repository!.setProfilePhoto(state.businessId, photo.id))}>{state.data!.business.avatar_path === photo.storage_path ? 'Foto principal' : 'Usar como foto principal'}</button>}
        {photo.media_state === 'ready' && <><button className="icon-button" aria-label={`Mover fotografia ${photo.caption || ''} para antes`} disabled={pending || state.loading || ready[0]?.id === photo.id} onClick={() => move(photo.id, -1)}><ArrowUp size={17} /></button><button className="icon-button" aria-label={`Mover fotografia ${photo.caption || ''} para depois`} disabled={pending || state.loading || ready.at(-1)?.id === photo.id} onClick={() => move(photo.id, 1)}><ArrowDown size={17} /></button></>}
        <button className="icon-button icon-button--danger" aria-label={photo.media_state === 'deleting' ? 'Concluir exclusão da fotografia' : `Excluir fotografia ${photo.caption || ''}`} disabled={pending || state.loading} onClick={() => { setError(null); setDeleting(photo); }}><Trash2 size={17} /></button>
      </div>
    </li>)}</ul>}
    {editor && <PhotoEditor key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? undefined : editor} services={state.data.services} onClose={() => setEditor(null)} onSave={async (id, file, caption, serviceId) => {
      try {
        if (editor !== 'new' && editor.media_state === 'ready') await state.repository!.savePhotoDetails(state.businessId, id, caption, serviceId);
        else if (file) await state.repository!.uploadPhoto(state.businessId, id, file, caption, serviceId);
        else { await state.repository!.savePhotoDetails(state.businessId, id, caption, serviceId); await state.repository!.finalizePhoto(state.businessId, id); }
      } finally { state.refresh(); }
    }} />}
    {deleting && <Modal title="Excluir fotografia?" locked={pending} onClose={() => { setDeleting(null); setError(null); }}><p>A fotografia será removida do portfólio e do armazenamento. Esta ação não pode ser desfeita.</p>{state.data.business.avatar_path === deleting.storage_path && <p>Ela é sua foto principal. O perfil voltará a mostrar o ícone padrão.</p>}{error && <p role="alert" className="form-error">{error} A exclusão pode permanecer pendente até uma nova tentativa.</p>}<div className="work-actions"><button className="button button--secondary" disabled={pending} onClick={() => setDeleting(null)}>Cancelar</button><button className="button button--danger" disabled={pending} onClick={() => void run(async () => { if (state.data?.business.avatar_path === deleting.storage_path) await state.repository!.setProfilePhoto(state.businessId, null); await state.repository!.deletePhoto(state.businessId, deleting.id); })}>{pending ? 'Excluindo…' : 'Confirmar exclusão'}</button></div></Modal>}
    {enlarged && <Modal title="Fotografia do trabalho" onClose={() => setEnlarged(null)}><img className="enlarged-photo" src={enlarged.url} alt={enlarged.caption} referrerPolicy="no-referrer" /><p className="field-help">{enlarged.caption}</p></Modal>}
  </>}</WorkFrame>;
}
