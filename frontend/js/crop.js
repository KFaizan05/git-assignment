//Jenny Tran
const capturedImage = document.getElementById("capturedImage");
const cropBox = document.getElementById("cropBox");
const imageWrap = document.getElementById("imageWrap");
const backBtn = document.getElementById("backBtn");
const doneBtn = document.getElementById("doneBtn");
const cropCanvas = document.getElementById("cropCanvas");

//Loads captured image from ScanPage
const storedImage = sessionStorage.getItem("capturedImage");

//If no image is found, redirect back to the ScanPage
if (!storedImage) {
  alert("No captured image found.");
  window.location.href = "ScanPage.html";
}

//Display image
capturedImage.src = storedImage;

// Compute the actual rendered image rect inside the <img> element. Because
// the image uses object-fit: contain, the picture can be smaller than the
// element and letterboxed — we need this rect to (a) position the default
// crop box on top of only the visible image and (b) map crop-box pixels
// back to natural-image pixels without the letterbox skewing the scale.
function getRenderedImageRect() {
  const elW = capturedImage.clientWidth;
  const elH = capturedImage.clientHeight;
  const nw = capturedImage.naturalWidth;
  const nh = capturedImage.naturalHeight;
  if (!elW || !elH || !nw || !nh) return null;

  const imgAspect = nw / nh;
  const elAspect = elW / elH;

  let renderedW, renderedH, offsetX, offsetY;
  if (imgAspect > elAspect) {
    // Image is wider than the element — letterboxed top & bottom.
    renderedW = elW;
    renderedH = elW / imgAspect;
    offsetX = 0;
    offsetY = (elH - renderedH) / 2;
  } else {
    // Image is taller/narrower — letterboxed left & right.
    renderedH = elH;
    renderedW = elH * imgAspect;
    offsetX = (elW - renderedW) / 2;
    offsetY = 0;
  }
  return { renderedW, renderedH, offsetX, offsetY };
}

// Default the crop box to cover the full visible image area.
function fitCropBoxToImage() {
  const rect = getRenderedImageRect();
  if (!rect) return;
  cropBox.style.left = `${rect.offsetX}px`;
  cropBox.style.top = `${rect.offsetY}px`;
  cropBox.style.width = `${rect.renderedW}px`;
  cropBox.style.height = `${rect.renderedH}px`;
}

capturedImage.addEventListener("load", fitCropBoxToImage);
window.addEventListener("resize", fitCropBoxToImage);
// If the image was already cached and fired load before we attached the
// listener, run once immediately too.
if (capturedImage.complete) fitCropBoxToImage();

backBtn.addEventListener("click", () => {
  window.location.href = "ScanPage.html";
});

let activeHandle = null;
let startX = 0;
let startY = 0;
let startRect = null;

function getBoxRect() {
  return {
    left: cropBox.offsetLeft,
    top: cropBox.offsetTop,
    width: cropBox.offsetWidth,
    height: cropBox.offsetHeight
  };
}

function onPointerDown(e) {
  const handle = e.target.dataset.handle;
  if (!handle) return;

  activeHandle = handle;
  startX = e.clientX;
  startY = e.clientY;
  startRect = getBoxRect();

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

//Handles resizing of the crop box when the corners are dragged
function onPointerMove(e) {
  if (!activeHandle || !startRect) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let { left, top, width, height } = startRect;

  if (activeHandle === "tl") {
    left += dx;
    top += dy;
    width -= dx;
    height -= dy;
  } else if (activeHandle === "tr") {
    top += dy;
    width += dx;
    height -= dy;
  } else if (activeHandle === "bl") {
    left += dx;
    width -= dx;
    height += dy;
  } else if (activeHandle === "br") {
    width += dx;
    height += dy;
  }

  const minSize = 80;
  const maxWidth = imageWrap.clientWidth;
  const maxHeight = imageWrap.clientHeight;

  if (width < minSize) width = minSize;
  if (height < minSize) height = minSize;

  if (left < 0) left = 0;
  if (top < 0) top = 0;

  if (left + width > maxWidth) width = maxWidth - left;
  if (top + height > maxHeight) height = maxHeight - top;

  cropBox.style.left = `${left}px`;
  cropBox.style.top = `${top}px`;
  cropBox.style.width = `${width}px`;
  cropBox.style.height = `${height}px`;
}

function onPointerUp() {
  activeHandle = null;
  startRect = null;
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
}

cropBox.addEventListener("pointerdown", onPointerDown);

//Clicking the green checkmark will have the crop image
doneBtn.addEventListener("click", () => {
  const img = capturedImage;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  if (!naturalWidth || !naturalHeight) {
    alert("Image hasn't finished loading yet.");
    return;
  }

  // Get the RENDERED image rect (not the <img> element rect) so we can
  // subtract the letterbox offsets. Without this step, an untouched crop
  // box that visually covers the whole image maps to a smaller crop in
  // natural pixel space — that's why edge text was getting cut off when
  // users uploaded a portrait photo and clicked Done without dragging.
  const rendered = getRenderedImageRect();
  if (!rendered) return;
  const { renderedW, renderedH, offsetX, offsetY } = rendered;

  const scaleX = naturalWidth / renderedW;
  const scaleY = naturalHeight / renderedH;

  const imgRect = img.getBoundingClientRect();
  const boxRect = cropBox.getBoundingClientRect();

  // Box position in element-local coords, then shift into rendered-image
  // coords by subtracting the letterbox offset. Clamp to [0, renderedW/H]
  // so a box edge that sits in the letterbox doesn't contribute a crop
  // region that falls outside the natural pixels.
  let leftInImg = (boxRect.left - imgRect.left) - offsetX;
  let topInImg = (boxRect.top - imgRect.top) - offsetY;
  let rightInImg = (boxRect.right - imgRect.left) - offsetX;
  let bottomInImg = (boxRect.bottom - imgRect.top) - offsetY;

  leftInImg = Math.max(0, Math.min(renderedW, leftInImg));
  topInImg = Math.max(0, Math.min(renderedH, topInImg));
  rightInImg = Math.max(0, Math.min(renderedW, rightInImg));
  bottomInImg = Math.max(0, Math.min(renderedH, bottomInImg));

  const cropX = leftInImg * scaleX;
  const cropY = topInImg * scaleY;
  const cropWidth = Math.max(1, (rightInImg - leftInImg) * scaleX);
  const cropHeight = Math.max(1, (bottomInImg - topInImg) * scaleY);

  cropCanvas.width = Math.round(cropWidth);
  cropCanvas.height = Math.round(cropHeight);

  const ctx = cropCanvas.getContext("2d");
  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  //Save cropped image for OCR processing and move to parsing page
  const croppedDataUrl = cropCanvas.toDataURL("image/jpeg", 0.95);
  sessionStorage.setItem("croppedImage", croppedDataUrl);
  window.location.href = "ParsingPage.html";
});