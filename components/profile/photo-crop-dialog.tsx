"use client"

/**
 * Photo tips and a simple crop step, shown after a member picks a picture and
 * before it is uploaded. No library: one <canvas>.
 *
 * Props
 *   file       the picture the member chose (null when nothing is pending)
 *   open       whether the dialog is showing
 *   busy       true while the caller is uploading (buttons are disabled)
 *   error      a message from the caller to show (for example a failed upload)
 *   onCancel   the member backed out; nothing should be uploaded
 *   onConfirm  called with a JPEG Blob - either the framed part (4:5, the shape
 *              profile cards use) or the whole picture, scaled down so uploads
 *              are quick on a phone. The caller uploads it.
 *   onCloseAutoFocus  optional: lets the caller say where keyboard focus goes
 *              when the step closes (call event.preventDefault() and focus
 *              something). Otherwise it returns to whatever opened the step.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const FRAME_W = 320
const FRAME_H = 400 // 4:5, the same shape as the photo on a profile card
const MAX_OUTPUT_W = 1200
const MAX_WHOLE_SIDE = 1600
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const STEP = 0.1

type Source = ImageBitmap | HTMLImageElement

/** What the file picker offers and what is accepted before the crop step. */
export const PHOTO_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
/**
 * Phone photos are often larger than the server allows; they are made smaller
 * here before upload, so only unreasonably big files are refused up front.
 */
export const MAX_PHOTO_FILE_BYTES = 25 * 1024 * 1024

export const PHOTO_TIPS = [
  "Use a recent photo in good light, with your face easy to see.",
  "Make your main photo one of just you.",
  "Check the background: no house numbers, licence plates or letters with your address.",
]

async function loadSource(file: File): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respects the "which way up" note that phone cameras store.
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      // fall through to the <img> route
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("unreadable"))
    }
    img.src = url
  })
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Where the picture sits inside a frame of the given size. */
function placement(source: Source, frameW: number, frameH: number, zoom: number, offsetX: number, offsetY: number) {
  const scale = Math.max(frameW / source.width, frameH / source.height) * zoom
  const width = source.width * scale
  const height = source.height * scale
  const x = (frameW - width) / 2 + offsetX * ((width - frameW) / 2)
  const y = (frameH - height) / 2 + offsetY * ((height - frameH) / 2)
  return { x, y, width, height, scale }
}

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no image"))), "image/jpeg", 0.88)
  )

export function PhotoCropDialog({
  file,
  open,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
  onCloseAutoFocus,
}: {
  file: File | null
  open: boolean
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (blob: Blob) => void
  onCloseAutoFocus?: (event: Event) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setSource(null)
    setLoadFailed(false)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    if (!file || !open) return
    loadSource(file)
      .then((loaded) => !cancelled && setSource(loaded))
      .catch(() => !cancelled && setLoadFailed(true))
    return () => {
      cancelled = true
    }
  }, [file, open])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, FRAME_W, FRAME_H)
    const p = placement(source, FRAME_W, FRAME_H, zoom, offset.x, offset.y)
    ctx.drawImage(source, p.x, p.y, p.width, p.height)
  }, [source, zoom, offset])

  const move = useCallback((dx: number, dy: number) => {
    setOffset((prev) => ({ x: clamp(prev.x + dx, -1, 1), y: clamp(prev.y + dy, -1, 1) }))
  }, [])
  const changeZoom = (next: number) => setZoom(clamp(Math.round(next * 100) / 100, MIN_ZOOM, MAX_ZOOM))

  const useFramed = async () => {
    if (!source) return
    const cover = Math.max(FRAME_W / source.width, FRAME_H / source.height) * zoom
    // Never invent detail: output is no larger than the part of the original shown.
    const outW = Math.round(Math.min(MAX_OUTPUT_W, FRAME_W / cover))
    const outH = Math.round(outW * (FRAME_H / FRAME_W))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(outW, 200)
    canvas.height = Math.max(outH, 250)
    const p = placement(source, canvas.width, canvas.height, zoom, offset.x, offset.y)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, p.x, p.y, p.width, p.height)
    onConfirm(await toJpeg(canvas))
  }

  const useWhole = async () => {
    if (!source) return
    const scale = Math.min(1, MAX_WHOLE_SIDE / Math.max(source.width, source.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(source.width * scale)
    canvas.height = Math.round(source.height * scale)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    onConfirm(await toJpeg(canvas))
  }

  const canPanX = source ? placement(source, FRAME_W, FRAME_H, zoom, 0, 0).width > FRAME_W + 0.5 : false
  const canPanY = source ? placement(source, FRAME_W, FRAME_H, zoom, 0, 0).height > FRAME_H + 0.5 : false

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Position your photo</DialogTitle>
          <DialogDescription>
            The frame shows how your photo will look on your profile card. Move it and zoom until you are happy.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1 pl-5 text-muted-foreground" aria-label="Photo tips">
          {PHOTO_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        {loadFailed ? (
          <p role="alert" className="font-medium text-destructive">
            We could not open that picture. Please choose a JPG or PNG photo.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <canvas
              ref={canvasRef}
              width={FRAME_W}
              height={FRAME_H}
              role="img"
              aria-label="Preview of your photo inside the frame"
              data-testid="crop-canvas"
              data-zoom={zoom}
              data-offset-x={offset.x.toFixed(2)}
              data-offset-y={offset.y.toFixed(2)}
              className="w-full max-w-[320px] touch-none rounded-lg border-2 border-border bg-black"
              style={{ aspectRatio: `${FRAME_W} / ${FRAME_H}`, cursor: source ? "grab" : "progress" }}
              onPointerDown={(e) => {
                if (!source) return
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
              }}
              onPointerMove={(e) => {
                if (!drag.current || !source) return
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = FRAME_W / rect.width
                const p = placement(source, FRAME_W, FRAME_H, zoom, 0, 0)
                const rangeX = (p.width - FRAME_W) / 2
                const rangeY = (p.height - FRAME_H) / 2
                setOffset({
                  x: rangeX > 0 ? clamp(drag.current.ox + ((e.clientX - drag.current.x) * ratio) / rangeX, -1, 1) : 0,
                  y: rangeY > 0 ? clamp(drag.current.oy + ((e.clientY - drag.current.y) * ratio) / rangeY, -1, 1) : 0,
                })
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            />

            <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Move the photo">
              <Button type="button" variant="outline" size="sm" disabled={!canPanX || busy} onClick={() => move(STEP, 0)}>
                <ArrowLeft aria-hidden="true" /> Left
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!canPanX || busy} onClick={() => move(-STEP, 0)}>
                Right <ArrowRight aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!canPanY || busy} onClick={() => move(0, STEP)}>
                <ArrowUp aria-hidden="true" /> Up
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!canPanY || busy} onClick={() => move(0, -STEP)}>
                <ArrowDown aria-hidden="true" /> Down
              </Button>
            </div>

            <div className="flex w-full max-w-[320px] items-center gap-2">
              <Button type="button" variant="outline" size="icon" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM || busy} onClick={() => changeZoom(zoom - 0.25)}>
                <Minus aria-hidden="true" />
              </Button>
              <label htmlFor="crop-zoom" className="sr-only">
                Zoom
              </label>
              <input
                id="crop-zoom"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                disabled={!source || busy}
                onChange={(e) => changeZoom(Number(e.target.value))}
                aria-valuetext={`${Math.round(zoom * 100)} percent`}
                className="h-11 flex-1 accent-[var(--primary)]"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM || busy} onClick={() => changeZoom(zoom + 0.25)}>
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={useWhole} disabled={!source || busy}>
            Use the whole picture
          </Button>
          <Button type="button" onClick={useFramed} disabled={!source || busy}>
            {busy ? "Uploading..." : "Use photo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
