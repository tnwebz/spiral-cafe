/**
 * Cloudinary Secure Upload Engine for Spiral Cafe
 * Cloud Name: ddq8m4oec
 * Upload Preset: spiral-case
 */

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  secureUrl?: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
}

export const CLOUDINARY_CONFIG = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "ddq8m4oec",
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "spiral-case",
  apiKey: process.env.CLOUDINARY_API_KEY || "367319443599512",
  apiSecret: process.env.CLOUDINARY_API_SECRET || "S3HZywWrDgFg6VhLMjWBBUMhixc",
};

/**
 * Upload an image file or base64 data to Cloudinary via unsigned preset
 */
export async function uploadToCloudinary(
  file: File | Blob | string,
  onProgress?: (percent: number) => void
): Promise<CloudinaryUploadResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
    formData.append("folder", "spiral-cafe/menu");

    if (onProgress) onProgress(30);

    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (onProgress) onProgress(80);

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error?.message || "Failed to upload image to Cloudinary.",
      };
    }

    if (onProgress) onProgress(100);

    return {
      success: true,
      url: data.secure_url,
      secureUrl: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
    };
  } catch (err: any) {
    console.error("Cloudinary upload exception:", err);
    return {
      success: false,
      error: err.message || "Network exception during image upload.",
    };
  }
}

export const uploadImageToCloudinary = uploadToCloudinary;
