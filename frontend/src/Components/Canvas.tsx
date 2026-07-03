import { useRef, useEffect, useState } from "react";

function Canvas({ ws, isDrawer }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("black");
  const [brushSize, setBrushSize] = useState(4);
  const [strokes, setStrokes] = useState<any[]>([]);

  function getContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function startDrawing(e) {
    if (!isDrawer) return;
    setIsDrawing(true);
    const ctx = getContext();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  }

  function draw(e) {
    if (!isDrawing || !isDrawer) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    const ctx = getContext();
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();

    const strokeData = { x, y, color, brushSize };
    setStrokes((prev) => [...prev, strokeData]);

    ws.send(
      JSON.stringify({
        type: "draw_data",
        stroke: strokeData,
      }),
    );
  }

  function undoLast() {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    newStrokes.forEach((s) => {
      ctx.lineWidth = s.brushSize;
      ctx.strokeStyle = s.color;
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    });

    ws.send(JSON.stringify({ type: "draw_undo" }));
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ws.send(JSON.stringify({ type: "clear_canvas" }));
  }

  useEffect(() => {
    function handleMessage(event) {
      const data = JSON.parse(event.data);

      if (data.type === "draw_data") {
        const ctx = getContext();
        if (!ctx) return;
        ctx.lineWidth = data.stroke.brushSize;
        ctx.lineCap = "round";
        ctx.strokeStyle = data.stroke.color;
        ctx.lineTo(data.stroke.x, data.stroke.y);
        ctx.stroke();
      }

      if (data.type === "clear_canvas") {
        const ctx = getContext();
        const canvas = canvasRef.current;
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  return (
    <div className="bg-white rounded-lg shadow-md p-3">
      <canvas
        ref={canvasRef}
        width={700}
        height={500}
        className="border-2 border-gray-300 rounded bg-white cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      {isDrawer && (
        <div className="flex items-center gap-3 mt-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 cursor-pointer"
          />
          <input
            type="range"
            min="2"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={clearCanvas}
          >
            Clear
          </button>
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
            onClick={undoLast}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export default Canvas;
