/// <reference lib="deno.ns" />

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}
