import { safeProductImage } from './supplier-model.js';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 sort:'<path d="M4 6h10M4 11h7M4 16h4M18 5v15m-3-3 3 3 3-3"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 home:'<path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',bag:'<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',chat:'<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1-7a8 8 0 1 1 17-4Z"/><path d="M8 10h8M8 14h5"/>',file:'<path d="M14 3H6v18h12V7l-4-4v5h4M9 12h6M9 16h6"/>',chart:'<path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',down:'<path d="m6 9 6 6 6-6"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',clip:'<path d="m9 14 7-7a3 3 0 0 1 4 4L10 21a5 5 0 0 1-7-7L14 3"/>',send:'<path d="m12 4-7 7m7-7 7 7M12 4v16"/>',star:'<path d="m12 3 3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',exit:'<path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
};
export const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;
export const btn=(label,action,kind='primary',extra='')=>`<button class="button ${kind}" data-action="${action}" ${extra}>${label}</button>`;
export const routeLink=(label,route,cls='text-link')=>`<a href="#${route}" class="${cls}">${label}</a>`;
export const tag=(text,kind='neutral')=>`<span class="tag ${kind}">${text}</span>`;
export const avatar=(name,kind='')=>`<span class="avatar ${kind}">${esc(name)}</span>`;
// One media slot for any product. A future API can provide the photo URL.
export function productMedia({src='',alt='Фотография товара',size='small'}={}){
 const safe=typeof src==='string'&&(/^(https?:\/\/|blob:)/i.test(src)||/^\/(?!\/)/.test(src)||Boolean(safeProductImage(src)));
 const placeholder='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="4"/><circle cx="12" cy="12" r="2"/><path d="m7 24 7-8 4 4 3-3 4 7"/></svg>';
 return `<span class="product-media product-media--${size==='large'?'large':'small'}" ${safe?'':`role="img" aria-label="${esc(alt)} — фото пока нет"`}>${safe?`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`:placeholder}</span>`;
}

export const pageHead=(title,desc='',action='')=>`<div class="page-heading"><div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div>${action}</div>`;
export const empty=(title,text,action='')=>`<div class="empty-state"><div class="empty-mark">${icon('bag',28)}</div><h2>${title}</h2><p>${text}</p>${action}</div>`;
