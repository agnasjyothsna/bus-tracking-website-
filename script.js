
const STOPS = {
  "Nagercoil":[8.1780,77.4340],"Vadasery":[8.1735,77.4380],"Suchindram":[8.1535,77.4650],
  "Agastheeswaram":[8.1200,77.5000],"Kanyakumari":[8.0883,77.5385],
  "Marthandam":[8.3070,77.2270],"Thuckalay":[8.2500,77.3150],"Parvathipuram":[8.1850,77.4050]
};
const ROUTES = [
  {id:1,no:"11A",name:"Nagercoil – Kanyakumari",stops:["Nagercoil","Vadasery","Suchindram","Agastheeswaram","Kanyakumari"],
   first:"5:30 AM",last:"9:45 PM",base:5,per:3,crowd:"Medium",access:"Low floor, wheelchair space",eta:6,alert:null},
  {id:2,no:"27",name:"Nagercoil – Kanyakumari Express",stops:["Nagercoil","Suchindram","Kanyakumari"],
   first:"6:00 AM",last:"9:00 PM",base:10,per:8,crowd:"Low",access:"Standard steps",eta:14,alert:{t:"Route delayed by about 10 minutes",lvl:"warn"}},
  {id:3,no:"5B",name:"Marthandam – Nagercoil",stops:["Marthandam","Thuckalay","Parvathipuram","Nagercoil"],
   first:"5:15 AM",last:"9:30 PM",base:5,per:4,crowd:"High",access:"Low floor",eta:9,alert:{t:"Route changed near Thuckalay",lvl:"warn"}}
];
const STOP_NAMES = Object.keys(STOPS);

// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const store = {
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const state = {tab:"home",from:"Nagercoil",to:"Kanyakumari",results:null,route:null,rating:0,msg:""};
let favs = store.get("favs",[]), contacts = store.get("contacts",[]), reports = store.get("reports",[]);
let busTimer = null;
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const opts = sel => STOP_NAMES.map(n=>`<option ${n===sel?"selected":""}>${n}</option>`).join("");
const crowdTag = c => `<span class="tag ${c==="Low"?"t-ok":c==="Medium"?"t-warn":"t-bad"}">${c} crowd</span>`;
function findRoutes(from,to){
  return ROUTES.map(r=>({r,i:r.stops.indexOf(from),j:r.stops.indexOf(to)})).filter(x=>x.i>=0&&x.j>x.i);
}
function fare(r,from,to){return r.base + r.per*(r.stops.indexOf(to)-r.stops.indexOf(from)-1);}
function km(a,b){const R=6371,t=x=>x*Math.PI/180,dLa=t(b[0]-a[0]),dLo=t(b[1]-a[1]);
  const h=Math.sin(dLa/2)**2+Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h));}

// ---------- Navigation ----------
const TABS=[["home","Home"],["nearby","Nearby"],["sos","Emergency"],["feedback","Feedback"]];
function go(tab){state.tab=tab;clearInterval(busTimer);render();window.scrollTo(0,0);}
function renderNav(){
  $("#nav").innerHTML=TABS.map(([k,l])=>`<button data-go="${k}" ${state.tab===k||(k==="home"&&["results","detail"].includes(state.tab))?'aria-current="page"':""}>${l}</button>`).join("");
}

// ---------- Views ----------
function viewHome(){
  const alerts = ROUTES.filter(r=>r.alert).map(r=>`<div class="alert ${r.alert.lvl==="bad"?"bad":""}"><b>${r.no}</b> ${esc(r.alert.t)}</div>`).join("");
  const fv = favs.length ? favs.map((f,i)=>`<span class="row"><button class="chip" data-fav="${i}">${esc(f.from)} → ${esc(f.to)}</button><button class="chip" aria-label="Remove favorite" data-unfav="${i}">✕</button></span>`).join(" ")
    : `<p class="muted">No saved journeys yet. Search a journey and tap “Save journey”.</p>`;
  return `<h1>Where to?</h1><p class="sub">Find buses, arrival times and fares.</p>
  <div class="card">
    <label for="from">From</label><select id="from">${opts(state.from)}</select>
    <label for="to">To</label><select id="to">${opts(state.to)}</select>
    <div class="row" style="margin-top:12px"><button class="pri grow" id="search">Find buses</button><button id="swap" aria-label="Swap stops">⇅</button></div>
  </div>
  <h2>Favorite routes</h2><div class="row">${fv}</div>
  <h2>Service alerts</h2>${alerts||'<p class="muted">All routes are running normally.</p>'}`;
}
function viewResults(){
  const list = state.results.length ? state.results.map(({r})=>`
    <div class="card"><div class="row"><span class="busno">${r.no}</span><span class="grow">${esc(r.name)}</span><span class="tag t-ok">${r.eta} min</span></div>
    ${r.alert?`<div class="alert" style="margin:8px 0 0">${esc(r.alert.t)}</div>`:""}
    <div class="row" style="margin-top:8px"><span class="muted grow">Fare ₹${fare(r,state.from,state.to)} · ${crowdTag(r.crowd)}</span><button class="pri" data-open="${r.id}">Details</button></div></div>`).join("")
    : `<div class="card">No direct bus from ${esc(state.from)} to ${esc(state.to)}. Try different stops.</div>`;
  const saved = favs.some(f=>f.from===state.from&&f.to===state.to);
  return `<button data-go="home">← Back</button><h1>${esc(state.from)} → ${esc(state.to)}</h1>
  <div class="row" style="margin:6px 0 12px"><button id="savefav" ${saved?"disabled":""}>${saved?"Saved":"Save journey"}</button></div>${list}`;
}
function viewDetail(){
  const r=state.route, f=state.from, t=state.to, i=r.stops.indexOf(f), j=r.stops.indexOf(t);
  const stopList = r.stops.map((s,k)=>`<li class="${k>=i&&k<=j?"on":""}">${esc(s)}</li>`).join("");
  return `<button data-go="results">← Back</button>
  <div class="row" style="margin-top:10px"><span class="busno">${r.no}</span><h1 class="grow" style="font-size:1.15rem">${esc(r.name)}</h1></div>
  ${r.alert?`<div class="alert">${esc(r.alert.t)}</div>`:""}
  <div class="card row"><div class="grow"><div class="big">${r.eta} min</div><span class="muted">Arrives at ${esc(f)}</span></div>
    <div class="grow"><div class="big">₹${fare(r,f,t)}</div><span class="muted">Fare to ${esc(t)}</span></div></div>
  <div class="card"><b>First and last bus</b><div class="muted">First bus ${r.first} · Last bus ${r.last}</div></div>
  <div class="card"><div>${crowdTag(r.crowd)}</div><p class="muted" style="margin:8px 0 0">Accessibility: ${esc(r.access)}</p></div>
  <h2>Live map</h2>${mapSvg(r)}
  <h2>Stops</h2><ul class="stops">${stopList}</ul>
  <div class="row" style="margin-top:14px"><button data-go="feedback">Report wrong route, ETA or fare</button></div>`;
}
function mapSvg(r){
  const pts=r.stops.map(s=>STOPS[s]), W=320,H=200,P=26;
  const la=pts.map(p=>p[0]), lo=pts.map(p=>p[1]);
  const mnA=Math.min(...la),mxA=Math.max(...la),mnO=Math.min(...lo),mxO=Math.max(...lo);
  const sc=Math.min((W-2*P)/((mxO-mnO)||1),(H-2*P)/((mxA-mnA)||1));
  const ox=(W-(mxO-mnO)*sc)/2, oy=(H-(mxA-mnA)*sc)/2;
  const xy=p=>[ox+(p[1]-mnO)*sc, H-oy-(p[0]-mnA)*sc];
  const P2=pts.map(xy);
  const line=P2.map(p=>p.join(",")).join(" ");
  const dots=P2.map((p,k)=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="var(--card)" stroke="var(--brand)" stroke-width="3"/><text x="${p[0]+8}" y="${p[1]-8}" font-size="10" fill="var(--ink)">${esc(r.stops[k])}</text>`).join("");
  window._path=P2;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route map with moving bus"><polyline points="${line}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-dasharray="6 4"/>${dots}<g id="bus"><circle r="8" fill="var(--bad)"/><text y="3.5" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">B</text></g></svg><p class="muted">Simulated bus position. Real GPS comes later.</p>`;
}
function startBus(){
  const P=window._path; if(!P||!$("#bus"))return;
  let t=0.1;
  const seg=P.length-1;
  const place=()=>{const s=Math.min(Math.floor(t*seg),seg-1),u=t*seg-s,a=P[s],b=P[s+1];
    $("#bus").setAttribute("transform",`translate(${a[0]+(b[0]-a[0])*u},${a[1]+(b[1]-a[1])*u})`);};
  place();
  busTimer=setInterval(()=>{t=t>=0.98?0.02:t+0.01;if($("#bus"))place();},700);
}
function viewNearby(){
  return `<h1>Nearby stops</h1><p class="sub">Stops closest to you.</p>
  <button class="pri" id="locate">Use my location</button><div id="nearlist" style="margin-top:12px"></div>`;
}
function showNearby(pos,demo){
  const L=STOP_NAMES.map(n=>({n,d:km(pos,STOPS[n])})).sort((a,b)=>a.d-b.d).slice(0,4);
  $("#nearlist").innerHTML=(demo?`<p class="muted">Location unavailable. Showing stops near Nagercoil as a demo.</p>`:"")+
    L.map(x=>`<div class="card row"><b class="grow">${x.n}</b><span class="tag t-ok">${x.d.toFixed(1)} km</span><span class="muted">${ROUTES.filter(r=>r.stops.includes(x.n)).map(r=>r.no).join(", ")}</span></div>`).join("");
}
function viewSos(){
  const cs=contacts.length?contacts.map((c,i)=>`<div class="card row"><span class="grow"><b>${esc(c.name)}</b><br><span class="muted">${esc(c.phone)}</span></span><button data-delc="${i}" aria-label="Remove contact">✕</button></div>`).join(""):`<p class="muted">Add at least one trusted contact.</p>`;
  return `<h1>Emergency</h1><p class="sub">Share your location with people you trust.</p>
  <div class="row"><button class="sos grow" id="share">Share my location</button><a href="tel:112"><button>Call 112</button></a></div>
  <p class="muted" id="sosmsg" role="status">${esc(state.msg)}</p>
  <h2>Trusted contacts</h2>${cs}
  <div class="card"><label for="cn">Name</label><input id="cn" autocomplete="off"><label for="cp">Phone number</label><input id="cp" type="tel" inputmode="tel"><div style="margin-top:10px"><button class="pri" id="addc">Add contact</button></div></div>`;
}
function viewFeedback(){
  const stars=[1,2,3,4,5].map(n=>`<button data-star="${n}" aria-label="${n} stars">${n<=state.rating?"★":"☆"}</button>`).join("");
  return `<h1>Feedback</h1><p class="sub">Rate the service or report wrong information.</p>
  <div class="card"><div class="stars" role="group" aria-label="Rating">${stars}</div>
  <label for="ft">Type</label><select id="ft"><option>General feedback</option><option>Incorrect route</option><option>Incorrect ETA</option><option>Incorrect fare</option></select>
  <label for="fc">Comments</label><textarea id="fc" rows="4"></textarea>
  <div style="margin-top:10px"><button class="pri" id="sendfb">Send feedback</button></div><p class="muted" role="status">${esc(state.msg)}</p></div>`;
}

// ---------- Render + events ----------
function render(){
  const v={home:viewHome,results:viewResults,detail:viewDetail,nearby:viewNearby,sos:viewSos,feedback:viewFeedback}[state.tab];
  $("#app").innerHTML=v(); renderNav();
  if(state.tab==="detail")startBus();
}
document.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  const d=b.dataset;
  if(d.go){state.msg="";return go(d.go);}
  if(d.open){state.route=ROUTES.find(r=>r.id==d.open);return go("detail");}
  if(d.fav!==undefined){const f=favs[d.fav];state.from=f.from;state.to=f.to;state.results=findRoutes(f.from,f.to);return go("results");}
  if(d.unfav!==undefined){favs.splice(d.unfav,1);store.set("favs",favs);return render();}
  if(d.delc!==undefined){contacts.splice(d.delc,1);store.set("contacts",contacts);return render();}
  if(d.star){state.rating=+d.star;const t=$("#fc")?.value,y=$("#ft")?.value;render();if($("#fc"))$("#fc").value=t||"";if($("#ft"))$("#ft").value=y;return;}
  if(b.id==="search"){state.from=$("#from").value;state.to=$("#to").value;state.results=findRoutes(state.from,state.to);return go("results");}
  if(b.id==="swap"){const a=$("#from").value,c=$("#to").value;state.from=c;state.to=a;return render();}
  if(b.id==="savefav"){favs.push({from:state.from,to:state.to});store.set("favs",favs);return render();}
  if(b.id==="locate"){
    if(!navigator.geolocation)return showNearby(STOPS.Nagercoil,true);
    navigator.geolocation.getCurrentPosition(p=>showNearby([p.coords.latitude,p.coords.longitude]),()=>showNearby(STOPS.Nagercoil,true),{timeout:8000});return;
  }
  if(b.id==="addc"){const n=$("#cn").value.trim(),p=$("#cp").value.trim();
    if(!n||!p){state.msg="Enter a name and phone number.";return render();}
    contacts.push({name:n,phone:p});store.set("contacts",contacts);state.msg="";return render();}
  if(b.id==="share"){
    const send=(lat,lng)=>{
      const link=`https://maps.google.com/?q=${lat},${lng}`, text=`I need help. My location: ${link}`;
      if(navigator.share){navigator.share({text}).catch(()=>{});}
      else if(contacts.length){location.href=`sms:${contacts.map(c=>c.phone).join(",")}?body=${encodeURIComponent(text)}`;}
      else{state.msg="Add a trusted contact first.";render();}
    };
    if(!navigator.geolocation){state.msg="Location is not available on this device.";return render();}
    navigator.geolocation.getCurrentPosition(p=>send(p.coords.latitude,p.coords.longitude),()=>{state.msg="Allow location access, then try again.";render();},{timeout:8000});return;
  }
  if(b.id==="sendfb"){
    if(!state.rating&&!$("#fc").value.trim()){state.msg="Add a rating or a comment.";return render();}
    reports.push({rating:state.rating,type:$("#ft").value,text:$("#fc").value.trim(),at:new Date().toISOString()});
    store.set("reports",reports);state.rating=0;state.msg="Thanks. Your feedback was saved.";return render();
  }
});
render();
