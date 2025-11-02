// initialize firebase and firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// helper for file to base64
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const categories = ["Alimentação","Beleza","Saúde","Serviços","Comércio","Automotivo","Profissionais Autônomos"];
const catGrid = document.getElementById('catGrid');
categories.forEach(c=>{
  const btn = document.createElement('button');
  btn.className='cat';
  btn.setAttribute('data-cat', c);
  btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg><span>${c}</span>`;
  btn.addEventListener('click', ()=>{
    document.getElementById('categorySelect').value = c;
    doSearch();
  });
  catGrid.appendChild(btn);
});

const cardsEl = document.getElementById('cards');
const searchInput = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');
const citySelect = document.getElementById('citySelect');
const searchBtn = document.getElementById('searchBtn');

function renderCards(data){
  cardsEl.innerHTML = '';
  if(!data || data.length===0){
    cardsEl.innerHTML = '<p>Nenhum resultado encontrado.</p>';
    return;
  }
  data.forEach(d=>{
    const div = document.createElement('div');
    div.className='card';
    const img = d.imagem || '';
    const thumb = img ? `<img class="thumb" src="${img}" alt="${d.nome}">` : `<div class="thumb" style="background:#f1f3f5;display:flex;align-items:center;justify-content:center;color:var(--muted)">Sem foto</div>`;
    const insta = d.instagram ? `<a href="${d.instagram}" target="_blank" title="Instagram"><img src="assets/ig.png" style="width:20px;height:20px"></a>` : '';
    const whatsappLink = d.whatsapp ? `https://wa.me/${d.whatsapp.replace(/\D/g,'')}` : '';
    const whatsappBtn = d.whatsapp ? `<a href="${whatsappLink}" target="_blank" class="btn" style="padding:6px 8px;margin-right:6px">Fale no WhatsApp</a>` : '';
    const mapsLink = d.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.endereco + ', ' + d.cidade)}` : '';
    div.innerHTML = `${thumb}<div class="card-body"><h4>${d.nome}</h4><p>${d.descricao || ''}</p>
      <div class="meta">${d.categoria || ''} • ${d.cidade || ''} • ${d.telefone || ''}</div>
      <div class="icons">${whatsappBtn}${insta ? '<span style="margin-left:6px">'+insta+'</span>':''}<a href="${mapsLink}" target="_blank" class="btn" style="padding:6px 8px;margin-left:8px">Ver no mapa</a></div>
    </div>`;
    cardsEl.appendChild(div);
  });
}

// load active ads
function loadActive(){
  db.collection('cadastros').where('status','==','active').orderBy('createdAt','desc').onSnapshot(snap=>{
    const items = [];
    snap.forEach(doc=>{
      const d = doc.data();
      items.push(d);
    });
    renderCards(items);
  });
}
loadActive();

async function doSearch(){
  const q = searchInput.value.trim().toLowerCase();
  const cat = categorySelect.value;
  const city = citySelect.value;
  let ref = db.collection('cadastros').where('status','==','active').orderBy('createdAt','desc');
  const snap = await ref.get();
  const results = [];
  snap.forEach(doc=>{
    const d = doc.data();
    let matchQ = q === '' || (d.nome + ' ' + (d.descricao||'') + ' ' + (d.endereco||'')).toLowerCase().includes(q);
    let matchCat = cat === '' || d.categoria === cat;
    let matchCity = city === '' || d.cidade === city;
    if(matchQ && matchCat && matchCity) results.push(d);
  });
  renderCards(results);
}

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', function(e){ if(e.key==='Enter'){ doSearch(); }});

// modal
const promoteBtn = document.getElementById('promoteBtn');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
promoteBtn.addEventListener('click', ()=> modal.setAttribute('aria-hidden','false'));
modalClose.addEventListener('click', ()=> modal.setAttribute('aria-hidden','true'));
modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.setAttribute('aria-hidden','true'); });

// submit form
document.getElementById('adForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const nome = document.getElementById('f_nome').value.trim();
  const endereco = document.getElementById('f_endereco').value.trim();
  const bairro = document.getElementById('f_bairro').value.trim();
  const cidade = document.getElementById('f_cidade').value.trim();
  const telefone = document.getElementById('f_telefone').value.trim();
  const whatsapp = document.getElementById('f_whatsapp').value.trim();
  const email = document.getElementById('f_email').value.trim();
  const descricao = document.getElementById('f_descricao').value.trim();
  const imagemFile = document.getElementById('f_imagem').files[0];

  if(!nome || !endereco || !bairro || !cidade){
    alert('Preencha os campos obrigatórios: nome, endereço, bairro e cidade.');
    return;
  }

  const imgBase64 = await fileToBase64(imagemFile);

  const data = {
    nome, endereco, bairro, cidade, telefone, whatsapp, email, descricao,
    imagem: imgBase64 || null,
    categoria: document.getElementById('categorySelect').value || '',
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('cadastros').add(data).then(async ()=>{
    if(typeof FORM_SUBMIT_URL !== 'undefined' && FORM_SUBMIT_URL){
      try{
        await fetch(FORM_SUBMIT_URL, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(data)
        });
      }catch(e){
        console.warn('FormSubmit failed', e);
      }
    }
    modal.setAttribute('aria-hidden','true');
    const toast = document.getElementById('toast');
    toast.style.display='block';
    setTimeout(()=> toast.style.display='none', 3000);
    document.getElementById('adForm').reset();
    alert('Cadastro enviado e salvo como pendente. Você receberá no painel admin.');
  }).catch(e=>{
    alert('Erro ao enviar: '+e.message);
  });
});

// local save for testing
document.getElementById('saveLocal').addEventListener('click', function(){
  const data = {};
  new FormData(document.getElementById('adForm')).forEach((v,k)=> data[k]=v);
  let list = JSON.parse(localStorage.getItem('guia1_local')||'[]');
  data.id = Date.now();
  list.push(data);
  localStorage.setItem('guia1_local', JSON.stringify(list));
  alert('Cadastro salvo localmente. (Apenas para testes)');
});
