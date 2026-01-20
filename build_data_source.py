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
        "poNumber":"PO_Number",
        "jobName":"Job_Name",
        "brand":"Brand",
        "orderQty":"Order_Qty",
        "dispQty":"Dispatch_Qty",
        "status":"Status",
        "date":"Login_Date",
        "invoiceNo":"Invoice_No",
        "value": "Value",
        "link": "Link",
        #"PO Pdf": "poPdf",
        "stage": "Stage"
    })

    sales_df = sales_df.rename(columns={
        "date": "Date",
        "invoiceNo": "Invoice_No",
        "jobName": "Job_Name",
        "value": "Value",
        "dueDate": "Due_Date",
        "link": "Link",
        #"PO Number Pdf": "ponumberPdf",
        "stage": "Stage"
    })

    item_master_df = item_master_df.rename(columns={
        "itemCode": "Item_Code",
        "jobsName": "Jobs_Name",
        "date": "Date",
        "packForm": "Pack_Form",
        "nQty": "N_Qty",
        "materialType": "Material_Type",
        "direction": "Direction",
        "labelSize": "Label_Size",
        "inventory": "Inventory",

        "artworkid": "Artwork_ID",
        "artworkFile": "Artwork_file"
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
