import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET_NAME = "spiral-cafe";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
]);

/**
 * POST /api/upload
 * Securely uploads an image file to the Supabase "spiral-cafe" storage bucket.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No valid image file provided." },
        { status: 400 }
      );
    }

    const blob = file as Blob;
    const mimeType = blob.type || "application/octet-stream";

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${mimeType}. Allowed formats: JPG, PNG, WebP, AVIF, GIF, SVG.`,
        },
        { status: 400 }
      );
    }

    if (blob.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds 5MB limit (${(blob.size / 1024 / 1024).toFixed(1)}MB).`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    // Generate clean, deterministic filename
    const originalName = (file as any).name || "photo.jpg";
    const extension = originalName.includes(".")
      ? originalName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
      : mimeType.split("/")[1] || "jpg";
    const sanitizedBase = originalName
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 32);

    const storagePath = `menu/${Date.now()}-${sanitizedBase || "item"}.${extension}`;

    // Upload directly using administrative Supabase client
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Supabase Storage Upload Error]:", uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // Retrieve the public URL for the newly uploaded asset
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      secureUrl: publicUrlData.publicUrl,
      publicId: storagePath,
      fileName: storagePath,
      bucket: BUCKET_NAME,
      size: blob.size,
      mimeType,
    });
  } catch (err: any) {
    console.error("[Upload Route Exception]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error during upload." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 * Deletes an image file from the Supabase "spiral-cafe" storage bucket.
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let path = url.searchParams.get("path");

    if (!path) {
      try {
        const body = await req.json();
        path = body.path;
      } catch {
        // ignore JSON parse error
      }
    }

    if (!path) {
      return NextResponse.json(
        { success: false, error: "Storage path parameter is required." },
        { status: 400 }
      );
    }

    // Strip bucket prefix if passed as full path
    const cleanPath = path.startsWith(`${BUCKET_NAME}/`)
      ? path.slice(BUCKET_NAME.length + 1)
      : path;

    const { error: deleteError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([cleanPath]);

    if (deleteError) {
      console.error("[Supabase Storage Delete Error]:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, removedPath: cleanPath });
  } catch (err: any) {
    console.error("[Delete Route Exception]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to remove image from storage." },
      { status: 500 }
    );
  }
}
