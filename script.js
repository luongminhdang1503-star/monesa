/* ============ CẤU HÌNH FIREBASE ============
 Dán cấu hình dự án của bạn (Firebase Console → Project settings → Your apps).
 Để trống = chế độ DEMO (lưu dữ liệu trong trình duyệt). */
const FIREBASE_CONFIG = {
apiKey: "AIzaSyC3nwgziK8paTEM7hKYwmrXwqY0nmrueYU",
  authDomain: "quanlikinhte-9ec6e.firebaseapp.com",
  projectId: "quanlikinhte-9ec6e",
  storageBucket: "quanlikinhte-9ec6e.firebasestorage.app",
  messagingSenderId: "453191279825",
  appId: "1:453191279825:web:23e9266efb0e33290191f0",
  measurementId: "G-H6971EZ5M0"
};
const USE_FB = !!FIREBASE_CONFIG.apiKey && window.firebase;
let auth, db, storage;
if (USE_FB) { firebase.initializeApp(FIREBASE_CONFIG); auth=firebase.auth(); db=firebase.firestore(); storage=firebase.storage(); }

/* ============ TIỆN ÍCH ============ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today=()=>new Date().toISOString().slice(0,10);
const toast=t=>{const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2200)};
const CATS={personal:{exp:['Ăn uống','Di chuyển','Nhà ở','Mua sắm','Giải trí','Học tập','Sức khỏe','Khác'],inc:['Lương','Thưởng','Làm thêm','Khác']},
 business:{exp:['Nhân sự','Nguyên vật liệu','Marketing','Thuê mặt bằng','Vận hành','Thuế & phí','Phần mềm','Khác'],inc:['Doanh thu bán hàng','Dịch vụ','Đầu tư','Khác']}};
const COLORS=['#0f7a4f','#1f9e6b','#5cc99b','#9be0c0','#f5a524','#e5484d','#6c8cff','#a78bfa'];

/* Tiền tệ: dữ liệu lưu bằng VND, hiển thị quy đổi qua ExchangeRate API */
let RATES={VND:1,USD:1/25400,EUR:1/27500,JPY:1/170,GBP:1/32000,KRW:1/18.5,CNY:1/3500}; // dự phòng khi offline
let CUR=localStorage.getItem('mx_cur')||'VND';
async function loadRates(){
  try{
    const r=await fetch('https://open.er-api.com/v6/latest/VND'); const j=await r.json();
    if(j.result==='success'){RATES=j.rates;toast('Đã cập nhật tỉ giá mới nhất')}
  }catch(e){}
  fillCur();
}
function fillCur(){
  const list=['VND','USD','EUR','JPY','GBP','KRW','CNY','AUD','SGD','THB'].filter(c=>RATES[c]);
  $('#cur').innerHTML=list.map(c=>`<option ${c===CUR?'selected':''}>${c}</option>`).join('');
}
const money=v=>{const x=v*(RATES[CUR]||1);return new Intl.NumberFormat('vi-VN',{style:'currency',currency:CUR,maximumFractionDigits:CUR==='VND'||CUR==='JPY'||CUR==='KRW'?0:2}).format(x)};
const toVND=v=>v/(RATES[CUR]||1);
const fromVND=v=>Math.round(v*(RATES[CUR]||1)*100)/100;

/* ============ LƯU TRỮ (Firestore hoặc localStorage) ============ */
let USER=null, MODE=localStorage.getItem('mx_mode')||'personal', PAGE='dash';
let D={tx:[],bud:[],goal:[]}, MONTH=new Date().toISOString().slice(0,7);
const col=c=>db.collection('users').doc(USER.uid).collection(c);
async function loadAll(){
  if(USE_FB){for(const c of Object.keys(D))D[c]=(await col(c).get()).docs.map(d=>({...d.data(),id:d.id}))}
  else{D=JSON.parse(localStorage.getItem('mx_data_'+USER.uid)||'{"tx":[],"bud":[],"goal":[]}')}
}
async function save(c,o){
  const i=D[c].findIndex(x=>x.id===o.id); i>=0?D[c][i]=o:D[c].push(o);
  if(USE_FB){const {id,...rest}=o;await col(c).doc(id).set(rest)} else persist();
}
async function remove(c,id){
  D[c]=D[c].filter(x=>x.id!==id);
  if(USE_FB)await col(c).doc(id).delete(); else persist();
}
const persist=()=>localStorage.setItem('mx_data_'+USER.uid,JSON.stringify(D));
const mine=c=>D[c].filter(x=>x.mode===MODE);

/* ============ XÁC THỰC ============ */
const demoUsers=()=>JSON.parse(localStorage.getItem('mx_users')||'{}');
let REG=false;
function setTab(r){REG=r;$('#tLogin').classList.toggle('on',!r);$('#tReg').classList.toggle('on',r);$('#bSubmit').textContent=r?'Tạo tài khoản':'Đăng nhập';$('#pw').autocomplete=r?'new-password':'current-password';$('#authErr').textContent=''}
const AUTHERR={'auth/email-already-in-use':'Email đã được đăng ký. Hãy chuyển sang Đăng nhập.','auth/invalid-credential':'Sai email hoặc mật khẩu.','auth/wrong-password':'Sai email hoặc mật khẩu.','auth/user-not-found':'Tài khoản chưa tồn tại. Hãy chuyển sang Đăng ký.','auth/invalid-email':'Email không hợp lệ.','auth/weak-password':'Mật khẩu cần tối thiểu 6 ký tự.','auth/popup-closed-by-user':'Bạn đã đóng cửa sổ đăng nhập Google.','auth/unauthorized-domain':'Tên miền chưa được cho phép trong Firebase Authentication.','auth/operation-not-allowed':'Phương thức đăng nhập này chưa được bật trong Firebase Console.'};
async function doAuth(){
  const email=$('#em').value.trim().toLowerCase(), pw=$('#pw').value; $('#authErr').textContent='';
  if(!email||pw.length<6){$('#authErr').textContent='Nhập email hợp lệ và mật khẩu từ 6 ký tự.';return}
  try{
    if(USE_FB){
      const cred=REG?await auth.createUserWithEmailAndPassword(email,pw):await auth.signInWithEmailAndPassword(email,pw);
      return start({uid:cred.user.uid,email:cred.user.email});
    }
    const u=demoUsers();
    if(REG){if(u[email])throw{message:'Email đã được đăng ký. Hãy chuyển sang Đăng nhập.'};u[email]={pw:btoa(pw),uid:uid()};localStorage.setItem('mx_users',JSON.stringify(u))}
    else if(!u[email]||u[email].pw!==btoa(pw))throw{message:'Sai email hoặc mật khẩu.'};
    localStorage.setItem('mx_session',email); start({uid:u[email].uid,email});
  }catch(e){$('#authErr').textContent=AUTHERR[e.code]||e.message||'Không thể xác thực.'}
}
async function googleAuth(){
  $('#authErr').textContent='';
  try{
    if(USE_FB){const r=await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());return start({uid:r.user.uid,email:r.user.email})}
    const email=(prompt('Chế độ demo: nhập email Google để thử nghiệm')||'').trim().toLowerCase();if(!email)return;
    const u=demoUsers();if(!u[email]){u[email]={pw:'',uid:uid()};localStorage.setItem('mx_users',JSON.stringify(u))}
    localStorage.setItem('mx_session',email);start({uid:u[email].uid,email});
  }catch(e){$('#authErr').textContent=AUTHERR[e.code]||e.message||'Không thể đăng nhập bằng Google.'}
}
async function start(u){
  USER=u; await loadAll();
  $('#auth').classList.add('hide');$('#app').classList.remove('hide');$('#who').textContent=u.email;
  if(!D.tx.length&&!USE_FB&&!localStorage.getItem('mx_seeded_'+u.uid)){seed();}
  go('dash');
}
function seed(){
  const m=MONTH,add=(mode,type,amount,day,category,note)=>D.tx.push({id:uid(),mode,type,amount,date:`${m}-${String(day).padStart(2,'0')}`,category,note,receipt:''});
  add('personal','inc',15000000,1,'Lương','Lương tháng');add('personal','exp',3500000,2,'Nhà ở','Tiền trọ');
  add('personal','exp',1200000,5,'Ăn uống','Siêu thị');add('personal','exp',450000,8,'Di chuyển','Xăng xe');
  add('personal','exp',2200000,12,'Mua sắm','Quần áo');add('personal','exp',300000,15,'Giải trí','Xem phim');
  add('business','inc',120000000,3,'Doanh thu bán hàng','Đơn hàng tuần 1');add('business','exp',45000000,5,'Nhân sự','Lương nhân viên');
  add('business','exp',12000000,9,'Marketing','Quảng cáo');add('business','exp',8000000,10,'Thuê mặt bằng','Văn phòng');
  D.bud.push({id:uid(),mode:'personal',category:'Ăn uống',limit:3000000},{id:uid(),mode:'personal',category:'Mua sắm',limit:2000000});
  D.goal.push({id:uid(),mode:'personal',name:'Mua laptop',target:25000000,saved:9000000},{id:uid(),mode:'personal',name:'Điện thoại mới',target:18000000,saved:4000000});
  persist();localStorage.setItem('mx_seeded_'+USER.uid,1);
}
function logout(){if(USE_FB)auth.signOut();localStorage.removeItem('mx_session');location.reload()}

/* ============ TÍNH TOÁN ============ */
const inMonth=t=>t.date.startsWith(MONTH);
function stats(){
  const all=mine('tx'),m=all.filter(inMonth);
  const sum=(a,t)=>a.filter(x=>x.type===t).reduce((s,x)=>s+ +x.amount,0);
  const byCat={};m.filter(x=>x.type==='exp').forEach(x=>byCat[x.category]=(byCat[x.category]||0)+ +x.amount);
  const biggest=m.filter(x=>x.type==='exp').sort((a,b)=>b.amount-a.amount)[0];
  return{inc:sum(m,'inc'),exp:sum(m,'exp'),bal:sum(all,'inc')-sum(all,'exp'),byCat,biggest,m};
}
function budgetUse(){
  const s=stats();return mine('bud').map(b=>{const used=s.byCat[b.category]||0,p=b.limit?used/b.limit*100:0;return{...b,used,p}});
}

/* ============ ĐIỀU HƯỚNG ============ */
const TITLES={dash:['Tổng quan','Sức khỏe tài chính và hoạt động gần đây'],tx:['Giao dịch','Thêm, sửa, xóa khoản thu chi'],bud:['Ngân sách','Giới hạn chi tiêu theo danh mục mỗi tháng'],ai:['Trợ lý tài chính','Phân tích dữ liệu và gợi ý tiết kiệm'],goal:['Mục tiêu tiết kiệm','Theo dõi tiến độ mua sắm lớn']};
let charts=[];
function go(p){
  PAGE=p;charts.forEach(c=>c.destroy());charts=[];
  $$('.nav[data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  $$('.mode button').forEach(b=>b.classList.toggle('on',b.dataset.mode===MODE));
  $('#title').innerHTML=`${TITLES[p][0]}<small>${TITLES[p][1]} · ${MODE==='personal'?'Chế độ cá nhân':'Chế độ doanh nghiệp'}</small>`;
  $('#month').value=MONTH;$('#side').classList.remove('open');
  ({dash,tx:txPage,bud:budPage,ai:aiPage,goal:goalPage})[p]();
}
const V=h=>$('#view').innerHTML=h;
const chart=(id,cfg)=>{charts.push(new Chart($(id),cfg))};
const tick=()=>getComputedStyle(document.documentElement).getPropertyValue('--mu');

/* ============ 1. DASHBOARD ============ */
function dash(){
  const s=stats(),bu=budgetUse().filter(b=>b.p>=80);
  const card=(c,i,v,l)=>`<div class="card stat"><div class="ico" style="background:${c}">${i}</div><div><b>${money(v)}</b><span>${l}</span></div></div>`;
  V(`<div class="grid g4">
    ${card('linear-gradient(135deg,#8b5cf6,#6d3fd9)','◈',s.bal,'Số dư hiện tại')}
    ${card('linear-gradient(135deg,#ff7a2f,#e5481b)','↓',s.inc,'Tổng thu trong tháng')}
    ${card('linear-gradient(135deg,#ff5c93,#e0357a)','↑',s.exp,'Tổng chi trong tháng')}
    ${card('linear-gradient(135deg,#1f9e6b,#0f7a4f)','★',s.biggest?s.biggest.amount:0,s.biggest?'Khoản chi lớn nhất: '+esc(s.biggest.category):'Chưa có khoản chi')}
   </div>
   ${bu.map(b=>`<div class="alert ${b.p>=100?'d':'w'}">${b.p>=100?'Vượt ngân sách':'Sắp hết ngân sách'} <b>${esc(b.category)}</b>: đã dùng ${b.p.toFixed(0)}%</div>`).join('')}
   <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Chi tiêu <select id="gran" style="width:110px"><option value="day">Theo ngày</option><option value="month">Theo tháng</option></select></h3><div class="cv"><canvas id="c1"></canvas></div></div>
    <div class="card"><h3>Cơ cấu chi tiêu</h3><div class="cv"><canvas id="c2"></canvas></div></div>
   </div>
   <div class="card" style="margin-top:14px"><h3>Giao dịch gần đây</h3>${txTable(mine('tx').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5),false)}</div>`);
  const draw=()=>{
    charts.filter(c=>c.canvas.id==='c1').forEach(c=>c.destroy());charts=charts.filter(c=>c.canvas.id!=='c1');
    const g=$('#gran').value,all=mine('tx').filter(x=>x.type==='exp'),map={};
    if(g==='day'){const n=new Date(MONTH.slice(0,4),MONTH.slice(5),0).getDate();for(let i=1;i<=n;i++)map[String(i).padStart(2,'0')]=0;
      all.filter(inMonth).forEach(x=>map[x.date.slice(8)]+= +x.amount)}
    else all.forEach(x=>{const k=x.date.slice(0,7);map[k]=(map[k]||0)+ +x.amount});
    const keys=Object.keys(map).sort();
    chart('#c1',{type:'bar',data:{labels:keys,datasets:[{label:'Chi tiêu ('+CUR+')',data:keys.map(k=>fromVND(map[k])),backgroundColor:'#1f9e6b',borderRadius:5}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:tick()}},y:{ticks:{color:tick()}}}}});
  };
  draw();$('#gran').onchange=draw;
  const cats=Object.keys(s.byCat);
  chart('#c2',{type:'doughnut',data:{labels:cats,datasets:[{data:cats.map(c=>fromVND(s.byCat[c])),backgroundColor:COLORS,borderWidth:0}]},options:{maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:tick(),boxWidth:10}}}}});
}

/* ============ 2. GIAO DỊCH ============ */
let F={q:'',cat:'',from:'',to:'',type:''};
function txTable(list,actions=true){
  if(!list.length)return '<p class="muted" style="padding:10px">Chưa có giao dịch. Bấm “Thêm giao dịch” để bắt đầu.</p>';
  return `<div class="tw"><table><tr><th>Ngày</th><th>Danh mục</th><th>Ghi chú</th><th>Số tiền</th>${actions?'<th></th>':''}</tr>${list.map(t=>`<tr>
   <td>${t.date.split('-').reverse().join('/')}</td><td><span class="pill">${esc(t.category)}</span></td><td>${esc(t.note)}${t.receipt?` <a href="${esc(t.receipt)}" target="_blank" rel="noopener">🧾</a>`:''}</td>
   <td class="${t.type}"><b>${t.type==='inc'?'+':'−'}${money(t.amount)}</b></td>
   ${actions?`<td style="white-space:nowrap"><button class="btn o s" data-edit="${t.id}">Sửa</button> <button class="btn r s" data-del="${t.id}">Xóa</button></td>`:''}</tr>`).join('')}</table></div>`;
}
function txPage(){
  const cats=[...new Set([...CATS[MODE].exp,...CATS[MODE].inc])];
  V(`<div class="card"><div class="row">
    <div style="flex:2"><label>Tìm kiếm</label><input id="fq" placeholder="Ghi chú, danh mục…" value="${esc(F.q)}"></div>
    <div><label>Loại</label><select id="ft"><option value="">Tất cả</option><option value="inc">Thu</option><option value="exp">Chi</option></select></div>
    <div><label>Danh mục</label><select id="fc"><option value="">Tất cả</option>${cats.map(c=>`<option>${c}</option>`).join('')}</select></div>
    <div><label>Từ ngày</label><input id="ff" type="date" value="${F.from}"></div>
    <div><label>Đến ngày</label><input id="fe" type="date" value="${F.to}"></div>
    <div style="flex:none"><button class="btn" id="addTx">+ Thêm giao dịch</button></div></div></div>
   <div class="card" style="margin-top:14px" id="txList"></div>`);
  $('#fc').value=F.cat;$('#ft').value=F.type;
  const apply=()=>{
    F={q:$('#fq').value,cat:$('#fc').value,type:$('#ft').value,from:$('#ff').value,to:$('#fe').value};
    const q=F.q.toLowerCase(),l=mine('tx').filter(t=>(!q||(t.note+t.category).toLowerCase().includes(q))&&(!F.cat||t.category===F.cat)&&(!F.type||t.type===F.type)&&(!F.from||t.date>=F.from)&&(!F.to||t.date<=F.to)).sort((a,b)=>b.date.localeCompare(a.date));
    $('#txList').innerHTML=txTable(l);
    $$('[data-edit]').forEach(b=>b.onclick=()=>txForm(D.tx.find(t=>t.id===b.dataset.edit)));
    $$('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Xóa giao dịch này?')){await remove('tx',b.dataset.del);toast('Đã xóa giao dịch');apply()}});
  };
  ['fq','ft','fc','ff','fe'].forEach(i=>$('#'+i).oninput=apply);apply();
  $('#addTx').onclick=()=>txForm();
}
function modal(html){const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="card">${html}</div>`;m.onclick=e=>{if(e.target===m)m.remove()};$('#modalRoot').append(m);return m}
function txForm(t){
  const e=t||{type:'exp',date:today(),amount:'',category:'',note:'',receipt:''};
  const m=modal(`<h3>${t?'Sửa':'Thêm'} giao dịch</h3>
   <div class="row"><div><label>Loại</label><select id="xt"><option value="exp">Chi</option><option value="inc">Thu</option></select></div>
   <div><label>Ngày</label><input id="xd" type="date" value="${e.date}"></div></div>
   <div><label>Số tiền (${CUR})</label><input id="xa" type="number" min="0" step="any" value="${e.amount?fromVND(e.amount):''}"></div>
   <div><label>Danh mục</label><select id="xc"></select></div>
   <div><label>Ghi chú</label><textarea id="xn" rows="2">${esc(e.note)}</textarea></div>
   <div><label>Ảnh hóa đơn (tùy chọn)</label><input id="xr" type="file" accept="image/*"></div>
   <div class="row"><button class="btn o" id="xx">Hủy</button><button class="btn" id="xs">Lưu</button></div>`);
  const fill=()=>{$('#xc',m).innerHTML=CATS[MODE][$('#xt',m).value].map(c=>`<option>${c}</option>`).join('');if(e.category)$('#xc',m).value=e.category};
  $('#xt',m).value=e.type;fill();$('#xt',m).onchange=()=>{e.category='';fill()};
  $('#xx',m).onclick=()=>m.remove();
  $('#xs',m).onclick=async()=>{
    const amt=toVND(+$('#xa',m).value);if(!(amt>0)){toast('Nhập số tiền lớn hơn 0');return}
    let receipt=e.receipt||'',f=$('#xr',m).files[0];
    if(f){
      try{
        if(USE_FB){const ref=storage.ref(`receipts/${USER.uid}/${uid()}_${f.name}`);await ref.put(f);receipt=await ref.getDownloadURL()}
        else if(f.size<400000){receipt=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)})}
        else toast('Chế độ demo chỉ lưu ảnh dưới 400KB');
      }catch(err){toast('Không tải được ảnh hóa đơn')}
    }
    await save('tx',{id:e.id||uid(),mode:MODE,type:$('#xt',m).value,date:$('#xd',m).value,amount:amt,category:$('#xc',m).value,note:$('#xn',m).value.trim(),receipt});
    m.remove();toast('Đã lưu giao dịch');go(PAGE);
  };
}

/* ============ 3. NGÂN SÁCH ============ */
function budPage(){
  const bu=budgetUse();
  V(`<div class="card"><h3>Đặt giới hạn chi tiêu tháng ${MONTH.split('-').reverse().join('/')}</h3>
   <div class="row"><div><label>Danh mục</label><select id="bc">${CATS[MODE].exp.map(c=>`<option>${c}</option>`).join('')}</select></div>
   <div><label>Giới hạn (${CUR})</label><input id="bl" type="number" min="0" step="any"></div>
   <div style="flex:none"><button class="btn" id="bs">Lưu ngân sách</button></div></div></div>
   <div class="grid g2e" style="margin-top:14px">${bu.length?bu.map(b=>{const c=b.p>=100?'d':b.p>=80?'w':'';return `<div class="card">
    <h3>${esc(b.category)}<button class="btn r s" data-bd="${b.id}">Xóa</button></h3>
    <b style="font-size:20px">${b.p.toFixed(0)}%</b> <span class="muted">đã dùng · ${money(b.used)} / ${money(b.limit)}</span>
    <div class="bar ${c}"><i style="width:${Math.min(b.p,100)}%"></i></div>
    ${b.p>=100?`<div class="alert d">Bạn đã vượt ngân sách ${money(b.used-b.limit)}. Hãy hạn chế chi cho mục này.</div>`:b.p>=80?`<div class="alert w">Cảnh báo: đã dùng trên 80%. Còn lại ${money(b.limit-b.used)}.</div>`:`<span class="muted">Còn lại ${money(b.limit-b.used)}</span>`}</div>`}).join(''):'<p class="muted">Chưa có ngân sách nào. Chọn danh mục và đặt giới hạn ở trên.</p>'}</div>`);
  $('#bs').onclick=async()=>{
    const l=toVND(+$('#bl').value),c=$('#bc').value;if(!(l>0)){toast('Nhập giới hạn lớn hơn 0');return}
    const ex=mine('bud').find(b=>b.category===c);await save('bud',{id:ex?.id||uid(),mode:MODE,category:c,limit:l});toast('Đã lưu ngân sách');budPage();
  };
  $$('[data-bd]').forEach(b=>b.onclick=async()=>{await remove('bud',b.dataset.bd);budPage()});
}

/* ============ 4. TRỢ LÝ TÀI CHÍNH ============ */
function analysis(){
  const s=stats(),cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]),bu=budgetUse();
  const rate=s.inc?(s.inc-s.exp)/s.inc*100:0;
  return{s,cats,bu,rate};
}
function localAnswer(q){
  const {s,cats,bu,rate}=analysis();q=q.toLowerCase();
  if(!s.m.length)return 'Tháng này chưa có giao dịch nào. Hãy thêm vài khoản thu chi để tôi phân tích giúp bạn.';
  const top=cats[0],pct=top?(top[1]/s.exp*100).toFixed(0):0;
  const over=bu.filter(b=>b.p>=80);
  const tips=[];
  if(top)tips.push(`Danh mục “${top[0]}” chiếm ${pct}% tổng chi. Thử giảm 10–15% ở đây để tiết kiệm khoảng ${money(top[1]*0.12)}/tháng.`);
  if(rate<20)tips.push(`Tỉ lệ tiết kiệm hiện là ${rate.toFixed(0)}%, thấp hơn mức khuyến nghị 20%. Áp dụng quy tắc 50/30/20: 50% nhu cầu, 30% mong muốn, 20% tiết kiệm.`);
  else tips.push(`Tỉ lệ tiết kiệm ${rate.toFixed(0)}% là tốt. Hãy chuyển phần dư vào mục tiêu tiết kiệm ngay đầu tháng.`);
  over.forEach(b=>tips.push(`Ngân sách “${b.category}” đã dùng ${b.p.toFixed(0)}%. ${b.p>=100?'Cần dừng chi thêm mục này.':'Hãy theo dõi sát đến cuối tháng.'}`));
  const g=mine('goal').find(x=>x.saved<x.target);
  if(g&&s.inc-s.exp>0)tips.push(`Với số dư tháng này (${money(s.inc-s.exp)}), bạn có thể đạt mục tiêu “${g.name}” sau khoảng ${Math.ceil((g.target-g.saved)/(s.inc-s.exp))} tháng.`);
  if(/nhiều nhất|danh mục|top/.test(q))return top?`Bạn chi nhiều nhất cho “${top[0]}”: ${money(top[1])} (${pct}% tổng chi).\nTiếp theo: ${cats.slice(1,3).map(c=>`${c[0]} (${money(c[1])})`).join(', ')||'chưa có'}.`:'Chưa có khoản chi nào.';
  if(/tiết kiệm|gợi ý|giảm/.test(q))return 'Gợi ý tiết kiệm:\n• '+tips.join('\n• ');
  if(/ngân sách/.test(q))return bu.length?bu.map(b=>`• ${b.category}: ${b.p.toFixed(0)}% (${money(b.used)}/${money(b.limit)})`).join('\n'):'Bạn chưa đặt ngân sách nào.';
  if(/lớn nhất/.test(q))return s.biggest?`Khoản chi lớn nhất: ${money(s.biggest.amount)} cho “${s.biggest.category}” ngày ${s.biggest.date.split('-').reverse().join('/')}${s.biggest.note?' ('+s.biggest.note+')':''}.`:'Chưa có khoản chi.';
  return `Tóm tắt tháng ${MONTH.split('-').reverse().join('/')}:\n• Thu ${money(s.inc)} · Chi ${money(s.exp)} · Chênh lệch ${money(s.inc-s.exp)}\n• Tỉ lệ tiết kiệm ${rate.toFixed(0)}%\n• Chi nhiều nhất: ${top?top[0]+' ('+pct+'%)':'—'}\n\nGợi ý:\n• ${tips.slice(0,3).join('\n• ')}`;
}
async function aiAnswer(q){
  const key=localStorage.getItem('mx_aikey');if(!key)return localAnswer(q);
  const {s,cats,bu}=analysis();
  const ctx=`Chế độ: ${MODE}. Tháng ${MONTH}. Tiền tệ lưu: VND. Thu ${s.inc}, chi ${s.exp}. Chi theo danh mục: ${JSON.stringify(Object.fromEntries(cats))}. Ngân sách: ${JSON.stringify(bu.map(b=>({c:b.category,limit:b.limit,pct:Math.round(b.p)})))}. Khoản chi lớn nhất: ${s.biggest?s.biggest.amount+' '+s.biggest.category:'không'}.`;
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:700,system:'Bạn là trợ lý tài chính cá nhân/doanh nghiệp bằng tiếng Việt. Trả lời ngắn gọn, cụ thể, dựa trên dữ liệu được cung cấp. Không bịa số liệu.\nDữ liệu: '+ctx,messages:[{role:'user',content:q}]})});
    const j=await r.json();if(j.content)return j.content.map(c=>c.text||'').join('');throw 0;
  }catch(e){return localAnswer(q)+'\n\n(Không gọi được AI API, đang dùng phân tích nội bộ.)'}
}
function aiPage(){
  V(`<div class="grid g2"><div class="card chat"><div class="msgs" id="msgs"><div class="m">Xin chào! Tôi có thể phân tích chi tiêu, tìm danh mục tốn nhiều nhất và gợi ý tiết kiệm từ dữ liệu của bạn.</div></div>
   <div class="chips">${['Tóm tắt tháng này','Danh mục chi nhiều nhất','Gợi ý tiết kiệm','Tình trạng ngân sách','Khoản chi lớn nhất'].map(c=>`<button>${c}</button>`).join('')}</div>
   <div class="row" style="flex-wrap:nowrap"><input id="aq" placeholder="Hỏi về thói quen chi tiêu của bạn…"><button class="btn" id="as" style="flex:none">Gửi</button></div></div>
   <div class="card"><h3>Phân tích nhanh</h3><div id="quick"></div>
    <h3 style="margin-top:18px">Kết nối AI API (tùy chọn)</h3>
    <p class="muted" style="margin-bottom:8px">Nhập Anthropic API key để AI giải thích thói quen chi tiêu. Key chỉ lưu trong trình duyệt của bạn; khi triển khai thật nên gọi qua Cloud Functions.</p>
    <input id="ak" type="password" placeholder="sk-ant-…" value="${esc(localStorage.getItem('mx_aikey')||'')}"><button class="btn o s" id="aks" style="margin-top:8px">Lưu key</button></div></div>`);
  const {s,cats,rate}=analysis();
  $('#quick').innerHTML=cats.length?cats.slice(0,4).map(([c,v])=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><span>${esc(c)}</span><b>${money(v)}</b></div><div class="bar"><i style="width:${v/s.exp*100}%"></i></div></div>`).join('')+`<p class="muted">Tỉ lệ tiết kiệm: <b>${rate.toFixed(0)}%</b></p>`:'<p class="muted">Chưa có dữ liệu chi tiêu tháng này.</p>';
  const add=(t,u)=>{const d=document.createElement('div');d.className='m'+(u?' u':'');d.textContent=t;$('#msgs').append(d);$('#msgs').scrollTop=1e9;return d};
  const ask=async q=>{if(!q.trim())return;add(q,1);$('#aq').value='';const w=add('Đang phân tích…');w.textContent=await aiAnswer(q)};
  $('#as').onclick=()=>ask($('#aq').value);$('#aq').onkeydown=e=>{if(e.key==='Enter')ask(e.target.value)};
  $$('.chips button').forEach(b=>b.onclick=()=>ask(b.textContent));
  $('#aks').onclick=()=>{localStorage.setItem('mx_aikey',$('#ak').value.trim());toast('Đã lưu key')};
}

/* ============ 5. MỤC TIÊU TIẾT KIỆM ============ */
function goalPage(){
  const gs=mine('goal');
  V(`<div class="card"><h3>Tạo mục tiêu mới</h3><div class="row">
   <div style="flex:2"><label>Tên mục tiêu</label><input id="gn" placeholder="Laptop, điện thoại, máy ảnh…"></div>
   <div><label>Số tiền cần (${CUR})</label><input id="gt" type="number" min="0" step="any"></div>
   <div style="flex:none"><button class="btn" id="gs">+ Tạo mục tiêu</button></div></div></div>
   <div class="grid g2e" style="margin-top:14px">${gs.length?gs.map(g=>{const p=Math.min(g.saved/g.target*100,100);return `<div class="card">
    <h3>${esc(g.name)}<button class="btn r s" data-gd="${g.id}">Xóa</button></h3>
    <b style="font-size:20px">${p.toFixed(0)}%</b> <span class="muted">${money(g.saved)} / ${money(g.target)}</span>
    <div class="bar"><i style="width:${p}%"></i></div>
    ${p>=100?'<div class="alert" style="background:var(--gl);color:var(--g)">Chúc mừng, bạn đã đạt mục tiêu!</div>':`<div class="row" style="flex-wrap:nowrap;margin-top:8px"><input type="number" min="0" step="any" placeholder="Số tiền thêm (${CUR})" data-gi="${g.id}"><button class="btn s" data-ga="${g.id}" style="flex:none">Nạp thêm</button></div>`}</div>`}).join(''):'<p class="muted">Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên ở trên.</p>'}</div>`);
  $('#gs').onclick=async()=>{const n=$('#gn').value.trim(),t=toVND(+$('#gt').value);if(!n||!(t>0)){toast('Nhập tên và số tiền mục tiêu');return}await save('goal',{id:uid(),mode:MODE,name:n,target:t,saved:0});goalPage()};
  $$('[data-ga]').forEach(b=>b.onclick=async()=>{const g=D.goal.find(x=>x.id===b.dataset.ga),v=toVND(+$(`[data-gi="${g.id}"]`).value);if(!(v>0))return;g.saved=Math.min(g.saved+v,g.target);await save('goal',g);goalPage()});
  $$('[data-gd]').forEach(b=>b.onclick=async()=>{if(confirm('Xóa mục tiêu này?')){await remove('goal',b.dataset.gd);goalPage()}});
}

/* ============ KHỞI ĐỘNG ============ */
$('#bSubmit').onclick=doAuth;$('#bGoogle').onclick=googleAuth;$('#tLogin').onclick=()=>setTab(false);$('#tReg').onclick=()=>setTab(true);
$('#pw').onkeydown=e=>{if(e.key==='Enter')doAuth()};
/* Giao diện sáng/tối */
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('mx_theme',t);if(USER)go(PAGE)}
document.documentElement.dataset.theme=localStorage.getItem('mx_theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
$$('[data-theme-toggle]').forEach(b=>b.onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#logout').onclick=logout;$('#menuBtn').onclick=()=>$('#side').classList.toggle('open');
$$('.nav[data-p]').forEach(b=>b.onclick=()=>go(b.dataset.p));
$$('.mode button').forEach(b=>b.onclick=()=>{MODE=b.dataset.mode;localStorage.setItem('mx_mode',MODE);F={q:'',cat:'',from:'',to:'',type:''};go(PAGE)});
$('#cur').onchange=e=>{CUR=e.target.value;localStorage.setItem('mx_cur',CUR);go(PAGE)};
$('#month').onchange=e=>{if(e.target.value){MONTH=e.target.value;go(PAGE)}};
if(!USE_FB){$('#authNote').textContent='Chế độ demo: dữ liệu lưu trong trình duyệt. Dán cấu hình Firebase vào FIREBASE_CONFIG để dùng Authentication, Firestore và Storage.';$('#authNote').classList.remove('hide')}
fillCur();loadRates();
if(USE_FB)auth.onAuthStateChanged(u=>{if(u&&!USER)start({uid:u.uid,email:u.email})});
else{const e=localStorage.getItem('mx_session'),u=demoUsers()[e];if(u)start({uid:u.uid,email:e})}