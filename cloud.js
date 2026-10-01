(() => {
  const SUPABASE_URL = 'https://xokiycckptplwmfshotg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lWJw8jIYgg6pOXyWh4QS2w_uYyJvNT5';
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
    const a=await hydrateRecord(iranProject,'iran-main',localIran(),writeIran);
    const b=await hydrateRecord(missionProject,'mission-'+user.id,localMission(),writeMission);
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

  async function init(){
    if(!window.supabase){ q('#authError').textContent='Impossible de charger Supabase. Vérifie ta connexion Internet.'; return; }
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    const {data}=await client.auth.getSession(); user=data.session?.user||null;
    if(user){ try{ await bootstrap(); }catch(e){ console.error(e); q('#authGate')?.classList.remove('hidden'); q('#authError').textContent=e.message||String(e); } }
    else { q('#authGate')?.classList.remove('hidden'); }
    q('#loginForm').onsubmit=async e=>{ e.preventDefault(); q('#authError').textContent=''; const fd=new FormData(e.target); const r=await client.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')}); if(r.error){q('#authError').textContent='Connexion impossible : '+r.error.message;return;} user=r.data.user; sessionStorage.removeItem('mpi_cloud_reloaded'); await bootstrap(); };
    q('#logoutBtn').onclick=async()=>{ await client.auth.signOut(); sessionStorage.clear(); location.reload(); };
  }
  addEventListener('DOMContentLoaded',init);
})();
