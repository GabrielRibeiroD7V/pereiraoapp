import { useEffect, useState } from 'react';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useWorkRepository } from './WorkProvider';
import { cacheImageUrl, getCachedImageUrl } from './imageUrlCache';

export function ManagedBusinessAvatar({ path }: { path: string | null }) {
  const repository = useWorkRepository();
  const [url, setUrl] = useState<string | null>(() => getCachedImageUrl(path));
  useEffect(() => {
    let live = true;
    const cached=getCachedImageUrl(path);setUrl(cached);
    if (repository && path) void repository.imageUrl(path).then(value => { if (live) setUrl(cacheImageUrl(path,value)); }).catch(() => {});
    return () => { live = false; };
  }, [repository, path]);
  return <ProfileAvatar src={url} business />;
}
