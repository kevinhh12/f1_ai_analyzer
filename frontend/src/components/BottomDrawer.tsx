import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerOverlay,
} from "../components/ui/drawer";

import { useState } from "react";

export default function BottomRaceDrawer() {
  const [open, setOpen] = useState(false);

  const tabClass =
    "h-6 w-40 rounded-t-xl bg-[#e10600] border border-b-0 border-[rgba(225,6,0,0.45)] text-white text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer select-none transition-[transform,box-shadow] duration-150 ease-out hover:scale-110 hover:shadow-[0_0_0_1px_#e10600,0_0_24px_rgba(225,6,0,0.35)] active:scale-95";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className={`fixed bottom-0 left-1/2 z-50 -translate-x-1/2 ${tabClass}`}>
          <img className="w-5 h-5 " src="./src/assets/icons/hamburger.png" alt="" />
        </button>
      </DrawerTrigger>

      <DrawerOverlay className="fixed inset-0 bg-black/60" />

      <DrawerContent className="fixed bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl border border-[#2a2d34] bg-[#131418] text-white">

        <button
          onClick={() => setOpen(false)}
          className={`absolute -top-[23px] left-1/2 -translate-x-1/2 ${tabClass}`}
        >
          <img className="w-5 h-5" src="./src/assets/icons/hamburger.png" alt="" />
        </button>

        <div className="p-6 pt-8">
          <h2 className="text-base font-bold tracking-widest uppercase text-white mb-1">Race Controls</h2>
          <p className="text-sm text-[#9ea2ac]">Replay controls, lap selector, driver filters...</p>

        </div>
      </DrawerContent>
    </Drawer>
  );
}