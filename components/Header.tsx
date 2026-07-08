interface HeaderProps {
  count: number;
  onOpenShop: () => void;
  onOpenSupport: () => void;
}

export function Header({ count, onOpenShop, onOpenSupport }: HeaderProps) {
  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/90 px-5 py-2.5 shadow-lg shadow-black/5 backdrop-blur">
        <span className="text-lg font-extrabold tracking-tight text-[#2A2A2E]">
          Стена
        </span>
        <span className="rounded-full bg-[#F1F0F5] px-3 py-1 text-xs font-semibold text-[#6B6B72]">
          сообщения {count}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenShop}
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
        title="Магазин декораций"
      >
        🎨
      </button>

      <button
        type="button"
        onClick={onOpenSupport}
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-2.5 text-sm shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
        title="Поддержать проект"
      >
        💛
      </button>
    </div>
  );
}
