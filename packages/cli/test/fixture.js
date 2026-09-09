import http from 'node:http';

export async function startFixture() {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push({ url: req.url, method: req.method });
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (url.pathname === '/missing.jpg' || url.pathname === '/missing') {
      res.writeHead(404);
      res.end('<h1>404 · 页面不存在</h1>');
      return;
    }
    if (url.pathname === '/api/error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"fixture"}');
      return;
    }
    if (url.pathname === '/healthy') {
      res.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Healthy</title></head><body style="font-family:sans-serif;padding:24px"><h1>Everything is ready.</h1><p>A healthy page without errors.</p></body></html>',
      );
      return;
    }
    if (url.pathname === '/empty') {
      res.end('<!doctype html><html><head><title>Empty fixture</title></head><body></body></html>');
      return;
    }
    if (url.pathname === '/mutating') {
      res.end(
        '<h1>POST fixture</h1><script>fetch("/mutation",{method:"POST"}).catch(()=>{})</script>',
      );
      return;
    }
    if (url.pathname === '/escaping') {
      res.end('<h1>Escaping</h1><script>throw new Error("<img src=x onerror=alert(1)>")</script>');
      return;
    }
    if (url.pathname === '/logout' || url.pathname === '/excluded') {
      res.end('<h1>This should not be crawled</h1>');
      return;
    }
    res.end(
      `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>旅途手记 · 测试网站</title><style>*{box-sizing:border-box}body{margin:0;color:#28415b;background:#f5f8fb;font-family:'PingFang SC',sans-serif}header{padding:22px 6%;background:white;border-bottom:1px solid #dde5ed;display:flex;justify-content:space-between}main{max-width:880px;margin:40px auto;padding:0 24px}h1{font-size:38px;margin:12px 0}p{color:#6b8094;line-height:1.8}.cover{width:100%;height:220px;background:#e4ebf3;display:block;border:1px dashed #b4c4d5}.trip-schedule{width:700px;padding:25px;background:white;border:1px solid #dae3ed;border-radius:10px;margin:25px 0}a{color:#2459db;margin-right:18px}.tag{font-size:12px;letter-spacing:2px;color:#6084aa}</style></head><body><header><b>旅途手记</b><span>ShipLens 故障测试网站</span></header><main><div class="tag">KYOTO / THREE DAYS</div><h1>在京都，慢下来。</h1><p>这个网站故意包含错误，用于验证检查器。<br>它不是用户项目，也不是线上服务。</p><img class="cover" src="/missing.jpg" alt="京都封面（故意缺失）"><div class="trip-schedule"><b>DAY 01</b><p>清水寺 → 二年坂 → 鸭川 · 这张固定宽度卡片会在手机视口溢出。</p></div><nav><a href="/healthy">正常页面</a><a href="/missing">失效链接</a><a href="/empty">空白页</a><a href="/logout">退出</a><a href="/excluded">排除页</a><a href="https://example.com/">站外</a></nav></main><script>fetch('/api/error');setTimeout(()=>{throw new Error('Fixture: itinerary data is undefined')},80)</script></body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    hits,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
