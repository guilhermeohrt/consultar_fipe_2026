const BASE_URL = "https://brasilapi.com.br/api/fipe";
const CHAVE_RECENTES = "fipe_recentes";

const $ = (id) => document.getElementById(id);
const form = $("form"), inputCodigo = $("codigo"), selectTabela = $("tabela"), btn = $("btn");
const loading = $("loading"), erro = $("erro"), resumo = $("resumo"), resultado = $("resultado");
const vazio = $("vazio"), recentesBox = $("recentes");

// Evita injeção de HTML vindo da API
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function setLoading(ativo) {
  loading.hidden = !ativo;
  btn.disabled = ativo;
  btn.textContent = ativo ? "Consultando..." : "Consultar preço";
}

function mostrarErro(msg) {
  erro.textContent = msg;
  erro.hidden = false;
}

async function buscar(url) {
  let resp;
  try {
    resp = await fetch(url);
  } catch {
    throw new Error("Sem conexão com a BrasilAPI. Verifique sua internet e tente novamente.");
  }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("Código FIPE não encontrado. Confira os dígitos e tente de novo.");
    throw new Error(`A BrasilAPI retornou um erro (HTTP ${resp.status}).`);
  }
  return resp.json();
}

/* ---------- Recentes (localStorage, com tratamento de falha) ---------- */
function lerRecentes() {
  try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES)) || []; } catch { return []; }
}
function salvarRecente(codigo) {
  try {
    const lista = [codigo, ...lerRecentes().filter((c) => c !== codigo)].slice(0, 5);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch { /* sem armazenamento disponível */ }
  renderRecentes();
}
function renderRecentes() {
  const lista = lerRecentes();
  recentesBox.querySelectorAll(".chip").forEach((c) => c.remove());
  recentesBox.hidden = lista.length === 0;
  lista.forEach((codigo) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = codigo;
    chip.addEventListener("click", () => { inputCodigo.value = codigo; form.requestSubmit(); });
    recentesBox.appendChild(chip);
  });
}

/* ---------- Tabelas de referência ---------- */
async function carregarTabelas() {
  try {
    const tabelas = await buscar(`${BASE_URL}/tabelas/v1`);
    tabelas.slice(0, 12).forEach((t) => {
      const op = document.createElement("option");
      op.value = t.codigo;
      op.textContent = t.mes.trim();
      selectTabela.appendChild(op);
    });
  } catch (e) {
    console.warn("Não foi possível carregar as tabelas:", e.message);
  }
}

/* ---------- Renderização ---------- */
function renderizar(veiculos) {
  const v0 = veiculos[0];
  resumo.innerHTML = `<h2>${esc(v0.marca)} ${esc(v0.modelo)}</h2>
    <p>Código FIPE ${esc(v0.codigoFipe)} · Referência: ${esc(v0.mesReferencia.trim())}</p>`;
  resumo.hidden = false;

  resultado.innerHTML = veiculos.map((v) => `
    <article class="card">
      <span class="badge">${v.anoModelo === 32000 ? "Zero km" : esc(v.anoModelo)}</span>
      <div class="rotulo">Preço médio</div>
      <div class="preco">${esc(v.valor)}</div>
      <dl>
        <dt>Combustível</dt><dd>${esc(v.combustivel)}</dd>
        <dt>Tipo</dt><dd>${esc(v.tipoVeiculo === 1 ? "Carro" : v.tipoVeiculo === 2 ? "Moto" : "Caminhão")}</dd>
        <dt>Consultado em</dt><dd>${esc(new Date(v.dataConsulta).toLocaleDateString("pt-BR"))}</dd>
      </dl>
    </article>`).join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const codigo = inputCodigo.value.trim();
  erro.hidden = true;
  resumo.hidden = true;
  resultado.innerHTML = "";

  if (!codigo) { mostrarErro("Informe o código FIPE do veículo."); return; }

  vazio.hidden = true;
  setLoading(true);
  const tabela = selectTabela.value ? `?tabela_referencia=${selectTabela.value}` : "";

  try {
    const dados = await buscar(`${BASE_URL}/preco/v1/${encodeURIComponent(codigo)}${tabela}`);
    renderizar(dados);
    salvarRecente(codigo);
  } catch (err) {
    mostrarErro(err.message);
    vazio.hidden = false;
  } finally {
    setLoading(false);
  }
});

carregarTabelas();
renderRecentes();
