# app.py
from __future__ import annotations

import io
import logging
from typing import List, Dict, Any

from flask import (
    Flask, render_template, request, jsonify
)
import pandas as pd

# -----------------------------
# Configuración base de Flask
# -----------------------------
app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = "clave-secreta-super-segura" 

# Configuración de Logging
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

# Límite de archivo (10 MB) y extensiones permitidas
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024 
ALLOWED_EXTENSIONS = {"csv"} 

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------
# Rutas de páginas (frontend)
# ---------------------------------
@app.route("/")
def home():
    return render_template("index.html", active_page='home')

@app.route("/analyze")
def analyze_page():
    return render_template("analyze.html", active_page='analyze')

@app.route("/quienes")
def quienes():
    return render_template("quienes.html", active_page='quienes')

@app.route("/edu")
def edu():
    return render_template("edu.html", active_page='edu')

@app.route("/soporte")
def soporte():
    return render_template("soporte.html", active_page='soporte')

@app.route("/login")
def login():
    return render_template("login.html", active_page='login')

# ------------------------------------------------
# Lógica de Negocio: Detección y KPIs
# ------------------------------------------------
def _detect_file_type(df: pd.DataFrame) -> str:
    """Detecta si es Ventas, Inventario o Clientes según las columnas."""
    cols = [c.lower() for c in df.columns]
    
    # Lógica de detección basada en palabras clave de tus imágenes
    if any("id_venta" in c for c in cols) and any("total" in c for c in cols):
        return "sales"
    elif any("stock" in c for c in cols) and any("precio" in c for c in cols):
        return "inventory"
    elif any("id_cliente" in c for c in cols) and (any("telefono" in c for c in cols) or any("nombre" in c for c in cols)):
        return "clients"
    else:
        return "general"

def _calculate_sales_kpis(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula métricas para archivos de VENTAS."""
    # Buscamos columnas clave de forma flexible
    total_col = next((c for c in df.columns if "total" in c.lower()), None)
    payment_col = next((c for c in df.columns if "metodo" in c.lower() or "pago" in c.lower()), None)
    product_col = next((c for c in df.columns if "producto" in c.lower()), None)

    kpis = {}
    
    if total_col:
        # Convertir a número forzosamente y sumar
        df[total_col] = pd.to_numeric(df[total_col], errors='coerce').fillna(0)
        kpis["total_revenue"] = float(df[total_col].sum())
        kpis["avg_ticket"] = float(df[total_col].mean())
        kpis["total_transactions"] = int(len(df))
    
    if product_col:
        # Producto más vendido (moda)
        top_prod = df[product_col].mode()
        kpis["top_product"] = top_prod[0] if not top_prod.empty else "N/A"

    if payment_col:
        # Top 3 métodos de pago
        kpis["payment_methods"] = df[payment_col].value_counts().head(3).to_dict()

    return kpis

def _calculate_inventory_kpis(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula métricas para archivos de INVENTARIO."""
    stock_col = next((c for c in df.columns if "stock" in c.lower()), None)
    price_col = next((c for c in df.columns if "precio" in c.lower()), None)
    
    kpis = {}
    
    if stock_col:
        df[stock_col] = pd.to_numeric(df[stock_col], errors='coerce').fillna(0)
        kpis["total_items"] = int(df[stock_col].sum())
        # Productos con stock bajo (menos de 5 unidades)
        kpis["low_stock_count"] = int(df[df[stock_col] < 5].shape[0])

    if stock_col and price_col:
        df[price_col] = pd.to_numeric(df[price_col], errors='coerce').fillna(0)
        # Valoración: Stock * Precio
        total_value = (df[stock_col] * df[price_col]).sum()
        kpis["inventory_value"] = float(total_value)

    return kpis

def _calculate_clients_kpis(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula métricas para archivos de CLIENTES."""
    phone_col = next((c for c in df.columns if "telefono" in c.lower()), None)
    
    kpis = {}
    kpis["total_clients"] = int(len(df))
    
    if phone_col:
        # Contar cuántos tienen teléfono registrado (no nulos)
        valid_phones = df[phone_col].count()
        kpis["clients_with_contact"] = int(valid_phones)
    
    return kpis

# ------------------------------------------------
# Utilidades de lectura CSV
# ------------------------------------------------
def _try_read_csv(file_bytes: bytes) -> pd.DataFrame:
    sample_size = 2_000_000 
    sample = file_bytes[:sample_size]
    encodings_to_try = ["utf-8", "utf-8-sig", "latin1", "iso-8859-1", "utf-16", "cp1252"]
    last_err = None

    for enc in encodings_to_try:
        try:
            buf_head = io.BytesIO(sample)
            pd.read_csv(buf_head, sep=None, engine="python", encoding=enc, nrows=50)
            
            full_buf = io.BytesIO(file_bytes)
            df_full = pd.read_csv(full_buf, sep=None, engine="python", encoding=enc)
            return df_full
        except Exception as e:
            last_err = e
            continue
    raise ValueError("No se pudo leer el archivo CSV. Verifique el formato.")

def _build_quick_summary(df: pd.DataFrame) -> Dict[str, Any]:
    headers = list(df.columns)
    row_count, col_count = df.shape
    
    # Tipos
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    datetime_cols = df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns.tolist()
    bool_cols = df.select_dtypes(include="bool").columns.tolist()
    object_cols = df.select_dtypes(include="object").columns.tolist()

    # Nulos
    nulls = df.head(50).isna().sum().sort_values(ascending=False).head(5).astype(int)
    nulls_dict = nulls[nulls > 0].to_dict()
    
    # Preview
    preview_records = df.head(5).to_dict(orient="records")

    return {
        "headers": headers,
        "shape": {"rows": int(row_count), "cols": int(col_count)},
        "types": {"numeric": numeric_cols, "datetime": datetime_cols, "boolean": bool_cols, "text": object_cols},
        "nulls_top5": nulls_dict,
        "preview": preview_records,
    }

# ---------------------------------------------
# API: Subida y Dashboard Inteligente
# ---------------------------------------------
@app.route("/upload", methods=["POST"])
def upload_file():
    app.logger.info("Recibida solicitud de subida.")
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No se envió el archivo."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"ok": False, "error": "No seleccionó archivo."}), 400
    if not allowed_file(file.filename):
        return jsonify({"ok": False, "error": "Formato no permitido. Solo CSV."}), 400

    try:
        file_bytes = file.read()
        if not file_bytes:
            return jsonify({"ok": False, "error": "Archivo vacío."}), 400

        # 1. Leer CSV
        df = _try_read_csv(file_bytes)

        # 2. Resumen Técnico
        summary_display = _build_quick_summary(df)

        # 3. Detección Inteligente y Cálculo de KPIs
        file_type = _detect_file_type(df)
        dashboard_data = {}

        if file_type == "sales":
            dashboard_data = _calculate_sales_kpis(df)
        elif file_type == "inventory":
            dashboard_data = _calculate_inventory_kpis(df)
        elif file_type == "clients":
            dashboard_data = _calculate_clients_kpis(df)

        app.logger.info(f"Archivo procesado. Tipo detectado: {file_type}")

        return jsonify({
            "ok": True,
            "type": file_type,
            "dashboard_data": dashboard_data,
            "summary_display": summary_display
        }), 200

    except ValueError as ve:
        return jsonify({"ok": False, "error": str(ve)}), 400
    except Exception as e:
        app.logger.exception("Error interno.")
        return jsonify({"ok": False, "error": "Error interno del servidor."}), 500

if __name__ == "__main__":
    app.run(debug=True)