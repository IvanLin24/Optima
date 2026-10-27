const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 7v12a2 2 0 0 0 2 2h14V7M20 11h-6v6h6"/><path d="M16 14h.01"/>',
  arrows: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  doc: '<path d="M14 3H6v18h12V7l-4-4v5h4M9 12h6M9 16h5"/>',
  bag: '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2M8 12h.01M16 12h.01"/>',
  chart: '<path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 2.2M12 17h.01"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="m12 5-7 7 7 7M5 12h15"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/>',
  spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.doc}</svg>`;
// Original vector product illustrations, not third-party product photographs.
export function productArt(type) {
  const shapes = {
    paper: '<path d="m22 44 43-18 35 18-43 20Z" fill="#dce4ee"/><path d="M22 44v26l35 20V64Z" fill="#f7f9fc"/><path d="m57 64 43-20v26L57 90Z" fill="#cad8e9"/><path d="m22 50 35 20 43-20M22 56l35 20 43-20M22 62l35 20 43-20" fill="none" stroke="#b4c5da" stroke-width="1"/><path d="m22 39 43-19 35 19-43 20Z" fill="white"/><path d="m43 42 22-10 16 8-23 10Z" fill="#0062ff"/><path d="m48 43 12 6 16-8" fill="none" stroke="#9bc4ff" stroke-width="2"/>',
    box: '<path d="m25 45 36-18 35 17-36 20Z" fill="#d9b28b"/><path d="M25 45v36l35 19V64Z" fill="#c79b72"/><path d="m60 64 36-20v37l-36 19Z" fill="#ae7d53"/><path d="m43 36 36 18v16l-9 5V59L34 41Z" fill="#ead2b3"/><path d="m70 86 15-8" stroke="#e7caae" stroke-width="2"/>',
    soap: '<path d="M47 22h26v16H47Z" fill="#3c7382"/><path d="M45 35h29l14 16v44H33V51Z" fill="#c9e1de"/><path d="M48 39h12v12H44v-6Z" fill="#eff8f6"/><rect x="40" y="59" width="41" height="27" rx="3" fill="#fff"/><path d="M50 70h20M50 76h12" stroke="#488878" stroke-width="3"/>',
    tape: '<ellipse cx="60" cy="62" rx="35" ry="24" fill="#d4b989"/><path d="M25 62v19c0 14 70 14 70 0V62c0 27-70 27-70 0Z" fill="#b99b6c"/><ellipse cx="60" cy="62" rx="18" ry="12" fill="#f5f3eb"/><path d="M42 62c0 12 36 12 36 0v9c-4 9-32 9-36 0Z" fill="#dedbd3"/>',
  };
  return `<svg class="product-art" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="98" rx="36" ry="5" fill="#17355a" opacity=".07"/>${shapes[type]}</svg>`;
}
