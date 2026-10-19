const STANDARD_CHORES=[{"id":"standard-1","title":"Clean the kitchen","category":"Kitchen","amount":10,"description":""},{"id":"standard-2","title":"Load the dishwasher","category":"Kitchen","amount":5,"description":""},{"id":"standard-3","title":"Unload the dishwasher","category":"Kitchen","amount":5,"description":""},{"id":"standard-4","title":"Wash dishes by hand","category":"Kitchen","amount":7,"description":""},{"id":"standard-5","title":"Wipe kitchen surfaces","category":"Kitchen","amount":5,"description":""},{"id":"standard-6","title":"Clean the fridge","category":"Kitchen","amount":15,"description":""},{"id":"standard-7","title":"Take out kitchen trash","category":"Kitchen","amount":5,"description":""},{"id":"standard-8","title":"Vacuum the house","category":"Cleaning","amount":12,"description":""},{"id":"standard-9","title":"Mop the floors","category":"Cleaning","amount":12,"description":""},{"id":"standard-10","title":"Clean the bathroom","category":"Cleaning","amount":20,"description":""},{"id":"standard-11","title":"Clean the toilet","category":"Cleaning","amount":10,"description":""},{"id":"standard-12","title":"Clean windows","category":"Cleaning","amount":20,"description":""},{"id":"standard-13","title":"Tidy the living room","category":"Cleaning","amount":8,"description":""},{"id":"standard-14","title":"Start a laundry load","category":"Laundry","amount":5,"description":""},{"id":"standard-15","title":"Hang up laundry","category":"Laundry","amount":8,"description":""},{"id":"standard-16","title":"Fold laundry","category":"Laundry","amount":10,"description":""},{"id":"standard-17","title":"Change bed sheets","category":"Laundry","amount":10,"description":""},{"id":"standard-18","title":"Take out the trash","category":"Household","amount":5,"description":""},{"id":"standard-19","title":"Make the bed","category":"Household","amount":3,"description":""},{"id":"standard-20","title":"Tidy the bedroom","category":"Household","amount":10,"description":""},{"id":"standard-21","title":"Water indoor plants","category":"Household","amount":5,"description":""},{"id":"standard-22","title":"Clean outdoor furniture","category":"Garden & Outdoor","amount":12,"description":""},{"id":"standard-23","title":"Prepare breakfast","category":"Food & Shopping","amount":8,"description":""},{"id":"standard-24","title":"Cook dinner","category":"Food & Shopping","amount":20,"description":""},{"id":"standard-25","title":"Set the table","category":"Food & Shopping","amount":5,"description":""},{"id":"standard-26","title":"Put away groceries","category":"Food & Shopping","amount":8,"description":""}];
const json=(v,s=200,headers={})=>new Response(JSON.stringify(v),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const fail=(message,status=400)=>json({error:message},status);
const uuid=()=>crypto.randomUUID();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const pinOk=s=>/^\d{6}$/.test(s||'');
async function hashPin(pin,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
const now=()=>Date.now();
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const userView=m=>({id:m.id,name:m.name,role:m.role,color:m.color,active:!!m.active});
async function getUser(req,db){const cookie=req.headers.get('cookie')||'';const token=/(?:^|;\s*)fch_session=([a-f0-9]{64})/.exec(cookie)?.[1];if(!token)return null;const h=await digest(token);const m=await db.prepare('SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires>? AND m.active=1').bind(h,now()).first();return m||null;}
async function issue(db,id){const bytes=crypto.getRandomValues(new Uint8Array(32));const token=hex(bytes);await db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await digest(token),id,now()+30*86400000).run();return `fch_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;}
async function poolInfo(db){const q=await db.prepare("SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount WHEN type='payout' THEN amount WHEN type='correction_pool' THEN amount ELSE 0 END),0) AS pool FROM ledger").first();const earned=await db.prepare("SELECT COALESCE(SUM(CASE WHEN member_id IS NOT NULL THEN amount ELSE 0 END),0) AS owed FROM ledger").first();const reserved=await db.prepare("SELECT COALESCE(SUM(amount),0) AS reserved FROM chores WHERE published=1 AND status IN ('open','submitted','overdue')").first();return {pool:q.pool,owed:earned.owed,reserved:reserved.reserved,free:q.pool-earned.owed-reserved.reserved};}
async function handle(req,env){const db=env.DB;const url=new URL(req.url),path=url.pathname;let body={};if(req.method==='POST'||req.method==='PATCH'){try{body=await req.json();}catch{return fail('Ungültige Eingabe');}}
const count=(await db.prepare('SELECT COUNT(*) n FROM members').first()).n;
if(path==='/api/bootstrap'&&req.method==='GET')return json({initialized:count>0});
if(path==='/api/setup'&&req.method==='POST'){
 if(count)return fail('Familie bereits eingerichtet',403);if(!pinOk(body.pin)||!body.name?.trim()||body.name.trim().length>60)return fail('Name und 6-stellige PIN nötig');
 const id=uuid(),salt=uuid(),hash=await hashPin(body.pin,salt);await db.prepare('INSERT INTO members(id,name,salt,pin_hash,role,color,created) VALUES(?,?,?,?,?,?,?)').bind(id,body.name.trim(),salt,hash,'host','#1d6f63',now()).run();
 await db.prepare("INSERT INTO config(key,val) VALUES('signup_code',?)").bind(String(Math.floor(10000000+Math.random()*90000000))).run();return json({ok:true},200,{'set-cookie':await issue(db,id)});
}
if(path==='/api/login'&&req.method==='POST'){
 const m=await db.prepare('SELECT * FROM members WHERE name=? COLLATE NOCASE AND active=1').bind(String(body.name||'').trim()).first();if(!m||!pinOk(body.pin)||await hashPin(body.pin,m.salt)!==m.pin_hash)return fail('Name oder PIN falsch',401);
 return json({user:userView(m)},200,{'set-cookie':await issue(db,m.id)});
}
if(path==='/api/signup'&&req.method==='POST'){
 if(!count)return fail('Host muss zuerst einrichten');if(!pinOk(body.pin)||!body.name?.trim()||body.name.trim().length>60)return fail('Name und 6-stellige PIN nötig');
 const c=await db.prepare("SELECT val FROM config WHERE key='signup_code'").first();if(!c||String(body.code)!==c.val)return fail('Familiencode falsch',403);
 const id=uuid(),salt=uuid();try{await db.prepare('INSERT INTO members(id,name,salt,pin_hash,role,color,created) VALUES(?,?,?,?,?,?,?)').bind(id,body.name.trim(),salt,await hashPin(body.pin,salt),'member',['#4a5fa5','#8c3f6b','#8a5a2b','#2f7d32'][Math.floor(Math.random()*4)],now()).run();}catch{return fail('Name bereits vergeben');}
 return json({ok:true},200,{'set-cookie':await issue(db,id)});
}
if(path==='/api/logout'&&req.method==='POST'){const cookie=req.headers.get('cookie')||'';const t=/(?:^|;\s*)fch_session=([a-f0-9]{64})/.exec(cookie)?.[1];if(t)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(t)).run();return json({ok:true},200,{'set-cookie':'fch_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});}
const user=await getUser(req,db);if(!user)return fail('Bitte anmelden',401);const host=user.role==='host';
if(path==='/api/state'&&req.method==='GET'){
 const [ms,cs,ls,pi]=await Promise.all([db.prepare('SELECT id,name,role,color,active FROM members').all(),db.prepare('SELECT * FROM chores ORDER BY due ASC').all(),db.prepare('SELECT * FROM ledger ORDER BY created DESC LIMIT 500').all(),poolInfo(db)]);
 const code=host?await db.prepare("SELECT val FROM config WHERE key='signup_code'").first():null;
 const templatesRow=host?await db.prepare("SELECT val FROM config WHERE key='chore_templates'").first():null;
 let templates=STANDARD_CHORES;if(templatesRow){try{const saved=JSON.parse(templatesRow.val);templates=[...STANDARD_CHORES.filter(x=>!saved.some(t=>t.title.toLowerCase()===x.title.toLowerCase())),...saved]}catch{templates=STANDARD_CHORES}}
 return json({user:userView(user),members:ms.results,chores:cs.results.map(c=>({...c,amount:c.amount/100})),ledger:ls.results.map(t=>({...t,amount:t.amount/100})),pool:Object.fromEntries(Object.entries(pi).map(([k,v])=>[k,v/100])),signupCode:code?.val||null,templates});
}
if(path==='/api/pin'&&req.method==='POST'){
 if(!pinOk(body.pin))return fail('Eine sechsstellige PIN verwenden');const salt=uuid();await db.prepare('UPDATE members SET salt=?,pin_hash=? WHERE id=?').bind(salt,await hashPin(body.pin,salt),user.id).run();return json({ok:true});
}
if(path==='/api/code'&&req.method==='POST'){if(!host)return fail('Nur Host',403);const code=String(Math.floor(10000000+crypto.getRandomValues(new Uint32Array(1))[0]%90000000));await db.prepare("UPDATE config SET val=? WHERE key='signup_code'").bind(code).run();return json({code});}
if(path==='/api/template'&&req.method==='POST'){
 if(!host)return fail('Host only',403);
 const row=await db.prepare("SELECT val FROM config WHERE key='chore_templates'").first();
 let templates=STANDARD_CHORES.map(t=>({...t}));try{if(row){const saved=JSON.parse(row.val);templates=[...templates.filter(x=>!saved.some(t=>t.title.toLowerCase()===x.title.toLowerCase())),...saved]}}catch{return fail('Invalid template library')}
 if(!Array.isArray(templates))return fail('Invalid template library');
 if(body.action==='delete'){
   templates=templates.filter(t=>t.id!==body.id);
 }else{
   const title=String(body.title||'').trim().slice(0,120);
   const description=String(body.description||'').trim().slice(0,500);
   const category=String(body.category||'Other').slice(0,30);
   const amount=Math.round(Number(body.amount)*100);
   if(!title||!money(amount))return fail('Invalid task template');
   if(templates.length>=100)return fail('Maximum 100 templates');
   templates.push({id:uuid(),title,description,category,amount:amount/100});
 }
 await db.prepare("INSERT INTO config(key,val) VALUES('chore_templates',?) ON CONFLICT(key) DO UPDATE SET val=excluded.val").bind(JSON.stringify(templates)).run();
 return json({ok:true});
}
if(path==='/api/chore'&&req.method==='POST'){
 if(!host)return fail('Nur Host',403);const amount=Math.round(Number(body.amount)*100);if(!money(amount)||!/^\d{4}-\d{2}-\d{2}$/.test(body.due||'')||!body.title?.trim())return fail('Ungültige Aufgabe');
 if(!(await db.prepare('SELECT id FROM members WHERE id=? AND active=1').bind(body.member_id).first()))return fail('Unbekanntes Mitglied');
 const id=uuid();await db.prepare("INSERT INTO chores(id,title,description,category,member_id,amount,due,recurring,status,published,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(id,body.title.trim().slice(0,120),String(body.description||'').slice(0,500),String(body.category||'Other').slice(0,30),body.member_id,amount,body.due,'none','open',1,now()).run();return json({ok:true,id});
}
const match=path.match(/^\/api\/chore\/([a-f0-9-]+)\/(submit|approve|miss|overrule|undoapprove)$/);
if(match&&req.method==='POST'){
 const [,id,action]=match;const c=await db.prepare('SELECT * FROM chores WHERE id=?').bind(id).first();if(!c)return fail('Aufgabe nicht gefunden',404);
 if(action==='submit') {if(c.member_id!==user.id&&!host)return fail('Keine Berechtigung',403);if(!['open','rejected'].includes(c.status))return fail('Nicht mehr offen');await db.prepare("UPDATE chores SET status='submitted' WHERE id=? AND status IN ('open','rejected')").bind(id).run();return json({ok:true});}
 if(!host)return fail('Nur Host',403);
 if(action==='miss'){
 if(c.paid||!['open','submitted','rejected'].includes(c.status))return fail('Chore already closed');
 await db.batch([
 db.prepare("INSERT INTO ledger(id,member_id,amount,type,chore_id,note,created) SELECT ?,member_id,-amount,'penalty',id,'Missed: '||title,? FROM chores WHERE id=? AND paid=0 AND status IN ('open','submitted','rejected')").bind(uuid(),now(),id),
 db.prepare("UPDATE chores SET status='missed' WHERE id=? AND paid=0 AND status IN ('open','submitted','rejected')").bind(id)
 ]);
 return json({ok:true});
}
 if(action==='overrule'){
 if(c.status!=='missed'||c.paid)return fail('Only penalized chores can be overturned');
 const penalty=await db.prepare("SELECT amount FROM ledger WHERE chore_id=? AND type='penalty'").bind(id).first();
 if(!penalty)return fail('No penalty to reverse');
 await db.batch([
 db.prepare("INSERT INTO ledger(id,member_id,amount,type,chore_id,note,created) SELECT ?,member_id,?,'penalty_reversal',id,'Host reversed missed penalty: '||title,? FROM chores WHERE id=? AND status='missed'").bind(uuid(),-penalty.amount,now(),id),
 db.prepare("UPDATE chores SET status='open' WHERE id=? AND status='missed'").bind(id)
 ]);
 return json({ok:true});
 }
 if(action==='undoapprove'){
 if(c.status!=='confirmed'||!c.paid)return fail('Only approved chores can be reversed');
 const reward=await db.prepare("SELECT amount FROM ledger WHERE chore_id=? AND type='reward'").bind(id).first();
 if(!reward)return fail('Reward entry missing');
 await db.batch([
 db.prepare("INSERT INTO ledger(id,member_id,amount,type,chore_id,note,created) VALUES(?,?,?,'reward_reversal',?,?,?)").bind(uuid(),c.member_id,-reward.amount,id,'Approval reversed by host',now()),
 db.prepare("UPDATE chores SET status='submitted',paid=0 WHERE id=? AND status='confirmed' AND paid=1").bind(id)
 ]);
 return json({ok:true});
 }
 if(action==='approve'){
 if(!['submitted','open'].includes(c.status)||c.paid)return fail('Nicht genehmigungsfähig');const p=await poolInfo(db);if(p.pool-p.owed<p.reserved)return fail('Pool nicht ausreichend gedeckt');
 // D1 batch is atomic: the conditional update and award entry commit together.
 const tx=uuid();await db.batch([db.prepare("INSERT INTO ledger(id,member_id,amount,type,chore_id,note,created) SELECT ?,member_id,amount,CASE WHEN EXISTS(SELECT 1 FROM ledger x WHERE x.chore_id=chores.id AND x.type='reward') THEN 'reward_reapproval' ELSE 'reward' END,id,title,? FROM chores WHERE id=? AND paid=0 AND status IN ('open','submitted')").bind(tx,now(),id),db.prepare("UPDATE chores SET status='confirmed',paid=1 WHERE id=? AND paid=0 AND status IN ('open','submitted')").bind(id)]);return json({ok:true});
 }
}
if(path==='/api/deposit'&&req.method==='POST'){if(!host)return fail('Nur Host',403);const amount=Math.round(Number(body.amount)*100);if(!money(amount)||amount===0)return fail('Betrag ungültig');await db.prepare("INSERT INTO ledger(id,member_id,amount,type,note,created) VALUES(?,NULL,?,'deposit',?,?)").bind(uuid(),amount,String(body.note||'Pool-Aufladung').slice(0,160),now()).run();return json({ok:true});}
if(path==='/api/payout'&&req.method==='POST'){
 if(!host)return fail('Nur Host',403);const amount=Math.round(Number(body.amount)*100);if(!money(amount)||!amount)return fail('Betrag ungültig');const bal=await db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM ledger WHERE member_id=?').bind(body.member_id).first();if(bal.n<amount)return fail('Guthaben nicht ausreichend');
 await db.prepare("INSERT INTO ledger(id,member_id,amount,type,note,created) VALUES(?,?,?,'payout',?,?)").bind(uuid(),body.member_id,-amount,'Auszahlung',now()).run();return json({ok:true});
}
return fail('Nicht gefunden',404);
}
export default {async fetch(req,env){const u=new URL(req.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);try{return await handle(req,env);}catch(e){console.error(e);return fail('Serverfehler, bitte später erneut versuchen',500);}}};
