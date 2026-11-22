import { useEffect, useState } from 'react';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useWorkRepository } from './WorkProvider';

export function ManagedBusinessAvatar({ path }: { path: string | null }) {
  const repository = useWorkRepository();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (repository && path) void repository.imageUrl(path).then(value => { if (live) setUrl(value); }).catch(() => {});
    return () => { live = false; };
  }, [repository, path]);
  return <ProfileAvatar src={url} business />;
}
