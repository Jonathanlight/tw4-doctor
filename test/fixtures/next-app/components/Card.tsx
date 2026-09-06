import { cn } from '../lib/cn';

const base = 'flex items-center gap-2 rounded border p-4';

export function Card({ active }: { active: boolean }) {
  return (
    <div className={cn(base, active && 'ring bg-blue-50')}>
      <button className="px-3 py-2 hover:bg-blue-600 rounded">Save</button>
      <input className="border px-2" placeholder="Your name" />
      <span className="!flex text-sm">Label</span>
    </div>
  );
}
