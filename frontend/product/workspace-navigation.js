export function workspaceNavigation(role){
 return role==='supplier'
  ?[['supplier','Заказы','bag'],['products','Товары','grid'],['offers','Предложения','file'],['messages','Сообщения','chat'],['documents','Документы','file']]
  :[['overview','Обзор','home'],['purchases','Закупки','bag'],['needs','Потребности','grid'],['messages','Сообщения','chat'],['documents','Документы','file']];
}
export function activeWorkspaceRoute(page,role){
 return ['tasks','analytics','district'].includes(page)?(role==='supplier'?'supplier':'overview'):page;
}
