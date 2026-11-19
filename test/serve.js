// node test/serve.js [port] [--seed] — フォーム（/form/）と管理サイト（/admin/?as=メール）をこのPCで動かす
// google.script.run と フォームの送信先を、偽スプレッドシートの上の Code.gs につなぐ
var http = require('http'), fs = require('fs'), path = require('path'), E = require('./env.js');
var port = Number(process.argv[2] || 8820), root = path.join(__dirname, '..');
var t = E.make();
if (process.argv.indexOf('--seed') >= 0) require('./seed.js')(t);

var SHIM = '<script>window.google={script:{run:(function mk(ok,ng){return new Proxy({},{get:function(_,fn){'
  + 'if(fn==="withSuccessHandler")return function(f){return mk(f,ng);};if(fn==="withFailureHandler")return function(f){return mk(ok,f);};'
  + 'return function(){var a=[].slice.call(arguments);fetch("/rpc/"+fn+location.search,{method:"POST",body:JSON.stringify(a)}).then(function(r){return r.json();}).then(function(j){if(j.error){ng&&ng(new Error(j.error));}else{ok&&ok(j.result);}});};}});})()}};</script>';

http.createServer(function (req, res) {
  var u = new URL(req.url, 'http://x');
  var body = ''; req.on('data', function (c) { body += c; });
  req.on('end', function () {
    try {
      if (u.pathname === '/api' && req.method === 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); var r = t.post(JSON.parse(body)); return res.end(JSON.stringify(r)); }
      if (u.pathname.indexOf('/rpc/') === 0) {
        var fn = u.pathname.slice(5), who = u.searchParams.get('as') || 'hirayama@k-create.co.jp', ctx = t.as(who), out;
        try { out = { result: JSON.parse(JSON.stringify(ctx[fn].apply(null, JSON.parse(body || '[]')))) }; } catch (e) { out = { error: e.message }; }
        res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(out));
      }
      if (u.pathname === '/admin/' || u.pathname === '/admin') {
        var h = fs.readFileSync(path.join(root, 'gas-admin/index.html'), 'utf8').replace('<script src="https://cdnjs', SHIM + '<script src="https://cdnjs');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(h);
      }
      if (u.pathname === '/form/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end("window.API_URL='/api';"); }
      if (u.pathname === '/form/' || u.pathname === '/form/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, 'docs/index.html'))); }
      res.writeHead(404); res.end('not found');
    } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
  });
}).listen(port, '127.0.0.1', function () { console.log('http://localhost:' + port + '/form/  http://localhost:' + port + '/admin/?as=suda@k-create.co.jp'); });
