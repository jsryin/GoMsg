interface Env {
  DISCORD_APPLICATION_ID: string;
  TARGET_API_URL: string;
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  GATEWAY_MANAGER: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response('Hello World!');
  },
};
