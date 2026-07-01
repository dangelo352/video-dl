import { NextRequest } from "next/server";

export function getPublicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${host}`;
  }

  return request.nextUrl.origin;
}
