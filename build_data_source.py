import pandas as pd
import json
from pathlib import Path

# =========================
# CONFIG
# =========================
ORDER_SALES_PATH = Path(r"C:\Users\pc\Desktop\AP01\order_sales.xlsx")
ITEM_MASTER_PATH = Path(r"C:\Users\pc\Desktop\AP01\item_master.xlsx")

ORDER_SHEET = "ORDER BOOK"
SALES_SHEET = "SALES BOOK"
ITEM_MASTER_SHEET = "Shaily Gupta"

OUTPUT_JS = Path(r"C:\Users\pc\Desktop\AP01\data-source.js")

# =========================
# HELPERS
# =========================
def clean_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fix floating point precision safely.
    - Integers stay integers
    - Decimals rounded to 2 places
    """
    for col in df.select_dtypes(include=["float"]):
        non_null = df[col].dropna()

        if not non_null.empty and (non_null % 1 == 0).all():
            df[col] = df[col].round(0).astype("Int64")
        else:
            df[col] = df[col].round(2)

    return df


def df_to_js_array(df: pd.DataFrame) -> str:
    # Drop fully empty rows
    df = df.dropna(how="all")

    # ✅ STEP 1: Convert ALL datetime columns by dtype (CRITICAL)
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.strftime("%Y-%m-%d")

    # ✅ STEP 2: Fix numeric precision
    df = clean_numeric_columns(df)

    # ✅ STEP 3: Replace NaN ONLY in non-numeric columns
    for col in df.columns:
        if not pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].astype(str).fillna("")

    # ✅ STEP 4: JSON-safe export
    return json.dumps(
        df.to_dict(orient="records"),
        ensure_ascii=False,
        indent=4
    )


# =========================
# MAIN
# =========================
def main():
    order_df = pd.read_excel(ORDER_SALES_PATH, sheet_name=ORDER_SHEET)
    sales_df = pd.read_excel(ORDER_SALES_PATH, sheet_name=SALES_SHEET)
    item_master_df = pd.read_excel(ITEM_MASTER_PATH, sheet_name=ITEM_MASTER_SHEET)

    order_df = order_df.rename(columns={
        "PO Number": "poNumber",
        "Job Name": "jobName",
        "Brand": "brand",
        "Order Qty": "orderQty",
        "Dispatch Qty": "dispQty",
        "Status": "status",
        "Login Date": "date",
        "Invoice No": "invoiceNo",
        "Value": "value",
        "Link": "link",
        #"PO Pdf": "poPdf",
        "Stage": "stage"
    })

    sales_df = sales_df.rename(columns={
        "Date": "date",
        "Invoice No": "invoiceNo",
        "Job Name": "jobName",
        "Value": "value",
        "Due Date": "dueDate",
        "Link": "link",
        #"PO Number Pdf": "ponumberPdf",
        "Stage": "stage"
    })

    item_master_df = item_master_df.rename(columns={
        "ITEM CODE": "itemCode",
        "Job Name": "jobsName",
        "date": "date",
        "artworkId": "artworkId",
        "Customer Name": "customerName",
        "Pak_Form": "pakForm",
        "N_Qty": "nQty",
        "Direction": "direction",
        "Label_Size": "labelSize",
        "Material": "material",
        "inventory": "inventory",
        "GST_Credit": "gstCredit",
        "HSN_SAC_Code": "hsnSacCode",
        "Artwork File": "artworkFile"
    })

    order_json = df_to_js_array(order_df)
    sales_json = df_to_js_array(sales_df)
    item_master_json = df_to_js_array(item_master_df)

    js_content = (
        f"const orderBookData = {order_json};\n\n"
        f"const salesBookData = {sales_json};\n\n"
        f"const itemMasterData = {item_master_json};\n"
    )

    OUTPUT_JS.write_text(js_content, encoding="utf-8")
    print(f"✔ Data written successfully to: {OUTPUT_JS}")

# =========================
# RUN
# =========================
if __name__ == "__main__":
    main()
