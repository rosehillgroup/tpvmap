export const prerender = false;

export async function POST(context: any) {
  try {
    console.info("Upload API called");
    const form = await context.request.formData();
    const file = form.get("file") as File;
    if (!file) return new Response("No file", { status: 400 });

    console.info(`File received: ${file.name} ${file.type} ${file.size}`);
    const buf = Buffer.from(await file.arrayBuffer());

    // dynamic import ensures this only runs in the Function runtime
    const { default: sharp } = await import("sharp");
    
    // Quick self-diagnostic
    console.info('sharp versions', (sharp as any).versions);

    // simple transform to prove sharp works
    const out = await sharp(buf).rotate().resize(512).toFormat("png").toBuffer();
    return new Response(out, { headers: { "content-type": "image/png" } });
  } catch (e) {
    console.error("Upload error:", e);
    return new Response("Processing failed", { status: 500 });
  }
}