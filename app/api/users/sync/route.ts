export async function POST(req: Request) {
  const apiServerUrl = process.env.API_SERVER_URL;

  if (apiServerUrl) {
    const url = `${apiServerUrl.replace(/\/$/, "")}/api/users/sync`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        authorization: req.headers.get("authorization") || "",
      },
      body: await req.text(),
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  }

  return Response.json({ ok: true, message: "sync endpoint available" }, { status: 200 });
}
