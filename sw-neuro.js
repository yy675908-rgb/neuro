/* 神内知识库 Service Worker —— 离线缓存，断网也能打开 */
const CACHE = "neuro-kb-v1";
/* 需要缓存的本地核心文件 */
const CORE = [
  "./neuro-kb.html",
  "./manifest-neuro.json"
];

/* 安装：把核心文件存进缓存 */
self.addEventListener("install", (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
  );
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
  const url = new URL(req.url);

  // 本站页面/资源：缓存优先，断网也能开；联网时顺便更新缓存
  if(url.origin === location.origin){
    e.respondWith(
      caches.match(req).then(cached=>{
        const fetchPromise = fetch(req).then(resp=>{
          if(resp && resp.status===200){
            const copy = resp.clone();
            caches.open(CACHE).then(c=>c.put(req, copy));
          }
          return resp;
        }).catch(()=>cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // pdf.js（cdnjs）等第三方：缓存优先，第一次联网取到后离线也能用
  if(url.hostname.indexOf("cdnjs.cloudflare.com") !== -1){
    e.respondWith(
      caches.match(req).then(cached=>{
        if(cached) return cached;
        return fetch(req).then(resp=>{
          if(resp && resp.status===200){
            const copy = resp.clone();
            caches.open(CACHE).then(c=>c.put(req, copy));
          }
          return resp;
        });
      })
    );
    return;
  }

  // 其它（各家模型 API 等）：直接走网络，不缓存
});
