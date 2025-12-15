import worker from "../idphoto-worker.js";

export async function onRequest(context) {
  // context.request: 原始请求
  // context.env: Pages 的环境变量 + Bindings（D1/R2等）
  return worker.fetch(context.request, context.env);
}
