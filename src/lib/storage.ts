/**
 * Native Supabase Storage Engine for Spiral Cafe.
 * Bucket: "product-images"
 * Features:
 * - Automatic client-side image resizing and compression targeting 250KB - 300KB
 * - Real-time upload percentage tracking
 * - High-speed WebP encoding with retina-quality dimensions (max 1400px)
 * - Server-side 5MB hard boundary enforcement
 */

export interface StorageUploadResult {
  success: boolean;
  url?: string;
  secureUrl?: string;
  publicId?: string;
  fileName?: string;
  width?: number;
  height?: number;
  format?: string;
  originalSize?: number;
  compressedSize?: number;
  error?: string;
}

export interface CompressOptions {
  targetMinKb?: number;
  targetMaxKb?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Automatically resize and compress any image (even 10MB+ phone camera shots)
 * down to ~250KB - 300KB before uploading to Supabase Storage.
 */
export async function compressImageToTargetSize(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<File> {
  const {
    targetMinKb = 200,
    targetMaxKb = 300,
    maxWidth = 1200,
    maxHeight = 1200,
  } = options;

  const targetMaxBytes = targetMaxKb * 1024;
  const targetMinBytes = targetMinKb * 1024;

  // Don't process non-browser environments or SVGs
  if (typeof window === "undefined" || (file as any).type === "image/svg+xml") {
    if (file instanceof File) return file;
    return new File([file], "image.svg", { type: "image/svg+xml" });
  }

  // Extract original filename & base name
  const originalName = (file as File).name || "dish-photo.jpg";
  const baseName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, "-");

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Unable to decode image file."));
      el.src = objectUrl;
    });

    let { naturalWidth: width, naturalHeight: height } = img;

    // Constrain max dimensions to 1200px while preserving aspect ratio perfectly
    if (width > maxWidth || height > maxHeight) {
      if (width > height) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      } else {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    let canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    let ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      throw new Error("HTML Canvas 2D context unavailable for image compression.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer WebP for superior compression & edge delivery, fallback to JPEG
    const outputFormat = "image/webp";

    const getCanvasBlob = (c: HTMLCanvasElement, quality: number): Promise<Blob | null> => {
      return new Promise((res) => {
        c.toBlob((b) => res(b), outputFormat, quality);
      });
    };

    // Stepwise compression search to hit the exact 200KB - 300KB window
    let quality = 0.85;
    let candidateBlob = await getCanvasBlob(canvas, quality);

    // Fine-grained qualities ladder
    const qualities = [0.80, 0.72, 0.64, 0.55, 0.46, 0.38];
    for (const q of qualities) {
      if (!candidateBlob || candidateBlob.size <= targetMaxBytes) {
        break;
      }
      quality = q;
      candidateBlob = await getCanvasBlob(canvas, quality);
    }

    // If still over 300KB after lowest quality (rare for very complex photos), scale down dimensions
    if (candidateBlob && candidateBlob.size > targetMaxBytes) {
      const scaleFactors = [0.85, 0.70, 0.55];
      for (const scale of scaleFactors) {
        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);
        const smallerCanvas = document.createElement("canvas");
        smallerCanvas.width = scaledWidth;
        smallerCanvas.height = scaledHeight;
        const sCtx = smallerCanvas.getContext("2d");
        if (sCtx) {
          sCtx.imageSmoothingEnabled = true;
          sCtx.imageSmoothingQuality = "high";
          sCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
          candidateBlob = await getCanvasBlob(smallerCanvas, 0.75);
          if (candidateBlob && candidateBlob.size <= targetMaxBytes) {
            break;
          }
        }
      }
    }

    if (!candidateBlob) {
      throw new Error("Failed to encode compressed image blob.");
    }

    const finalFile = new File([candidateBlob], `${baseName}.webp`, {
      type: outputFormat,
      lastModified: Date.now(),
    });

    console.log(
      `[Image Size Reducer] Successfully compressed from ${(file.size / 1024).toFixed(0)}KB to ${(
        finalFile.size / 1024
      ).toFixed(0)}KB (${finalFile.size <= targetMaxBytes ? "✓ Under 300KB target" : "Processed"}, WebP)`
    );

    return finalFile;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Upload an image to Supabase Storage bucket "spiral-cafe".
 * Automatically optimizes and compresses large images to ~250KB - 300KB before dispatching.
 */
export async function uploadToStorage(
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<StorageUploadResult> {
  try {
    if (onProgress) onProgress(10);

    // 1. Auto-compress and resize image to ~250-300KB
    let uploadFile: File;
    const originalSize = file.size;

    try {
      uploadFile = await compressImageToTargetSize(file, {
        targetMinKb: 200,
        targetMaxKb: 300,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      if (onProgress) onProgress(25);
    } catch (compressionErr) {
      console.warn("Client-side compression fallback to original file:", compressionErr);
      uploadFile =
        file instanceof File
          ? file
          : new File([file], "image.jpg", { type: (file as Blob).type || "image/jpeg" });
    }

    // Enforce 5MB upload limit
    if (uploadFile.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: "Image exceeds 5MB limit. Please select an image under 5MB or retry optimization.",
      };
    }

    // 2. Transmit optimized payload to server endpoint
    const formData = new FormData();
    formData.append("file", uploadFile);

    return new Promise<StorageUploadResult>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload", true);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Map upload progress from 25% to 95%
            const uploadPct = Math.round((event.loaded / event.total) * 70);
            onProgress(25 + uploadPct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
              if (onProgress) onProgress(100);
              resolve({
                success: true,
                url: data.url,
                secureUrl: data.secureUrl || data.url,
                publicId: data.publicId,
                fileName: data.fileName,
                originalSize,
                compressedSize: uploadFile.size,
              });
            } else {
              resolve({
                success: false,
                error: data.error || "Failed to upload image to Supabase Storage.",
              });
            }
          } catch {
            resolve({
              success: false,
              error: "Invalid JSON response from upload endpoint.",
            });
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            resolve({
              success: false,
              error: errData.error || `Upload failed with status ${xhr.status}`,
            });
          } catch {
            resolve({
              success: false,
              error: `Upload failed with HTTP status ${xhr.status}`,
            });
          }
        }
      };

      xhr.onerror = () => {
        resolve({
          success: false,
          error: "Network error during image upload to Supabase Storage.",
        });
      };

      xhr.send(formData);
    });
  } catch (err: any) {
    console.error("Supabase Storage upload exception:", err);
    return {
      success: false,
      error: err.message || "Exception during storage upload.",
    };
  }
}

/**
 * Delete an image file from Supabase Storage by its relative path or publicId
 */
export async function deleteFromStorage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    return {
      success: data.success === true,
      error: data.error,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to communicate with storage deletion API.",
    };
  }
}

// Convenient alias for drop-in replacements
export const uploadImageToStorage = uploadToStorage;
