declare module "next/types.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/server.js" {
  export type NextRequest = import("next/server").NextRequest;
  export type NextResponse = import("next/server").NextResponse;
}
