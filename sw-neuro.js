/* 神内知识库 Service Worker —— 离线缓存，断网也能打开 */
const CACHE = "neuro-kb-v5";
/* 需要缓存的本地核心文件（相对 sw 所在目录） */
const CORE = ["neuro-kb.html", "manifest-neuro.json", "icon-192-neuro.png", "icon-512-neuro.png", "icon-512-neuro-maskable.png"];

/* 安装：把核心文件逐个存进缓存（个别失败不影响整体） */
self.addEventListener("install", (e)=>{
  e.waitUntil((async ()=>{
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (path)=>{
      try{
        const url = new URL(path, self.registration.scope).href;
        const resp = await fetch(url, {cache:"no-cache"});
        if(resp && resp.status===200) await cache.put(url, resp);
      }catch(err){ /* 单个文件失败忽略，不阻断安装 */ }
    }));
    self.skipWaiting();
  })());
});

/* 激活：清掉旧版本缓存 */
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

/* 拦截请求 */
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET") return;
  let url;
  try{ url = new URL(req.url); }catch(err){ return; }

  // 本站页面/资源：缓存优先，断网也能开；联网时顺便更新缓存
  if(url.origin === location.origin){
    e.respondWith((async ()=>{
      const cached = await caches.match(req);
      const network = fetch(req).then(async (resp)=>{
        if(resp && resp.status===200){
          const cache = await caches.open(CACHE);
          cache.put(req, resp.clone());
        }
        return resp;
      }).catch(()=>cached);
      return cached || network;
    })());
    return;
  }

  // pdf.js（cdnjs）：缓存优先，第一次联网取到后离线也能用
  if(url.hostname.indexOf("cdnjs.cloudflare.com") !== -1){
    e.respondWith((async ()=>{
      const cached = await caches.match(req);
      if(cached) return cached;
      const resp = await fetch(req);
      if(resp && resp.status===200){
        const cache = await caches.open(CACHE);
        cache.put(req, resp.clone());
      }
      return resp;
    })());
    return;
  }

  // 其它（各家模型 API 等）：直接走网络，不缓存
});
