const state = { clients: [], budgets: [] }
function uid() { return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) }
function load() {
  const c = localStorage.getItem("clients")
  const b = localStorage.getItem("budgets")
  state.clients = c ? JSON.parse(c) : []
  state.budgets = b ? JSON.parse(b) : []
}
function save() {
  localStorage.setItem("clients", JSON.stringify(state.clients))
  localStorage.setItem("budgets", JSON.stringify(state.budgets))
}
function fmt(n) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n) }
function isAuthenticated() { return !!localStorage.getItem("currentUser") }
function tab(id) {
  document.querySelectorAll(".tab").forEach(e => e.classList.add("hidden"))
  document.getElementById(id).classList.remove("hidden")
  document.querySelectorAll(".tab-btn").forEach(b => { b.classList.toggle("active", b.dataset.tab === id) })
}
function mountTabs() { document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => { if (!isAuthenticated()) { document.getElementById("login-modal").classList.remove("hidden"); return } tab(b.dataset.tab) })) }
function clearClientForm() { ["cl-nomeCompleto", "cl-cpf", "cl-rg", "cl-nomeEmpresa", "cl-cnpj", "cl-nomeResponsavel", "cl-telefone", "cl-email", "cl-endereco"].forEach(id => document.getElementById(id).value = "") }
function readClientForm() {
  const tipo = document.getElementById("cl-tipo").value
  const data = {
    id: uid(),
    tipo,
    nomeCompleto: tipo === "PF" ? document.getElementById("cl-nomeCompleto").value || null : null,
    cpf: tipo === "PF" ? document.getElementById("cl-cpf").value || null : null,
    rg: tipo === "PF" ? document.getElementById("cl-rg").value || null : null,
    nomeEmpresa: tipo === "PJ" ? document.getElementById("cl-nomeEmpresa").value || null : null,
    cnpj: tipo === "PJ" ? document.getElementById("cl-cnpj").value || null : null,
    nomeResponsavel: tipo === "PJ" ? document.getElementById("cl-nomeResponsavel").value || null : null,
    telefone: document.getElementById("cl-telefone").value || "",
    email: document.getElementById("cl-email").value || "",
    endereco: document.getElementById("cl-endereco").value || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  return data
}
function validateClientRequired(d) {
  if (d.tipo === "PF") return d.nomeCompleto && d.cpf && d.rg && d.telefone && d.email && d.endereco
  return d.nomeEmpresa && d.cnpj && d.nomeResponsavel && d.telefone && d.email && d.endereco
}
function addClient() {
  const d = readClientForm()
  if (!validateClientRequired(d)) { toast("Preencha todos os campos obrigatórios"); return }
  if (d.tipo === "PF" && d.cpf) { if (state.clients.find(c => c.cpf === d.cpf)) { toast("CPF em uso"); return } }
  if (d.tipo === "PJ" && d.cnpj) { if (state.clients.find(c => c.cnpj === d.cnpj)) { toast("CNPJ em uso"); return } }
  state.clients.push(d); save(); clearClientForm(); renderClients(); renderClientOptions(); toast("Cliente salvo")
}
function removeClient(id) {
  if (!confirm("Confirma excluir o cliente e seus orçamentos?")) return
  state.clients = state.clients.filter(c => c.id !== id)
  state.budgets = state.budgets.filter(b => b.clientId !== id)
  save(); renderClients(); renderBudgets(); renderClientOptions(); toast("Cliente excluído")
}
function renderClients() {
  const q = document.getElementById("cl-q").value
  const cpf = document.getElementById("cl-fcpf").value
  const cnpj = document.getElementById("cl-fcnpj").value
  let list = [...state.clients]
  if (q) list = list.filter(c => (c.nomeCompleto || "").toLowerCase().includes(q.toLowerCase()) || (c.nomeEmpresa || "").toLowerCase().includes(q.toLowerCase()))
  if (cpf) list = list.filter(c => c.cpf === cpf)
  if (cnpj) list = list.filter(c => c.cnpj === cnpj)
  const tbody = document.getElementById("cl-lista"); tbody.innerHTML = ""
  list.forEach(c => {
    const tr = document.createElement("tr")
    const idText = c.tipo === "PF" ? (c.nomeCompleto || "") + " | CPF " + (c.cpf || "") : (c.nomeEmpresa || "") + " | CNPJ " + (c.cnpj || "")
    const contato = (c.telefone || "") + " • " + (c.email || "")
    tr.innerHTML = `<td>${c.tipo}</td><td>${idText}</td><td>${contato}</td><td><button data-id="${c.id}" class="btn btn-secondary cl-del">Excluir</button> <button data-id="${c.id}" class="btn btn-secondary cl-hist">Ver histórico</button></td>`
    tbody.appendChild(tr)
  })
  tbody.querySelectorAll(".cl-del").forEach(b => b.addEventListener("click", () => removeClient(b.dataset.id)))
  tbody.querySelectorAll(".cl-hist").forEach(b => b.addEventListener("click", () => { document.getElementById("db-client").value = b.dataset.id; document.getElementById("bu-client").value = b.dataset.id; tab("orcamentos"); renderBudgets() }))
}
function renderClientOptions() {
  const sel = document.getElementById("bu-client"); const s2 = document.getElementById("db-client")
  sel.innerHTML = ""; s2.innerHTML = `<option value="">Todos</option>`
  state.clients.forEach(c => {
    const opt = document.createElement("option"); opt.value = c.id; opt.textContent = c.tipo === "PF" ? c.nomeCompleto || "" : c.nomeEmpresa || ""; sel.appendChild(opt)
    const o2 = document.createElement("option"); o2.value = c.id; o2.textContent = opt.textContent; s2.appendChild(o2)
  })
}
function addItemRow() {
  const tbody = document.getElementById("bu-items")
  const tr = document.createElement("tr")
  tr.innerHTML = `<td><input class="it-desc"></td><td><input type="number" min="1" value="1" class="it-qty"></td><td><input type="number" min="0" step="0.01" value="0" class="it-unit"></td><td class="it-total">R$ 0,00</td><td><button class="btn btn-secondary it-rm">✕</button></td>`
  tbody.appendChild(tr)
  tr.querySelector(".it-qty").addEventListener("input", calcItemsTotal)
  tr.querySelector(".it-unit").addEventListener("input", calcItemsTotal)
  tr.querySelector(".it-rm").addEventListener("click", () => { tr.remove(); calcItemsTotal() })
  calcItemsTotal()
}
function readItems() {
  const rows = [...document.querySelectorAll("#bu-items tr")]
  return rows.map(r => {
    const descricao = r.querySelector(".it-desc").value || ""
    const quantidade = Number(r.querySelector(".it-qty").value || "0")
    const valorUnit = Number(r.querySelector(".it-unit").value || "0")
    const valorTotal = quantidade * valorUnit
    return { descricao, quantidade, valorUnit, valorTotal }
  })
}
function calcItemsTotal() {
  const items = readItems()
  document.querySelectorAll("#bu-items tr").forEach((r, i) => { const t = r.querySelector(".it-total"); t.textContent = fmt(items[i].valorTotal) })
  const total = items.reduce((s, i) => s + i.valorTotal, 0)
  document.getElementById("bu-total").textContent = `Total: ${fmt(total)}`
}
function nextSeqForClient(clientId) { const list = state.budgets.filter(b => b.clientId === clientId); return list.length + 1 }
function saveBudget() {
  const clientId = document.getElementById("bu-client").value
  if (!clientId) { toast("Selecione um cliente"); return }
  const items = readItems().filter(i => i.descricao && i.quantidade > 0)
  if (items.length === 0) { toast("Adicione ao menos um item"); return }
  const seq = nextSeqForClient(clientId)
  const chave = `${clientId}-${seq}`
  const total = items.reduce((s, i) => s + i.valorTotal, 0)
  const now = new Date().toISOString()
  const b = { id: uid(), clientId, numeroSequencial: seq, numeroSequencialChave: chave, dataCriacao: now, status: "PENDENTE", nfNumero: null, pedidoCompraNumero: null, totalGeral: total, items, createdAt: now, updatedAt: now }
  state.budgets.push(b); save(); document.getElementById("bu-items").innerHTML = ""; calcItemsTotal(); renderBudgets(); toast("Orçamento salvo")
}
function duplicateBudget(id) {
  const orig = state.budgets.find(b => b.id === id); if (!orig) return
  const seq = nextSeqForClient(orig.clientId)
  const chave = `${orig.clientId}-${seq}`
  const now = new Date().toISOString()
  const b = { ...orig, id: uid(), numeroSequencial: seq, numeroSequencialChave: chave, status: "PENDENTE", nfNumero: null, pedidoCompraNumero: null, createdAt: now, updatedAt: now }
  state.budgets.push(b); save(); renderBudgets(); toast("Orçamento duplicado")
}
function deleteBudget(id) {
  if (!confirm("Confirma excluir?")) return
  state.budgets = state.budgets.filter(b => b.id !== id); save(); renderBudgets(); toast("Orçamento excluído")
}
function setStatus(id) {
  const b = state.budgets.find(x => x.id === id); if (!b) return
  const status = prompt("Status: PENDENTE, APROVADO ou REALIZADO", b.status || "PENDENTE"); if (!status) return
  if (status === "REALIZADO") {
    const nf = prompt("Número da NF", b.nfNumero || ""); const pc = prompt("Número do pedido de compra", b.pedidoCompraNumero || "")
    if (!nf || !pc) { toast("Campos obrigatórios para REALIZADO"); return }
    b.nfNumero = nf; b.pedidoCompraNumero = pc
  } else { b.nfNumero = null; b.pedidoCompraNumero = null }
  b.status = status; b.updatedAt = new Date().toISOString(); save(); renderBudgets(); toast("Status atualizado")
}
function sortBudgets(list) {
  const mode = document.getElementById("bu-sort").value
  const byClient = (b) => { const c = state.clients.find(x => x.id === b.clientId); return c ? (c.tipo === "PF" ? (c.nomeCompleto || "") : (c.nomeEmpresa || "")) : "" }
  if (mode === "dataAsc") list.sort((a, b) => new Date(a.dataCriacao) - new Date(b.dataCriacao))
  else if (mode === "valorDesc") list.sort((a, b) => b.totalGeral - a.totalGeral)
  else if (mode === "valorAsc") list.sort((a, b) => a.totalGeral - b.totalGeral)
  else if (mode === "clienteAsc") list.sort((a, b) => byClient(a).localeCompare(byClient(b)))
  else if (mode === "clienteDesc") list.sort((a, b) => byClient(b).localeCompare(byClient(a)))
  else list.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao))
  return list
}
function renderBudgets() {
  const q = document.getElementById("bu-q").value
  const cpf = document.getElementById("bu-fcpf").value
  const cnpj = document.getElementById("bu-fcnpj").value
  const d = document.getElementById("bu-fdate").value
  const sd = document.getElementById("bu-fstart").value
  const ed = document.getElementById("bu-fend").value
  const m = document.getElementById("bu-fmonth").value
  const y = document.getElementById("bu-fyear").value
  const status = document.getElementById("bu-fstatus").value
  let list = [...state.budgets]
  if (status) list = list.filter(b => b.status === status)
  function inRange(dt) {
    const x = new Date(dt)
    if (d) { const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(d); e.setHours(23, 59, 59, 999); return x >= s && x <= e }
    if (sd) { const s = new Date(sd); if (ed) { const e = new Date(ed); return x >= s && x <= e } return x >= s }
    if (ed) { const e = new Date(ed); return x <= e }
    if (m && y) { const mm = Number(m) - 1; const yy = Number(y); const s = new Date(yy, mm, 1); const e = new Date(yy, mm + 1, 0, 23, 59, 59, 999); return x >= s && x <= e }
    if (y) { const yy = Number(y); const s = new Date(yy, 0, 1); const e = new Date(yy, 11, 31, 23, 59, 59, 999); return x >= s && x <= e }
    return true
  }
  list = list.filter(b => inRange(b.dataCriacao))
  if (q || cpf || cnpj) {
    list = list.filter(b => {
      const c = state.clients.find(x => x.id === b.clientId); if (!c) return false
      const hitQ = q ? ((c.nomeCompleto || "").toLowerCase().includes(q.toLowerCase()) || (c.nomeEmpresa || "").toLowerCase().includes(q.toLowerCase())) : true
      const hitCpf = cpf ? c.cpf === cpf : true
      const hitCnpj = cnpj ? c.cnpj === cnpj : true
      return hitQ && hitCpf && hitCnpj
    })
  }
  list = sortBudgets(list)
  const tbody = document.getElementById("bu-lista"); tbody.innerHTML = ""
  list.forEach(b => {
    const c = state.clients.find(x => x.id === b.clientId)
    const tr = document.createElement("tr")
    tr.innerHTML = `<td>${b.numeroSequencial}</td><td>${c ? c.tipo === "PF" ? c.nomeCompleto || "" : c.nomeEmpresa || "" : ""}</td><td>${new Date(b.dataCriacao).toLocaleDateString("pt-BR")}</td><td>${b.status}</td><td>${fmt(b.totalGeral)}</td><td><button class="btn btn-secondary bu-edit" data-id="${b.id}">Editar</button><button class="btn btn-secondary bu-pdf" data-id="${b.id}">PDF</button><button class="btn btn-secondary bu-dup" data-id="${b.id}">Duplicar</button><button class="btn btn-secondary bu-st" data-id="${b.id}">Status</button><button class="btn btn-secondary bu-del" data-id="${b.id}">Excluir</button></td>`
    tbody.appendChild(tr)
  })
  tbody.querySelectorAll(".bu-del").forEach(b => b.addEventListener("click", () => deleteBudget(b.dataset.id)))
  tbody.querySelectorAll(".bu-dup").forEach(b => b.addEventListener("click", () => duplicateBudget(b.dataset.id)))
  tbody.querySelectorAll(".bu-st").forEach(b => b.addEventListener("click", () => setStatus(b.dataset.id)))
  tbody.querySelectorAll(".bu-pdf").forEach(b => b.addEventListener("click", () => pdfBudget(b.dataset.id)))
  tbody.querySelectorAll(".bu-edit").forEach(b => b.addEventListener("click", () => openEdit(b.dataset.id)))
}
function pdfBudget(id) {
  const b = state.budgets.find(x => x.id === id); if (!b) { toast("Orçamento não encontrado"); return }
  const c = state.clients.find(x => x.id === b.clientId)
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const logo = localStorage.getItem("logoDataUrl")
  if (logo) { try { doc.addImage(logo, "PNG", 40, 40, 120, 60) } catch { } }
  let y = logo ? 120 : 40
  doc.setFontSize(18); doc.text("Orçamento", 300, y, { align: "center" }); y += 24
  doc.setFontSize(12); doc.text(`Número: ${b.numeroSequencial}`, 40, y); y += 18
  doc.text(`Data de emissão: ${new Date(b.dataCriacao).toLocaleDateString("pt-BR")}`, 40, y); y += 18
  doc.text(`Status: ${b.status}`, 40, y); y += 24
  if (c) {
    if (c.tipo === "PF") { doc.text(`Cliente: ${c.nomeCompleto || ""}`, 40, y); y += 18; doc.text(`CPF: ${c.cpf || ""}`, 40, y); y += 18; doc.text(`RG: ${c.rg || ""}`, 40, y); y += 18 }
    else { doc.text(`Empresa: ${c.nomeEmpresa || ""}`, 40, y); y += 18; doc.text(`CNPJ: ${c.cnpj || ""}`, 40, y); y += 18; doc.text(`Responsável: ${c.nomeResponsavel || ""}`, 40, y); y += 18 }
    doc.text(`Telefone: ${c.telefone || ""}`, 40, y); y += 18
    doc.text(`Email: ${c.email || ""}`, 40, y); y += 18
    doc.text(`Endereço: ${c.endereco || ""}`, 40, y); y += 24
  }
  doc.text("Serviços", 40, y); y += 18
  b.items.forEach(i => { doc.text(`${i.descricao}`, 40, y); y += 16; doc.text(`Qtd: ${i.quantidade}  Valor unitário: ${fmt(i.valorUnit)}  Total: ${fmt(i.valorTotal)}`, 40, y); y += 16 })
  y += 18; doc.setFontSize(14); doc.text(`Total geral: ${fmt(b.totalGeral)}`, 420, y, { align: "right" })
  const sigEnabled = localStorage.getItem("signatureEnabled") || "no"
  const sig = localStorage.getItem("signatureDataUrl")
  const sigName = localStorage.getItem("signatureName") || ""
  if (sigEnabled === "yes" && sig) {
    try {
      doc.setFontSize(12)
      doc.text("Assinatura:", 40, y + 40)
      doc.addImage(sig, "PNG", 120, y + 10, 160, 60)
      if (sigName) { doc.text(sigName, 120, y + 80) }
    } catch {}
  }
  doc.save(`orcamento-${b.numeroSequencial}.pdf`)
}
function dashboard() {
  const clientId = document.getElementById("db-client").value
  const sd = document.getElementById("db-start").value
  const ed = document.getElementById("db-end").value
  const m = document.getElementById("db-month").value
  const y = document.getElementById("db-year").value
  function inRange(dt) {
    const x = new Date(dt)
    if (m && y) { const mm = Number(m) - 1; const yy = Number(y); const s = new Date(yy, mm, 1); const e = new Date(yy, mm + 1, 0, 23, 59, 59, 999); return x >= s && x <= e }
    const s = sd ? new Date(sd) : null
    const e = ed ? new Date(ed) : null
    if (s && e) return x >= s && x <= e
    if (s) return x >= s
    if (e) return x <= e
    return true
  }
  let list = [...state.budgets]
  if (clientId) list = list.filter(b => b.clientId === clientId)
  list = list.filter(b => inRange(b.dataCriacao))
  const totalCriados = list.length
  const totalAprovados = list.filter(b => b.status === "APROVADO").length
  const totalRealizados = list.filter(b => b.status === "REALIZADO").length
  const somaValoresRealizados = list.filter(b => b.status === "REALIZADO").reduce((s, b) => s + b.totalGeral, 0)
  document.getElementById("m-criados").textContent = String(totalCriados)
  document.getElementById("m-aprovados").textContent = String(totalAprovados)
  document.getElementById("m-realizados").textContent = String(totalRealizados)
  document.getElementById("m-soma").textContent = fmt(somaValoresRealizados)
}
function toast(msg) {
  const t = document.getElementById("toast"); t.textContent = msg; t.classList.remove("hidden"); setTimeout(() => t.classList.add("hidden"), 2000)
}
function openEdit(id) {
  const b = state.budgets.find(x => x.id === id); if (!b) { toast("Orçamento não encontrado"); return }
  const modal = document.getElementById("modal"); const body = document.getElementById("modal-body")
  document.getElementById("modal-title").textContent = `Editar orçamento #${b.numeroSequencial}`
  body.innerHTML = `<div class="form-grid"><label>Status<select id="ed-status"><option ${b.status === "PENDENTE" ? "selected" : ""}>PENDENTE</option><option ${b.status === "APROVADO" ? "selected" : ""}>APROVADO</option><option ${b.status === "REALIZADO" ? "selected" : ""}>REALIZADO</option></select></label><label>Número NF<input id="ed-nf" value="${b.nfNumero || ""}"></label><label>Pedido Compra<input id="ed-pc" value="${b.pedidoCompraNumero || ""}"></label></div><div class="table-wrap"><table class="items"><thead><tr><th>Descrição</th><th>Qtd</th><th>Unit</th><th>Total</th></tr></thead><tbody id="ed-items"></tbody></table></div>`
  const tbody = document.getElementById("ed-items"); tbody.innerHTML = ""
  b.items.forEach(i => { const tr = document.createElement("tr"); tr.innerHTML = `<td><input class="ed-desc" value="${i.descricao}"></td><td><input type="number" min="1" value="${i.quantidade}" class="ed-qty"></td><td><input type="number" min="0" step="0.01" value="${i.valorUnit}" class="ed-unit"></td><td class="ed-total"></td>`; tbody.appendChild(tr) })
  function recalc() { [...document.querySelectorAll("#ed-items tr")].forEach(tr => { const q = Number(tr.querySelector(".ed-qty").value || "0"); const u = Number(tr.querySelector(".ed-unit").value || "0"); tr.querySelector(".ed-total").textContent = fmt(q * u) }) }
  recalc(); modal.classList.remove("hidden")
  document.getElementById("modal-cancel").onclick = () => { modal.classList.add("hidden") }
  document.getElementById("modal-save").onclick = () => {
    const status = document.getElementById("ed-status").value
    const nf = document.getElementById("ed-nf").value || null
    const pc = document.getElementById("ed-pc").value || null
    if (status === "REALIZADO" && (!nf || !pc)) { toast("NF e Pedido são obrigatórios para REALIZADO"); return }
    const items = [...document.querySelectorAll("#ed-items tr")].map(tr => {
      const d = tr.querySelector(".ed-desc").value || ""
      const q = Number(tr.querySelector(".ed-qty").value || "0")
      const u = Number(tr.querySelector(".ed-unit").value || "0")
      return { descricao: d, quantidade: q, valorUnit: u, valorTotal: q * u }
    }).filter(i => i.descricao && i.quantidade > 0)
    if (items.length === 0) { toast("Adicione ao menos um item"); return }
    b.items = items
    b.totalGeral = items.reduce((s, i) => s + i.valorTotal, 0)
    b.status = status
    b.nfNumero = status === "REALIZADO" ? nf : null
    b.pedidoCompraNumero = status === "REALIZADO" ? pc : null
    b.updatedAt = new Date().toISOString()
    save(); renderBudgets(); toast("Orçamento atualizado"); modal.classList.add("hidden")
  }
}
function dashboardBind() { document.getElementById("db-atualizar").addEventListener("click", dashboard) }
function cfgBind() {
  document.getElementById("cfg-export").addEventListener("click", () => {
    const data = { clients: state.clients, budgets: state.budgets, users: JSON.parse(localStorage.getItem("users") || "[]"), logo: localStorage.getItem("logoDataUrl") || null }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `backup-${new Date().toISOString().slice(0, 19)}.json`; a.click()
  })
  document.getElementById("cfg-import").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      state.clients = data.clients || []
      state.budgets = data.budgets || []
      localStorage.setItem("users", JSON.stringify(data.users || []))
      if (data.logo) localStorage.setItem("logoDataUrl", data.logo)
      save(); renderClients(); renderClientOptions(); renderBudgets(); dashboard(); toast("Backup importado")
    } catch { toast("Falha ao importar") }
  })
  document.getElementById("cfg-logo").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { localStorage.setItem("logoDataUrl", reader.result); toast("Logotipo salvo") }
    reader.readAsDataURL(file)
  })
  document.getElementById("cfg-signature").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { localStorage.setItem("signatureDataUrl", reader.result); toast("Assinatura salva") }
    reader.readAsDataURL(file)
  })
  document.getElementById("cfg-signature-name").addEventListener("input", e => {
    localStorage.setItem("signatureName", e.target.value || "")
  })
  document.getElementById("cfg-signature-enabled").addEventListener("change", e => {
    localStorage.setItem("signatureEnabled", e.target.value)
  })
}
function authInit() {
  const users = JSON.parse(localStorage.getItem("users") || "[]")
  if (users.length === 0) { localStorage.setItem("users", JSON.stringify([{ id: uid(), user: "admin", pass: "admin" }])) }
  const info = document.getElementById("user-info")
  const btnLogin = document.getElementById("btn-login")
  const btnLogout = document.getElementById("btn-logout")
  function update() {
    const u = localStorage.getItem("currentUser")
    if (u) { info.textContent = `Conectado: ${u}`; btnLogin.classList.add("hidden"); btnLogout.classList.remove("hidden") }
    else { info.textContent = "Não autenticado"; btnLogin.classList.remove("hidden"); btnLogout.classList.add("hidden") }
  }
  update()
  btnLogin.onclick = () => { document.getElementById("login-modal").classList.remove("hidden"); document.body.classList.add("modal-open") }
  btnLogout.onclick = () => { localStorage.removeItem("currentUser"); update(); toast("Sessão encerrada") }
  document.getElementById("auth-cancel").onclick = () => { document.getElementById("login-modal").classList.add("hidden"); document.body.classList.remove("modal-open") }
  document.getElementById("auth-login").onclick = () => {
    const u = (document.getElementById("auth-user").value || "").trim()
    const p = (document.getElementById("auth-pass").value || "").trim()
    if (!u || !p) { toast("Informe usuário e senha"); return }
    const ok = JSON.parse(localStorage.getItem("users")).find(x => x.user === u && x.pass === p)
    if (ok) { localStorage.setItem("currentUser", u); document.getElementById("login-modal").classList.add("hidden"); document.body.classList.remove("modal-open"); update(); toast("Autenticado") }
    else { toast("Credenciais inválidas") }
  }
  document.getElementById("auth-signup-open").onclick = () => { document.getElementById("login-modal").classList.add("hidden"); document.getElementById("signup-modal").classList.remove("hidden") }
  document.getElementById("signup-cancel").onclick = () => { document.getElementById("signup-modal").classList.add("hidden"); document.body.classList.remove("modal-open") }
  document.getElementById("signup-create").onclick = () => {
    const u = (document.getElementById("signup-user").value || "").trim()
    const p = (document.getElementById("signup-pass").value || "").trim()
    const c = (document.getElementById("signup-confirm").value || "").trim()
    if (!u || !p || !c) { toast("Preencha usuário e senha"); return }
    if (p !== c) { toast("Senhas não conferem"); return }
    const users2 = JSON.parse(localStorage.getItem("users") || "[]")
    if (users2.find(x => x.user === u)) { toast("Usuário já existe"); return }
    users2.push({ id: uid(), user: u, pass: p, createdAt: new Date().toISOString() })
    localStorage.setItem("users", JSON.stringify(users2))
    localStorage.setItem("currentUser", u)
    document.getElementById("signup-modal").classList.add("hidden"); document.body.classList.remove("modal-open")
    update(); toast("Conta criada e sessão iniciada")
  }
}
function requireAuth(fn) { return () => { if (!isAuthenticated()) { document.getElementById("login-modal").classList.remove("hidden"); return } fn() } }
function bind() {
  document.getElementById("cl-salvar").addEventListener("click", requireAuth(addClient))
  document.getElementById("cl-limpar").addEventListener("click", clearClientForm)
  document.getElementById("cl-filtrar").addEventListener("click", renderClients)
  document.getElementById("bu-add-item").addEventListener("click", requireAuth(addItemRow))
  document.getElementById("bu-salvar").addEventListener("click", requireAuth(saveBudget))
  document.getElementById("bu-filtrar").addEventListener("click", renderBudgets)
  document.getElementById("bu-sort").addEventListener("change", renderBudgets)
}
function init() { load(); authInit(); mountTabs(); bind(); cfgBind(); dashboardBind(); renderClients(); renderClientOptions(); calcItemsTotal(); renderBudgets(); dashboard() }
document.addEventListener("DOMContentLoaded", init)
