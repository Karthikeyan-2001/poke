// MediaPipe Face Mesh landmark indices (468 mesh + 10 iris points).
// "R"/"L" are the subject's right/left — R appears on the image's left side.

export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

// Eyelids, outer corner → inner corner, paired index-by-index (upper[i] ↔ lower[i]).
export const EYE_R_UPPER = [246, 161, 160, 159, 158, 157, 173]
export const EYE_R_LOWER = [7, 163, 144, 145, 153, 154, 155]
export const EYE_L_UPPER = [466, 388, 387, 386, 385, 384, 398]
export const EYE_L_LOWER = [249, 390, 373, 374, 380, 381, 382]
export const EYE_R_CORNERS = [33, 133] // outer, inner
export const EYE_L_CORNERS = [263, 362]
export const EYE_R_RING = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
export const EYE_L_RING = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]
export const IRIS_R = 468
export const IRIS_L = 473

// Brows, outer → inner (upper edge then lower edge).
export const BROW_R = [70, 63, 105, 66, 107, 46, 53, 52, 65, 55]
export const BROW_L = [300, 293, 334, 296, 336, 276, 283, 282, 295, 285]

// Lips.
export const MOUTH_R = 61 // corner, image-left
export const MOUTH_L = 291 // corner, image-right
export const LIP_UPPER_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
export const LIP_LOWER_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
export const LIP_INNER_RING = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
export const LIP_UPPER_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
export const LIP_LOWER_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
export const LOWER_LIP = new Set([95, 88, 178, 87, 14, 317, 402, 318, 324, 146, 91, 181, 84, 17, 314, 405, 321, 375])
export const UPPER_LIP = new Set([191, 80, 81, 82, 13, 312, 311, 310, 415, 185, 40, 39, 37, 0, 267, 269, 270, 409])

export const NOSE_TIP = 1
export const NOSE_BOTTOM = 2
export const CHIN = 152
export const FOREHEAD = 151
export const TOP = 10
export const CHEEK_R = 205
export const CHEEK_L = 425
export const SIDE_R = 234
export const SIDE_L = 454
