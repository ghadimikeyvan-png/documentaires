(() => {
  const SUPABASE_URL = 'https://xokiycckptplwmfshotg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lWJw8jIYgg6pOXyWh4QS2w_uYyJvNT5';
  const SITE_URL = 'https://ghadimikeyvan-png.github.io/documentaires/';
  const IRAN_SLUG = 'mon-pere-iran-et-moi';
  let client, user, iranProject, missionProject, timers = {};

  const q = s => document.querySelector(s);
  const parse = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; } };
  const status = (msg, bad=false) => { const el=q('#cloudStatus'); if(el){ el.textContent=msg; el.classList.toggle('bad',bad); } };

  function localIran(){ return {main:parse('mpi_v5_data', parse('mpi_v4_data', window.SEED_DATA || {festivals:[],contacts:[]})), film:parse('mpi_v4_film',{}), assets:parse('mpi_assets',[])}; }
  function localMission(){ return parse('mission_locale_v7',{dossier:{url:'',updated:''},residences:[],tasks:[],events:[]}); }
  function writeIran(v){ if(v?.main)localStorage.setItem('mpi_v5_data',JSON.stringify(v.main)); if(v?.film)localStorage.setItem('mpi_v4_film',JSON.stringify(v.film)); if(v?.assets)localStorage.setItem('mpi_assets',JSON.stringify(v.assets)); }
  function writeMission(v){ if(v)localStorage.setItem('mission_locale_v7',JSON.stringify(v)); }

  async function ensureProjects(){
    let {data:ps,error}=await client.from('projects').select('*'); if(error) throw error;
    iranProject=ps.find(p=>p.slug===IRAN_SLUG);
    if(!iranProject){ const r=await client.from('projects').insert({name:'Mon père, l’Iran et moi',slug:IRAN_SLUG,created_by:user.id}).select().single(); if(r.error) throw r.error; iranProject=r.data; }
    const mslug='mission-locale-'+user.id;
    missionProject=ps.find(p=>p.slug===mslug);
    if(!missionProject){ const r=await client.from('projects').insert({name:'Mission Locale',slug:mslug,created_by:user.id}).select().single(); if(r.error) throw r.error; missionProject=r.data; }
  }

  async function hydrateRecord(project,id,localValue,writer){
    const r=await client.from('records').select('data').eq('project_id',project.id).eq('id',id).maybeSingle(); if(r.error) throw r.error;
    if(r.data?.data){ writer(r.data.data); return 'cloud'; }
    const ins=await client.from('records').insert({id,project_id:project.id,type:'app_state',data:localValue,created_by:user.id,updated_by:user.id}); if(ins.error) throw ins.error;
    return 'local';
  }

  async function bootstrap(){
    status('Connexion…');
    await ensureProjects();
    await hydrateRecord(iranProject,'iran-main',localIran(),writeIran);
    await hydrateRecord(missionProject,'mission-'+user.id,localMission(),writeMission);
    sessionStorage.setItem('mpi_cloud_ready','1');
    sessionStorage.setItem('mpi_cloud_user',user.email||'');
    if(!sessionStorage.getItem('mpi_cloud_reloaded')){ sessionStorage.setItem('mpi_cloud_reloaded','1'); location.reload(); return; }
    status('Synchronisé');
    const email=q('#cloudUser'); if(email) email.textContent=user.email||'Connecté';
    q('#authGate')?.classList.add('hidden');
  }

  async function upsertIran(){ if(!user||!iranProject)return; status('Enregistrement…'); const r=await client.from('records').upsert({id:'iran-main',project_id:iranProject.id,type:'app_state',data:localIran(),created_by:user.id,updated_by:user.id,updated_at:new Date().toISOString()}); status(r.error?'Erreur de synchro':'Synchronisé',!!r.error); if(r.error) console.error(r.error); }
  async function upsertMission(){ if(!user||!missionProject)return; status('Enregistrement…'); const r=await client.from('records').upsert({id:'mission-'+user.id,project_id:missionProject.id,type:'app_state',data:localMission(),created_by:user.id,updated_by:user.id,updated_at:new Date().toISOString()}); status(r.error?'Erreur de synchro':'Synchronisé',!!r.error); if(r.error) console.error(r.error); }
  function debounce(which,fn){ clearTimeout(timers[which]); timers[which]=setTimeout(fn,450); }

  window.cloudSync={scheduleIran:()=>debounce('iran',upsertIran),scheduleMission:()=>debounce('mission',upsertMission),flushIran:upsertIran,flushMission:upsertMission};

  function installPasswordUI(){
    const loginForm=q('#loginForm');
    if(!loginForm || q('#forgotPasswordBtn')) return;

    const forgot=document.createElement('button');
    forgot.type='button';
    forgot.id='forgotPasswordBtn';
    forgot.className='secondary';
    forgot.textContent='Mot de passe oublié ?';
    forgot.style.cssText='width:100%;margin-top:10px';
    const err=q('#authError');
    loginForm.insertBefore(forgot,err);

    const reset=document.createElement('form');
    reset.id='resetPasswordForm';
    reset.className='auth-card hidden';
    reset.innerHTML=`
      <div class="auth-mark">MP</div>
      <h2>Nouveau mot de passe</h2>
      <p>Choisis ton nouveau mot de passe.</p>
      <label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>Confirmer<input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="primary" type="submit">Enregistrer le nouveau mot de passe</button>
      <div id="resetPasswordError" class="auth-error"></div>
    `;
    q('#authGate')?.appendChild(reset);

    forgot.onclick=async()=>{
      const email=loginForm.querySelector('input[name="email"]')?.value?.trim();
      const authError=q('#authError');
      if(!email){ authError.textContent='Entre d’abord ton adresse email.'; return; }
      forgot.disabled=true;
      authError.textContent='Envoi du mail…';
      const r=await client.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL});
      forgot.disabled=false;
      authError.textContent=r.error
        ? 'Impossible d’envoyer le mail : '+r.error.message
        : 'Si ce compte existe, un email de réinitialisation vient d’être envoyé. Regarde aussi dans les spams.';
    };

    reset.onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(reset);
      const p=String(fd.get('password')||'');
      const c=String(fd.get('confirm')||'');
      const msg=q('#resetPasswordError');
      if(p.length<8){ msg.textContent='Choisis au moins 8 caractères.'; return; }
      if(p!==c){ msg.textContent='Les deux mots de passe ne correspondent pas.'; return; }
      msg.textContent='Enregistrement…';
      const r=await client.auth.updateUser({password:p});
      if(r.error){ msg.textContent='Impossible de modifier le mot de passe : '+r.error.message; return; }
      msg.textContent='Mot de passe modifié. Tu peux maintenant te reconnecter.';
      setTimeout(async()=>{ await client.auth.signOut(); location.href=SITE_URL; },900);
    };
  }

  function showPasswordRecovery(){
    installPasswordUI();
    q('#authGate')?.classList.remove('hidden');
    q('#loginForm')?.classList.add('hidden');
    q('#resetPasswordForm')?.classList.remove('hidden');
    status('Réinitialisation du mot de passe');
  }

  async function init(){
    if(!window.supabase){ q('#authError').textContent='Impossible de charger Supabase. Vérifie ta connexion Internet.'; return; }
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    installPasswordUI();

    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        user=session?.user||null;
        setTimeout(showPasswordRecovery,0);
      }
    });

    const {data}=await client.auth.getSession(); user=data.session?.user||null;
    const recoveryInUrl = location.hash.includes('type=recovery') || new URLSearchParams(location.search).get('type')==='recovery';
    if(recoveryInUrl){ showPasswordRecovery(); }
    else if(user){ try{ await bootstrap(); }catch(e){ console.error(e); q('#authGate')?.classList.remove('hidden'); q('#authError').textContent=e.message||String(e); } }
    else { q('#authGate')?.classList.remove('hidden'); }

    q('#loginForm').onsubmit=async e=>{
      e.preventDefault();
      q('#authError').textContent='';
      const fd=new FormData(e.target);
      const r=await client.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')});
      if(r.error){q('#authError').textContent='Connexion impossible : '+r.error.message;return;}
      user=r.data.user;
      sessionStorage.removeItem('mpi_cloud_reloaded');
      await bootstrap();
    };
    const change=q('#changePasswordBtn');
    if(change){
      change.onclick=async()=>{
        const p=prompt('Nouveau mot de passe :');
        if(p===null) return;
        if(p.length<8){ alert('Le mot de passe doit contenir au moins 8 caractères.'); return; }
        const c=prompt('Confirme le nouveau mot de passe :');
        if(c===null) return;
        if(p!==c){ alert('Les deux mots de passe ne correspondent pas.'); return; }
        change.disabled=true;
        change.textContent='Enregistrement…';
        const rr=await client.auth.updateUser({password:p});
        change.disabled=false;
        change.textContent='Changer mon mot de passe';
        if(rr.error){ alert('Erreur : '+rr.error.message); return; }
        alert('Mot de passe modifié.');
      };
    }
    q('#logoutBtn').onclick=async()=>{ await client.auth.signOut(); sessionStorage.clear(); location.reload(); };
  }
  addEventListener('DOMContentLoaded',init);
})();
