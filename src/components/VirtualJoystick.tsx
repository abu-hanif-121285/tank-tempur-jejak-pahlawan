import { useRef, useState } from "react";

type Props = {
  onMove: (x: number, y: number) => void;
};

export default function VirtualJoystick({ onMove }: Props) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width * 0.32;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / radius, -dy / radius);
  };

  const reset = () => {
    pointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className="joystick-base pointer-events-auto relative select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        pointerRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerRef.current === e.pointerId) {
          e.preventDefault();
          update(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        if (pointerRef.current === e.pointerId) reset();
      }}
      onPointerCancel={(e) => {
        if (pointerRef.current === e.pointerId) reset();
      }}
    >
      <div className="joystick-ring" />
      <span className="joystick-arrow joystick-arrow-top">▲</span>
      <span className="joystick-arrow joystick-arrow-bottom">▼</span>
      <span className="joystick-arrow joystick-arrow-left">◀</span>
      <span className="joystick-arrow joystick-arrow-right">▶</span>
      <div
        className="joystick-knob absolute left-1/2 top-1/2"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      >
        <div className="joystick-knob-inner" />
      </div>
      <span className="joystick-label">MOVE</span>
    </div>
  );
}
