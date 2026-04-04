//Jenny Tran
const video = document.getElementById("video");
const captureCanvas = document.getElementById("captureCanvas");
const scanBtn = document.getElementById("scanBtn");
const scanFrame = document.getElementById("scanFrame");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");

let stream = null;

//This will prompt the user for camera permissions
//If granted permission, the application will start the live camera feed
//only needs to be given permission one time
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.log("Camera API not supported");
    return;
  }

  try {
    //Requests front camera access (no backcamera for now because currently webpage
    //and not mobile application)
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    //Displays the live camera feed on screen
    video.srcObject = stream;
    await video.play();
    console.log("Camera ready");
  } catch (error) {
    console.error("Could not access camera:", error);
  }
}

backBtn.addEventListener("click", () => {
  window.location.href = "DashboardPage.html";
});

//Captures image inside the scan frame after clicking button
function captureOnlyFrameAndGoNext() {
  if (!video.videoWidth || !video.videoHeight) {
    console.log("Video not ready yet");
    return;
  }

  //Cropping logic to scale
  const videoRect = video.getBoundingClientRect();
  const frameRect = scanFrame.getBoundingClientRect();

  const sourceW = video.videoWidth;
  const sourceH = video.videoHeight;
  const destW = videoRect.width;
  const destH = videoRect.height;

  const scale = Math.max(destW / sourceW, destH / sourceH);

  const renderedW = sourceW * scale;
  const renderedH = sourceH * scale;

  const offsetX = (renderedW - destW) / 2;
  const offsetY = (renderedH - destH) / 2;

  const frameXInVideo = frameRect.left - videoRect.left;
  const frameYInVideo = frameRect.top - videoRect.top;

  const cropX = (frameXInVideo + offsetX) / scale;
  const cropY = (frameYInVideo + offsetY) / scale;
  const cropWidth = frameRect.width / scale;
  const cropHeight = frameRect.height / scale;

  captureCanvas.width = Math.round(cropWidth);
  captureCanvas.height = Math.round(cropHeight);

  const ctx = captureCanvas.getContext("2d");

  ctx.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height
  );

  //Saves image temporarily for cropping
  const croppedFrameImage = captureCanvas.toDataURL("image/jpeg", 0.95);
  sessionStorage.setItem("capturedImage", croppedFrameImage);

  window.location.href = "CropPage.html";
}

function handleUploadedImage(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (event) {
    const imageDataUrl = event.target.result;
    sessionStorage.setItem("capturedImage", imageDataUrl);
    window.location.href = "CropPage.html";
  };

  reader.readAsDataURL(file);
}

scanBtn.addEventListener("click", captureOnlyFrameAndGoNext);

uploadBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  handleUploadedImage(file);
  fileInput.value = "";
});

window.addEventListener("beforeunload", () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
});

startCamera();