//Jenny Tran
//Get cropped image from previous step (cropping screen)
const croppedImage = sessionStorage.getItem("croppedImage");

const stepCapture = document.getElementById("stepCapture");
const stepRead = document.getElementById("stepRead");
const stepSafety = document.getElementById("stepSafety");

//If no image, redirect back
if (!croppedImage) {
  alert("No cropped image found.");
  window.location.href = "CropPage.html";
}

function setStepState(stepEl, state, text) {
  stepEl.classList.remove("completed", "active", "pending");

  if (state === "completed") {
    stepEl.classList.add("completed");
    stepEl.innerHTML = `
      <div class="step-icon check">✓</div>
      <div class="step-text">${text}</div>
    `;
  }

  if (state === "active") {
    stepEl.classList.add("active");
    stepEl.innerHTML = `
      <div class="step-icon spinner"></div>
      <div class="step-text">${text}</div>
    `;
  }

  if (state === "pending") {
    stepEl.classList.add("pending");
    stepEl.innerHTML = `
      <div class="step-icon dot"></div>
      <div class="step-text">${text}</div>
    `;
  }
}

//Preprocess image to improve OCR accuracy
//Converts image to grayscale and binary for better text extraction
function preprocessImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const value = gray > 150 ? 255 : 0;

        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };

    img.src = dataUrl;
  });
}

async function runOCRFlow() {
  try {
    //Shows the UI step updates
    setStepState(stepCapture, "Completed", "Image captured");
    setStepState(stepRead, "Active", "Reading ingredients...");
    setStepState(stepSafety, "Pending", "Analyzing safety");

    const processedImage = await preprocessImage(croppedImage);

    //Running OCR engine using Tesseract.js
    const worker = await Tesseract.createWorker("eng", 1);

    const result = await worker.recognize(processedImage);
    const text = result.data.text?.trim() || "No text detected.";

    //Save OCR output for results page
    sessionStorage.setItem("ocrText", text);

    setStepState(stepRead, "Completed", "Ingredients extracted");
    setStepState(stepSafety, "Active", "Analyzing safety");

    //Fake short delay so user sees the state change
    await new Promise((resolve) => setTimeout(resolve, 900));

    setStepState(stepSafety, "completed", "Safety analysis complete");

    await worker.terminate();

    //Move to results page after processing
    window.location.href = "ResultsPage.html";
  } catch (error) {
    console.error(error);
    setStepState(stepRead, "Completed", "Image captured");
    setStepState(stepSafety, "Pending", "OCR failed");
    alert("OCR failed. Please try again.");
  }
}

runOCRFlow();