import { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";

export default function CtrlScrollZoom() {
  const map = useMap();
  const [showHint, setShowHint] = useState(false);
  const hintTimeout = useRef(null);
  const ctrlHeld = useRef(false);

  useEffect(() => {
    map.scrollWheelZoom.disable();
    const container = map.getContainer();

    function handleKeyDown(e) {
      if (e.key === "Control" || e.key === "Meta") {
        ctrlHeld.current = true;
        map.scrollWheelZoom.enable();
      }
    }

    function handleKeyUp(e) {
      if (e.key === "Control" || e.key === "Meta") {
        ctrlHeld.current = false;
        map.scrollWheelZoom.disable();
      }
    }

    function handleBlur() {
      // don't leave zoom stuck enabled if focus is lost mid-gesture
      ctrlHeld.current = false;
      map.scrollWheelZoom.disable();
    }

    function handleWheel(e) {
      if (!e.ctrlKey && !e.metaKey) {
        setShowHint(true);
        clearTimeout(hintTimeout.current);
        hintTimeout.current = setTimeout(() => setShowHint(false), 1200);
        return;
      }
      setShowHint(false);
      // Safety net: some browsers report ctrlKey on wheel events for a
      // trackpad pinch gesture without a real Control keydown ever firing.
      // The very first tick of such a gesture can be missed (the handler is
      // enabled mid-dispatch), but every subsequent tick zooms normally.
      if (!ctrlHeld.current) {
        map.scrollWheelZoom.enable();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    container.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(hintTimeout.current);
    };
  }, [map]);

  if (!showHint) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
      <div className="rounded bg-graphite-900/90 px-3 py-1.5 text-xs text-mist-100 shadow-lg">
        Ctrl + molette pour zoomer
      </div>
    </div>
  );
}
