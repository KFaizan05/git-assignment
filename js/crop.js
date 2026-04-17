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

// Default the crop box to cover the full visible image area. Because the
// image is rendered with object-fit: contain, the picture is often smaller
// than its container — so we compute the image's rendered rect relative to
// the wrap and position the crop box on top of that instead of just 100%
// of the wrap (which would include the letterbox margins).
function fitCropBoxToImage() {
  if (!capturedImage.naturalWidth || !capturedImage.naturalHeight) return;

  const wrapW = imageWrap.clientWidth;
  const wrapH = imageWrap.clientHeight;
  if (wrapW === 0 || wrapH === 0) return;

  const imgAspect = capturedImage.naturalWidth / capturedImage.naturalHeight;
  const wrapAspect = wrapW / wrapH;

  let renderedW, renderedH, offsetX, offsetY;
  if (imgAspect > wrapAspect) {
    // Image is wider than the wrap — letterboxed top & bottom.
    renderedW = wrapW;
    renderedH = wrapW / imgAspect;
    offsetX = 0;
    offsetY = (wrapH - renderedH) / 2;
  } else {
    // Image is taller/narrower — letterboxed left & right.
    renderedH = wrapH;
    renderedW = wrapH * imgAspect;
    offsetX = (wrapW - renderedW) / 2;
    offsetY = 0;
  }

  cropBox.style.left = `${offsetX}px`;
  cropBox.style.top = `${offsetY}px`;
  cropBox.style.width = `${renderedW}px`;
  cropBox.style.height = `${renderedH}px`;
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

  const wrapRect = imageWrap.getBoundingClientRect();
  const boxRect = cropBox.getBoundingClientRect();

  const displayWidth = img.clientWidth;
  const displayHeight = img.clientHeight;

  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;

  const imgRect = img.getBoundingClientRect();

  const cropX = Math.max(0, boxRect.left - imgRect.left) * scaleX;
  const cropY = Math.max(0, boxRect.top - imgRect.top) * scaleY;
  const cropWidth = Math.min(boxRect.width, imgRect.right - boxRect.left) * scaleX;
  const cropHeight = Math.min(boxRect.height, imgRect.bottom - boxRect.top) * scaleY;

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