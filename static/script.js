// 📊 script.js - DataBridge (Modo Inteligente - Sin IA)
console.log("✅ DataBridge script.js cargado. (Modo Dashboard Auto)");

// Referencias Globales
let fileInput;
let analyzeBtn;
let output; 
let fileNameDisplay;

// Carrusel
let carouselSlides, currentSlideIndex = 0, carouselNavArrows, carouselPaginationDotsContainer, totalSlides;

// -------------------------------------------------------------
// Inicialización
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Analyze.html
    fileInput = document.getElementById("fileInput");
    analyzeBtn = document.getElementById("analyzeBtn");
    output = document.getElementById("output");
    fileNameDisplay = document.getElementById("file-name-display");

    if (fileInput && analyzeBtn && output) {
        output.classList.add('output-box');
        fileInput.addEventListener('change', updateFileNameDisplay);
        analyzeBtn.addEventListener("click", handleInitialAnalysis);
    }

    // Edu.html (Carrusel)
    carouselSlides = document.querySelectorAll(".carousel-slide");
    carouselNavArrows = document.querySelectorAll(".carousel-nav-arrow");
    carouselPaginationDotsContainer = document.querySelector(".carousel-pagination-dots");
    if (carouselSlides.length > 0) initializeCarousel();
});

// -------------------------------------------------------------
// Utilidades UI
// -------------------------------------------------------------
function updateFileNameDisplay() {
    fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'Ningún archivo seleccionado.';
}

function renderError(message, targetElement) {
    targetElement.innerHTML = `<div class="status-box error"><i class="fa-solid fa-circle-exclamation"></i> Error: ${message}</div>`;
}

function renderLoading(message) {
    return `<div class="status-box loading"><i class="fa-solid fa-spinner fa-spin"></i> ${message}</div>`;
}

// -------------------------------------------------------------
// Lógica Principal de Análisis
// -------------------------------------------------------------
async function handleInitialAnalysis() {
    const file = fileInput.files[0];
    if (!file) {
        renderError("Por favor, seleccione un archivo CSV.", output);
        return;
    }

    output.innerHTML = renderLoading(`Analizando estructura de <strong>${file.name}</strong>...`);
    analyzeBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/upload", { method: "POST", body: formData });
        const data = await response.json();
        analyzeBtn.disabled = false;

        if (!data.ok) {
            renderError(data.error, output);
            return;
        }

        // Datos recibidos del backend
        const summary = data.summary_display;
        const fileType = data.type;
        const dashData = data.dashboard_data;

        output.innerHTML = ''; // Limpiar loader

        // 1. Renderizar Dashboard según el tipo detectado
        if (fileType === 'sales') {
            output.innerHTML += renderSalesDashboard(dashData);
        } else if (fileType === 'inventory') {
            output.innerHTML += renderInventoryDashboard(dashData);
        } else if (fileType === 'clients') {
            output.innerHTML += renderClientsDashboard(dashData);
        } else {
            output.innerHTML += `<div class="status-box info"><i class="fa-solid fa-info-circle"></i> Archivo general detectado. Mostrando estadísticas base.</div>`;
        }

        // 2. Renderizar Resumen Técnico (Tabla, tipos, etc.)
        output.innerHTML += renderSummary(summary);

    } catch (err) {
        console.error(err);
        analyzeBtn.disabled = false;
        renderError("Error de conexión con el servidor.", output);
    }
}

// -------------------------------------------------------------
// Renderizadores de Dashboards (KPIs)
// -------------------------------------------------------------
function renderSalesDashboard(data) {
    const revenue = data.total_revenue ? `$${data.total_revenue.toLocaleString('en-US', {minimumFractionDigits: 2})}` : '$0';
    const ticket = data.avg_ticket ? `$${data.avg_ticket.toFixed(2)}` : '$0';
    
    let paymentHtml = '';
    if (data.payment_methods) {
        for (const [method, count] of Object.entries(data.payment_methods)) {
            paymentHtml += `<li>${method}: <strong>${count}</strong></li>`;
        }
    }

    return `
    <div class="dashboard-header">
        <h3><i class="fa-solid fa-cash-register"></i> Dashboard de Ventas</h3>
        <p class="text-muted">Métricas clave detectadas automáticamente</p>
    </div>
    <div class="dashboard-grid">
        <div class="kpi-card highlight">
            <i class="fa-solid fa-money-bill-wave"></i>
            <h4>Ingresos Totales</h4>
            <div class="value">${revenue}</div>
        </div>
        <div class="kpi-card">
            <i class="fa-solid fa-receipt"></i>
            <h4>Transacciones</h4>
            <div class="value">${data.total_transactions || 0}</div>
        </div>
        <div class="kpi-card">
            <i class="fa-solid fa-chart-line"></i>
            <h4>Ticket Promedio</h4>
            <div class="value">${ticket}</div>
        </div>
        <div class="kpi-card">
            <i class="fa-solid fa-star"></i>
            <h4>Top Producto</h4>
            <div class="value small">${data.top_product || 'N/A'}</div>
        </div>
        <div class="kpi-card list-card">
            <h4>Métodos de Pago Top</h4>
            <ul class="kpi-list">${paymentHtml}</ul>
        </div>
    </div>
    <hr class="separator">
    `;
}

function renderInventoryDashboard(data) {
    const value = data.inventory_value ? `$${data.inventory_value.toLocaleString('en-US', {minimumFractionDigits: 2})}` : '$0';
    const lowStockClass = data.low_stock_count > 0 ? 'text-danger' : 'text-success';
    const lowStockIcon = data.low_stock_count > 0 ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-check"></i>';

    return `
    <div class="dashboard-header">
        <h3><i class="fa-solid fa-boxes-stacked"></i> Dashboard de Inventario</h3>
        <p class="text-muted">Control de stock y valoración</p>
    </div>
    <div class="dashboard-grid">
        <div class="kpi-card highlight">
            <i class="fa-solid fa-sack-dollar"></i>
            <h4>Valoración Total</h4>
            <div class="value">${value}</div>
        </div>
        <div class="kpi-card">
            <i class="fa-solid fa-cube"></i>
            <h4>Total Ítems (Unidades)</h4>
            <div class="value">${data.total_items || 0}</div>
        </div>
        <div class="kpi-card">
            ${lowStockIcon}
            <h4>Stock Bajo (< 5)</h4>
            <div class="value ${lowStockClass}">${data.low_stock_count || 0}</div>
        </div>
    </div>
    <hr class="separator">
    `;
}

function renderClientsDashboard(data) {
    const pct = data.total_clients > 0 ? ((data.clients_with_contact / data.total_clients) * 100).toFixed(0) : 0;
    
    return `
    <div class="dashboard-header">
        <h3><i class="fa-solid fa-users"></i> Dashboard de Clientes</h3>
        <p class="text-muted">Análisis de base de datos</p>
    </div>
    <div class="dashboard-grid">
        <div class="kpi-card highlight">
            <i class="fa-solid fa-address-card"></i>
            <h4>Total Clientes</h4>
            <div class="value">${data.total_clients || 0}</div>
        </div>
        <div class="kpi-card">
            <i class="fa-solid fa-phone"></i>
            <h4>Con Contacto</h4>
            <div class="value">${data.clients_with_contact || 0}</div>
            <div class="sub-text">${pct}% completado</div>
        </div>
    </div>
    <hr class="separator">
    `;
}

// -------------------------------------------------------------
// Renderizador Genérico (Tabla y Tipos)
// -------------------------------------------------------------
function renderSummary(summary) {
    return `
        <div class="summary-card status-box success">
            <h4><i class="fa-solid fa-table"></i> Detalles del Archivo</h4>
            <p><strong>Filas:</strong> ${summary.shape.rows} | <strong>Columnas:</strong> ${summary.shape.cols}</p>
        </div>
        ${renderTypes(summary.types)}
        ${renderNulls(summary.nulls_top5)}
        ${renderPreview(summary.preview)}
        
        <div class="summary-action-bar">
            <button onclick="window.location.reload()" class="btn btn-secondary-outline">Analizar otro archivo</button>
        </div>
    `;
}

function renderTypes(types) {
    const typeItems = [];
    if (types.numeric.length > 0) typeItems.push(`<li><i class="fa-solid fa-hashtag"></i> Numéricas: <strong>${types.numeric.length}</strong></li>`);
    if (types.text.length > 0) typeItems.push(`<li><i class="fa-solid fa-font"></i> Texto: <strong>${types.text.length}</strong></li>`);
    if (types.datetime.length > 0) typeItems.push(`<li><i class="fa-solid fa-calendar-days"></i> Fechas: <strong>${types.datetime.length}</strong></li>`);
    return `<div class="summary-card"><h4>Tipos de datos</h4><ul>${typeItems.join('')}</ul></div>`;
}

function renderNulls(nulls) {
    if (!nulls || Object.keys(nulls).length === 0) return ``;
    const items = Object.entries(nulls).map(([col, val]) => `<li>${col}: <strong>${val}</strong> nulos</li>`).join("");
    return `<div class="summary-card"><h4><i class="fa-solid fa-triangle-exclamation"></i> Nulos Detectados</h4><ul class="nulls-list">${items}</ul></div>`;
}

function renderPreview(preview) {
    if (!preview || preview.length === 0) return ``;
    const headers = Object.keys(preview[0]);
    const rows = preview.map(row => `<tr>${headers.map(h => `<td>${row[h] !== undefined ? row[h] : '-'}</td>`).join("")}</tr>`).join("");
    return `
        <div class="summary-card">
            <h4>Vista Previa</h4>
            <div class="table-wrapper">
                <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// Carrusel (Sin Cambios)
// -------------------------------------------------------------
function initializeCarousel() {
    totalSlides = carouselSlides.length;
    carouselNavArrows.forEach(arrow => {
        arrow.addEventListener("click", () => {
            if (arrow.classList.contains("next-arrow")) nextSlide();
            else if (arrow.classList.contains("prev-arrow")) prevSlide();
        });
    });
    carouselPaginationDotsContainer.innerHTML = '';
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('span');
        dot.classList.add('dot');
        dot.dataset.slideIndex = i;
        dot.addEventListener('click', () => showSlide(i));
        carouselPaginationDotsContainer.appendChild(dot);
    }
    showSlide(currentSlideIndex);
}
function showSlide(index) {
    if (index < 0 || index >= totalSlides) return;
    currentSlideIndex = index;
    carouselSlides.forEach((slide) => { slide.style.display = "none"; slide.classList.remove('active'); });
    carouselSlides[currentSlideIndex].style.display = "flex";
    carouselSlides[currentSlideIndex].classList.add('active');
    updatePagination();
}
function nextSlide() { let newIndex = currentSlideIndex + 1; if (newIndex >= totalSlides) newIndex = 0; showSlide(newIndex); }
function prevSlide() { let newIndex = currentSlideIndex - 1; if (newIndex < 0) newIndex = totalSlides - 1; showSlide(newIndex); }
function updatePagination() {
    const dots = document.querySelectorAll(".carousel-pagination-dots .dot");
    dots.forEach((dot, i) => { dot.classList.toggle("active", i === currentSlideIndex); });
}