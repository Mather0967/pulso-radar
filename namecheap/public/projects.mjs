const error=document.querySelector('#portal-error');
let csrf='',users=[];
async function request(path,method='GET',body) {
  const response=await fetch(path,{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-CSRF-Token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.status===401){location.assign('/login');throw Error('La sesión venció.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo completar la solicitud.');return data;
}
try {
  const me=await request('/auth/me');csrf=me.csrf;
  document.querySelector('#logout').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;
    try{await request('/auth/logout','POST',{});location.assign('/login');}
    catch(e){error.textContent=e.message;event.target.disabled=false;}
  });
  const form=document.querySelector('#grants-form');
  if(form){
    const result=await request('/api/admin/users');users=result.users;
    const select=form.elements.id;select.replaceChildren(new Option('Seleccionar usuario',''));
    users.forEach(user=>select.add(new Option(`${user.name} · ${user.email}${user.active?'':' (inactivo)'}`,user.id)));
    const choose=()=>{
      const user=users.find(u=>u.id===select.value),admin=user?.role==='admin';
      for(const project of ['pulso','landur']){form.elements[project].value=admin?'editor':user?.projects?.[project]||'';form.elements[project].disabled=!user||admin;}
      form.querySelector('[type=submit]').disabled=!user||admin;
      document.querySelector('#grants-status').textContent=admin?'Los administradores tienen edición en ambos proyectos. Para cambiar su rol, usá Administración.':user&&!user.active?'El usuario está inactivo. Asignar permisos no lo reactiva.':'';
    };
    select.addEventListener('change',choose);choose();
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
      try {
        const projects=Object.fromEntries(['pulso','landur'].map(key=>[key,form.elements[key].value||null]));
        const saved=await request('/api/admin/project-access','PUT',{id:select.value,projects});
        users.find(u=>u.id===select.value).projects=saved.projects;
        document.querySelector('#grants-status').textContent='Permisos guardados. El usuario deberá volver a iniciar sesión.';
      }catch(e){document.querySelector('#grants-status').textContent=e.message;}
      finally{button.disabled=false;}
    });
  }
}catch(e){error.textContent=e.message;}
// Never restore personalized project/permission HTML from back-forward cache.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
