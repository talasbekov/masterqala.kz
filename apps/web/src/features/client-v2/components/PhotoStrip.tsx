export default function PhotoStrip({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto">
      {urls.map((url, i) => (
        <img key={i} src={url} alt="" className="h-16 w-16 shrink-0 rounded-c2-md object-cover" />
      ))}
    </div>
  );
}
