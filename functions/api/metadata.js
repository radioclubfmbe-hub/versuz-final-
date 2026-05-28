export async function onRequest(context) {
  const request = context.request;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Cache-Control": "no-store"
      }
    });
  }

  try {
    const upstream = await fetch(
      "https://212.84.160.3:11609/currentsong?sid=1&_ts=" + Date.now(),
      {
        method: "GET",
        headers: {
          "Accept": "text/plain, text/html, */*"
        }
      }
    );

    const text = await upstream.text();

    return new Response(text, {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error) {
    return new Response("Metadata proxy error", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store"
      }
    });
  }
}
