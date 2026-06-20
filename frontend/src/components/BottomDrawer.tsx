import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerOverlay,
} from "../components/ui/drawer";

import { useState } from "react";
import AiChat from "./AiChat";
import RaceControlFeed from "./RaceControlFeed";
import { type Race, type Result, type Driver, type LapRanking } from "../data";

interface Props {
  hidden?: boolean;
  race: Race;
  currentLap: number;
  results: Result[];
  drivers: Driver[];
  rankings: LapRanking[];
  raceControlMessages?: any[];
  currentTimeMs?: number;
  raceStartEpoch?: number;
}

export default function BottomRaceDrawer({ hidden = false, race, currentLap, results, drivers, rankings, raceControlMessages = [], currentTimeMs = 0, raceStartEpoch = 0 }: Props) {
  const [open, setOpen] = useState(false);
  if (hidden) return null;

  const tabClass =
    "h-6 w-40 text-[9px] rounded-t-xl bg-[#e10600] border border-b-0 border-[rgba(225,6,0,0.45)] text-white text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer select-none transition-[transform,box-shadow] duration-150 ease-out hover:scale-110 hover:shadow-[0_0_0_1px_#e10600,0_0_24px_rgba(225,6,0,0.35)] active:scale-95";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className={`fixed bottom-0 left-1/2 z-50 -translate-x-1/2 ${tabClass}`}>
          RACE CONTROL
        </button>
      </DrawerTrigger>

      <DrawerOverlay className="fixed inset-0 bg-black/60" />

      <DrawerContent className="fixed bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl border border-[#2a2d34] bg-[#131418] text-white focus:outline-none">
        <div className="rc-drawer-split pb-4">
          <RaceControlFeed
            messages={raceControlMessages}
            currentTimeMs={currentTimeMs}
            raceStartEpoch={raceStartEpoch}
          />
          <AiChat
            race={race}
            currentLap={currentLap}
            results={results}
            drivers={drivers}
            rankings={rankings}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
