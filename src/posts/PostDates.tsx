export function postDateLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const day = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const when = day(date) === day(now) ? 'hoje' : day(date) === day(yesterday) ? 'ontem' : date.toLocaleDateString('pt-BR');
  return `${when} às ${date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
}
export function PostDates({createdAt,publishedAt,absolute=false}:{createdAt?:string|null;publishedAt?:string|null;absolute?:boolean}) {
  return <div className="post-dates">{([['Criado',createdAt],['Publicado',publishedAt]] as const).map(([label,iso]) => iso && postDateLabel(iso) ? <time key={label} dateTime={iso} title={new Date(iso).toLocaleString('pt-BR')}>{label} {absolute?new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):postDateLabel(iso)}</time> : null)}</div>;
}
