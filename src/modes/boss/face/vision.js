// On-device face analysis with MediaPipe (WASM, CPU). Nothing leaves the phone.
const BASE = import.meta.env.BASE_URL
let landmarker = null
let segmenter = null
let loading = null

// selfie_multiclass_256x256 classes: 0 background, 1 hair, 2 body-skin, 3 face-skin, 4 clothes, 5 others.
const HAIR = 1
const FACE_SKIN = 3

export function loadVision() {
  if (landmarker && segmenter) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    const { FaceLandmarker, ImageSegmenter } = await import('@mediapipe/tasks-vision')
    const fileset = {
      wasmLoaderPath: `${BASE}mediapipe/vision_wasm_internal.js`,
      wasmBinaryPath: `${BASE}mediapipe/vision_wasm_internal.wasm`,
    }
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${BASE}models/face_landmarker.task`, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 6,
      minFaceDetectionConfidence: 0.4,
    })
    segmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${BASE}models/selfie_multiclass_256x256.tflite`, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
  })()
  loading.catch(() => (loading = null))
  return loading
}

/**
 * @returns {{ faces: { lm: {x,y}[], box: {x,y,w,h} }[], head: { data: Float32Array, w, h } | null }}
 *   faces sorted largest-first; `head` = per-pixel probability of hair or face skin.
 */
export async function analyzeFace(canvas) {
  await loadVision()
  const W = canvas.width
  const H = canvas.height
  const res = landmarker.detect(canvas)
  const faces = (res.faceLandmarks || []).map((f) => {
    const lm = f.map((p) => ({ x: p.x * W, y: p.y * H }))
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < 468; i++) {
      const p = lm[i]
      if (p.x < x0) x0 = p.x
      if (p.y < y0) y0 = p.y
      if (p.x > x1) x1 = p.x
      if (p.y > y1) y1 = p.y
    }
    return { lm, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } }
  })
  faces.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
  if (!faces.length) return { faces, head: null }

  let head = null
  const seg = segmenter.segment(canvas)
  try {
    const masks = seg.confidenceMasks || []
    const hair = masks[HAIR]?.getAsFloat32Array()
    const skin = masks[FACE_SKIN]?.getAsFloat32Array()
    if (hair && skin) {
      const data = new Float32Array(hair.length)
      for (let i = 0; i < data.length; i++) data[i] = Math.min(1, hair[i] + skin[i])
      head = { data, w: masks[HAIR].width, h: masks[HAIR].height }
    }
  } finally {
    seg.close?.()
  }
  return { faces, head }
}
