import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { ManagedBusinessAvatar } from './ManagedBusinessAvatar';
import { ProfilePhotoFraming } from './ProfilePhotoFraming';
import { cropProfileImage, initialProfileCrop } from './profileCrop';
import { optimizeImage } from './images';
import type { WorkRepository } from './types';

export function ProfilePhotoPicker({ businessId, path, repository, onSaved, actionLabel = 'Adicionar fotografia' }: {
  businessId: string; path: string | null; repository: WorkRepository; onSaved: (path: string | null) => void; actionLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ id: string; file: Blob } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preparationNote, setPreparationNote] = useState('');
  const [crop, setCrop] = useState({ ...initialProfileCrop });
  const [cropReady, setCropReady] = useState(false);
  const [cropFrozen, setCropFrozen] = useState(false);
  const croppedFile = useRef<Blob | null>(null);
  const generation = useRef(0), busy = useRef(false);
  const expectedPath = useRef(path);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!selection) { setPreview(null); return; }
    const url = URL.createObjectURL(selection.file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selection]);
  function choose() {
    if (busy.current || processing) return;
    // Chamada síncrona no gesto do usuário: preserva ativação para Safari/iOS.
    if (input.current) { input.current.value = ''; input.current.click(); }
  }
  function cancel() {
    if (busy.current) return;
    croppedFile.current = null; setCropReady(false); setCropFrozen(false);
    generation.current++; setOpen(false); setSelection(null); setProcessing(false); setError(''); setPreparationNote('');
  }
  async function prepare(file?: File) {
    if (!file) return; // Cancelamento do seletor não muda foto ou estado persistido.
    const token = ++generation.current;
    setCrop({ ...initialProfileCrop }); setCropReady(false); setCropFrozen(false); croppedFile.current = null;
    expectedPath.current = path;
    setOpen(true); setProcessing(true); setSelection(null); setError(''); setPreparationNote('');
    try {
      const optimized = await optimizeImage(file, reason => {
        if (generation.current !== token) return;
        setPreparationNote(reason === 'native-format' ? 'O navegador gerou outro formato. Usando conversão WebP compatível neste aparelho.'
          : reason === 'native-null' ? 'O navegador não gerou a imagem. Usando conversão WebP compatível neste aparelho.'
          : 'A exportação do navegador falhou. Usando conversão WebP compatível neste aparelho.');
      });
      if (generation.current === token) setSelection({ id: crypto.randomUUID(), file: optimized });
    } catch (cause) {
      if (generation.current === token) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar esta imagem.');
    } finally { if (generation.current === token) setProcessing(false); }
  }
  async function save() {
    if (!selection || !cropReady || processing || busy.current) return;
    const token = generation.current;
    busy.current = true; setPending(true); setCropFrozen(true); setError('');
    let uploading = false;
    try {
      const file = croppedFile.current ?? await cropProfileImage(selection.file, crop);
      if (generation.current !== token) return;
      croppedFile.current = file; uploading = true;
      const next = await repository.uploadProfilePhoto(businessId, selection.id, file, expectedPath.current);
      if (generation.current !== token) return;
      onSaved(next); setOpen(false); setSelection(null);
    } catch (cause) {
      if (generation.current !== token) return;
      if (!uploading) { setCropFrozen(false); setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o enquadramento. Sua foto anterior foi mantida.'); return; }
      const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : '';
      setError(code === '40001' ? 'A foto foi alterada em outra sessão. Cancele e recarregue antes de tentar novamente.'
        : ['PGRST202','42P01','SETUP_REQUIRED'].includes(String(code)) ? 'A foto principal aguarda a ativação do armazenamento. Nenhuma foto foi alterada.'
        : 'Não foi possível confirmar o envio. Tente novamente para verificar o resultado, sem duplicar a fotografia.');
    } finally { busy.current = false; setPending(false); }
  }
  const picker = <input ref={input} type="file" hidden aria-label="Selecionar foto principal" accept="image/jpeg,image/png,image/webp" onChange={event => void prepare(event.target.files?.[0])} />;
  return <>
    {!open && picker}
    <button type="button" className="profile-photo-trigger" aria-label="Alterar foto principal" disabled={pending || processing} onClick={choose}>
      <ManagedBusinessAvatar path={path} />
    </button>
    <button type="button" className="button button--secondary" disabled={pending || processing} onClick={choose}>{actionLabel}</button>
    {open && <Modal title="Confirmar foto principal" locked={pending} onClose={cancel}>
      {picker}<div aria-busy={pending || processing}><p>Esta é a foto do seu perfil. Ela não será adicionada aos trabalhos ou às publicações.</p>
      {processing && <p role="status">Preparando imagem…</p>}
      {preview && <ProfilePhotoFraming key={selection?.id} src={preview} value={crop} onChange={setCrop} onReady={setCropReady} disabled={pending || cropFrozen} />}
      {cropFrozen && !pending && error && <p className="field-help">A nova tentativa enviará o mesmo enquadramento. Para ajustar de novo, cancele e selecione a foto novamente.</p>}
      {preparationNote && <p role="status" className="field-help">{preparationNote}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <p className="field-help">A foto será visível publicamente somente quando seu perfil estiver publicado. JPEG, PNG ou WebP, até 10 MB antes da otimização.</p>
      <div className="work-actions">{error && !pending && !processing && <button type="button" className="button button--secondary" onClick={choose}>Escolher outra foto</button>}<button type="button" className="button button--secondary" disabled={pending} onClick={cancel}>Cancelar</button>
        <button type="button" className="button button--primary" disabled={pending || processing || !selection || !cropReady} onClick={() => void save()}>{pending ? 'Preparando e enviando…' : 'Confirmar e enviar foto'}</button></div></div>
    </Modal>}
  </>;
}
